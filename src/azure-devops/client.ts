/**
 * Cliente base para Azure DevOps API
 *
 * Este módulo proporciona un wrapper alrededor del SDK oficial de Azure DevOps
 * con funcionalidades adicionales:
 * - Gestión de conexiones
 * - Cache de resultados
 * - Retry automático con backoff exponencial
 * - Logging estructurado
 * - Métricas de performance
 *
 * @module azure-devops/client
 */

import * as azdev from 'azure-devops-node-api';
import type { IGitApi } from 'azure-devops-node-api/GitApi.js';
import type { IWorkItemTrackingApi } from 'azure-devops-node-api/WorkItemTrackingApi.js';
import type { IPolicyApi } from 'azure-devops-node-api/PolicyApi.js';
import type {
  GitRepository,
  GitPullRequest,
  GitPullRequestSearchCriteria,
  PullRequestStatus,
  GitPullRequestChange,
  GitItem,
  Comment as AzdoComment,
  GitPullRequestCommentThread,
  GitVersionDescriptor,
} from 'azure-devops-node-api/interfaces/GitInterfaces.js';
import type {
  WorkItem,
} from 'azure-devops-node-api/interfaces/WorkItemTrackingInterfaces.js';
import type {
  PolicyConfiguration,
} from 'azure-devops-node-api/interfaces/PolicyInterfaces.js';
import type {
  AzureDevOpsConfig,
  AzureDevOpsConnection,
  PullRequestInfo,
  PullRequestFilters,
  FileChange,
  GitPullRequestStatus,
  CommentThread,
  Comment,
  LogEntry,
  PerformanceMetrics,
} from './types.js';
import {
  AzureDevOpsError,
  AuthenticationError,
  InsufficientPermissionsError,
  ResourceNotFoundError,
  RateLimitError,
} from './types.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('AzureDevOps-Client');

/**
 * Cliente base para Azure DevOps
 *
 * Maneja toda la comunicación con la API de Azure DevOps
 */
export class AzureDevOpsClient {
  private connection: azdev.WebApi | null = null;
  private gitApi: IGitApi | null = null;
  private workItemApi: IWorkItemTrackingApi | null = null;
  private policyApi: IPolicyApi | null = null;
  private repositoryCache: Map<string, GitRepository> = new Map();
  private pullRequestCache: Map<number, GitPullRequest> = new Map();
  private cacheTimestamps: Map<string, number> = new Map();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos
  private metrics: PerformanceMetrics[] = [];
  private connectionInfo: AzureDevOpsConnection | null = null;

  constructor(private config: AzureDevOpsConfig) {
    this.logInfo('AzureDevOpsClient initialized');
  }

  /**
   * Ejecuta una operación con retry automático y backoff exponencial
   *
   * Implementa: Escenario 6.1.9 - Manejo de rate limiting
   * Implementa: Escenario 6.1.10 - Configuración de retry policy
   *
   * @param operation Función a ejecutar con retry
   * @param operationName Nombre de la operación para logging
   * @returns Resultado de la operación
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    const retryPolicy = this.config.retryPolicy!;
    let lastError: Error | null = null;
    let attempt = 0;

    while (attempt <= retryPolicy.maxRetries) {
      try {
        // Intentar la operación
        return await operation();
      } catch (error) {
        lastError = error as Error;
        attempt++;

        // Determinar si debemos reintentar
        const shouldRetry = this.shouldRetryError(error, retryPolicy);

        if (!shouldRetry || attempt > retryPolicy.maxRetries) {
          // No reintentar o se agotaron los intentos
          this.logError(
            `Operation ${operationName} failed after ${attempt} attempts`,
            lastError,
            { attempt, maxRetries: retryPolicy.maxRetries }
          );
          throw lastError;
        }

        // Calcular delay con backoff exponencial
        const delay = this.calculateRetryDelay(
          attempt,
          retryPolicy,
          error instanceof RateLimitError ? error.retryAfter : undefined
        );

        this.logWarn(
          `Operation ${operationName} failed, retrying in ${delay}ms`,
          {
            attempt,
            maxRetries: retryPolicy.maxRetries,
            delay,
            error: lastError.message,
          }
        );

        // Esperar antes de reintentar
        await this.sleep(delay);
      }
    }

    // Esto nunca debería llegar aquí, pero TypeScript lo requiere
    throw lastError!;
  }

  /**
   * Determina si un error debe ser reintentado
   */
  private shouldRetryError(error: unknown, retryPolicy: typeof this.config.retryPolicy): boolean {
    // Siempre reintentar RateLimitError
    if (error instanceof RateLimitError) {
      return true;
    }

    // Verificar si es un error de Azure DevOps
    if (error instanceof AzureDevOpsError) {
      const statusCode = error.statusCode;
      if (statusCode && retryPolicy!.retryableStatusCodes?.includes(statusCode)) {
        return true;
      }
    }

    // Verificar errores de red genéricos
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    const networkErrors = [
      'econnreset',
      'econnrefused',
      'etimedout',
      'enetunreach',
      'socket hang up',
    ];

    return networkErrors.some(netErr => message.includes(netErr));
  }

  /**
   * Calcula el delay para el siguiente retry usando backoff exponencial
   */
  private calculateRetryDelay(
    attempt: number,
    retryPolicy: typeof this.config.retryPolicy,
    retryAfter?: number
  ): number {
    // Si el servidor especificó Retry-After, usarlo
    if (retryAfter !== undefined && retryAfter > 0) {
      return retryAfter * 1000; // Convertir a ms
    }

    // Backoff exponencial: delay * (multiplier ^ attempt)
    const exponentialDelay =
      retryPolicy!.retryDelayMs * Math.pow(retryPolicy!.backoffMultiplier, attempt - 1);

    // Agregar jitter aleatorio (±25%) para evitar thundering herd
    const jitter = exponentialDelay * 0.25;
    const randomJitter = Math.random() * jitter * 2 - jitter;

    const finalDelay = Math.floor(exponentialDelay + randomJitter);

    // Cap máximo de 30 segundos
    return Math.min(finalDelay, 30000);
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Conecta al servicio de Azure DevOps
   *
   * Implementa: Escenario 6.1.1 - Conexión exitosa a Azure DevOps API
   *
   * @throws AuthenticationError si las credenciales son inválidas
   * @throws AzureDevOpsError si hay un error de conexión
   */
  async connect(): Promise<AzureDevOpsConnection> {
    const startTime = Date.now();

    try {
      this.logInfo('Connecting to Azure DevOps...', {
        organizationUrl: this.config.organizationUrl,
        project: this.config.project,
      });

      // Crear handler de autenticación
      const authHandler = azdev.getPersonalAccessTokenHandler(
        this.config.personalAccessToken
      );

      // Crear conexión
      this.connection = new azdev.WebApi(
        this.config.organizationUrl,
        authHandler,
        {
          socketTimeout: this.config.timeout,
        }
      );

      // Obtener APIs
      this.gitApi = await this.connection.getGitApi();
      this.workItemApi = await this.connection.getWorkItemTrackingApi();
      this.policyApi = await this.connection.getPolicyApi();

      // Validar conexión listando repositorios
      const repositories = await this.listRepositories();

      if (repositories.length === 0) {
        throw new AzureDevOpsError(
          `No repositories found in project '${this.config.project}'`,
          404
        );
      }

      // Obtener información del repositorio si está configurado
      let repository: GitRepository | undefined;
      if (this.config.repository) {
        repository = repositories.find(r => r.name === this.config.repository);
        if (!repository) {
          throw new ResourceNotFoundError(
            'Repository',
            this.config.repository!
          );
        }
      } else if (this.config.repositoryId) {
        repository = repositories.find(r => r.id === this.config.repositoryId);
        if (!repository) {
          throw new ResourceNotFoundError(
            'Repository',
            this.config.repositoryId!
          );
        }
      } else {
        // Usar el primer repositorio si no se especificó
        repository = repositories[0];
      }

      // Guardar información de conexión
      this.connectionInfo = {
        organizationUrl: this.config.organizationUrl,
        project: this.config.project,
        repositoryId: repository!.id!,
        repositoryName: repository!.name!,
        defaultBranch: repository!.defaultBranch || 'refs/heads/main',
        isConnected: true,
        connectionDate: new Date(),
      };

      const duration = Date.now() - startTime;
      this.recordMetric('connect', duration, 200);
      this.logInfo('Successfully connected to Azure DevOps', {
        duration,
        repository: this.connectionInfo.repositoryName,
        repositories: repositories.length,
      });

      return this.connectionInfo;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordMetric('connect', duration, 0, error as Error);

      // Convertir errores a tipos específicos
      if (error instanceof AzureDevOpsError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : 'Unknown error';

      if (message.includes('401') || message.includes('Unauthorized')) {
        throw new AuthenticationError(
          'Invalid Personal Access Token. Please check your PAT and ensure it has the required scopes.',
          { originalError: message }
        );
      }

      if (message.includes('403') || message.includes('Forbidden')) {
        throw new InsufficientPermissionsError(
          'Insufficient permissions. PAT must have scopes: vso.code, vso.work_write, vso.build',
          ['vso.code', 'vso.work_write', 'vso.build'],
          { originalError: message }
        );
      }

      throw new AzureDevOpsError(
        `Failed to connect to Azure DevOps: ${message}`,
        undefined,
        undefined,
        error
      );
    }
  }

  /**
   * Obtiene información del repositorio
   *
   * Implementa: Escenario 6.1.4 - Obtener información de repositorio
   */
  async getRepository(repositoryId?: string): Promise<GitRepository> {
    this.ensureConnected();

    const repoId = repositoryId || this.connectionInfo!.repositoryId;
    const cacheKey = `repo:${repoId}`;

    // Verificar cache
    if (this.isCacheValid(cacheKey)) {
      const cached = this.repositoryCache.get(repoId);
      if (cached) {
        this.logDebug('Repository retrieved from cache', { repositoryId: repoId });
        this.recordMetric('get_repository', 0, 200);
        return cached;
      }
    }

    const startTime = Date.now();

    try {
      const repository = await this.gitApi!.getRepository(repoId, this.config.project);

      if (!repository) {
        throw new ResourceNotFoundError('Repository', repoId);
      }

      // Actualizar cache
      this.repositoryCache.set(repoId, repository);
      this.setCacheTimestamp(cacheKey);

      const duration = Date.now() - startTime;
      this.recordMetric('get_repository', duration, 200);

      return repository;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordMetric('get_repository', duration, 0, error as Error);
      throw this.handleApiError(error, 'get_repository');
    }
  }

  /**
   * Lista repositorios del proyecto
   *
   * Implementa: Escenario 6.1.1 - Conexión exitosa (parte de validación)
   * Con retry automático según configuración
   */
  async listRepositories(): Promise<GitRepository[]> {
    this.ensureApi();

    return this.executeWithRetry(async () => {
      const startTime = Date.now();

      try {
        const repositories = await this.gitApi!.getRepositories(this.config.project);

        const duration = Date.now() - startTime;
        this.recordMetric('list_repositories', duration, 200);

        return repositories || [];
      } catch (error) {
        const duration = Date.now() - startTime;
        this.recordMetric('list_repositories', duration, 0, error as Error);
        throw this.handleApiError(error, 'list_repositories');
      }
    }, 'list_repositories');
  }

  /**
   * Lista Pull Requests activos
   *
   * Implementa: Escenario 6.1.5 - Listar Pull Requests activos
   */
  async listPullRequests(filters?: PullRequestFilters): Promise<PullRequestInfo[]> {
    this.ensureConnected();

    const startTime = Date.now();

    try {
      const criteria: GitPullRequestSearchCriteria = {
        status: this.mapPullRequestStatus(filters?.status),
        creatorId: filters?.creatorId,
        reviewerId: filters?.reviewerId,
        sourceRefName: filters?.sourceRefName,
        targetRefName: filters?.targetRefName,
        includeLinks: false,
      };

      const pullRequests = await this.gitApi!.getPullRequests(
        this.connectionInfo!.repositoryId,
        criteria,
        this.config.project,
        undefined,
        filters?.skip || 0,
        filters?.top || 100
      );

      let results = pullRequests as PullRequestInfo[];

      // Filtrar solo PRs con archivos de pipeline si se solicita
      if (filters?.pipelineFilesOnly) {
        results = await this.filterPRsWithPipelineFiles(results);
      }

      const duration = Date.now() - startTime;
      this.recordMetric('list_pull_requests', duration, 200);

      this.logDebug('Pull requests listed', {
        count: results.length,
        filters,
      });

      return results;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordMetric('list_pull_requests', duration, 0, error as Error);
      throw this.handleApiError(error, 'list_pull_requests');
    }
  }

  /**
   * Obtiene detalles completos de un Pull Request
   *
   * Implementa: Escenario 6.1.6 - Obtener detalles completos de un PR
   * Con retry automático según configuración
   */
  async getPullRequest(pullRequestId: number, useCache: boolean = true): Promise<PullRequestInfo> {
    this.ensureConnected();

    // Verificar cache si está habilitado
    if (useCache && this.isCacheValid(`pr:${pullRequestId}`)) {
      const cached = this.pullRequestCache.get(pullRequestId);
      if (cached) {
        this.logDebug('Pull request retrieved from cache', { pullRequestId });
        this.recordMetric('get_pull_request', 0, 200);
        return cached as PullRequestInfo;
      }
    }

    return this.executeWithRetry(async () => {
      const startTime = Date.now();

      try {
        const pr = await this.gitApi!.getPullRequest(
          this.connectionInfo!.repositoryId,
          pullRequestId,
          this.config.project
        );

        if (!pr) {
          throw new ResourceNotFoundError('Pull Request', pullRequestId.toString());
        }

        // Extender con información adicional
        const prInfo: PullRequestInfo = {
          ...pr,
          pipelineAnalysisStatus: 'pending',
        };

        // Actualizar cache
        if (useCache) {
          this.pullRequestCache.set(pullRequestId, prInfo);
          this.setCacheTimestamp(`pr:${pullRequestId}`);
        }

        const duration = Date.now() - startTime;
        this.recordMetric('get_pull_request', duration, 200);

        return prInfo;
      } catch (error) {
        const duration = Date.now() - startTime;
        this.recordMetric('get_pull_request', duration, 0, error as Error);
        throw this.handleApiError(error, 'get_pull_request');
      }
    }, 'get_pull_request');
  }

  /**
   * Obtiene archivos modificados en un PR
   *
   * Implementa: Escenario 6.1.7 - Obtener archivos modificados en PR
   */
  async getPullRequestFiles(pullRequestId: number): Promise<FileChange[]> {
    this.ensureConnected();

    const startTime = Date.now();

    try {
      // Obtener iteración más reciente del PR
      const iterations = await this.gitApi!.getPullRequestIterations(
        this.connectionInfo!.repositoryId,
        pullRequestId,
        this.config.project
      );

      if (!iterations || iterations.length === 0) {
        return [];
      }

      const latestIteration = iterations[iterations.length - 1];

      // Obtener cambios de la iteración
      const changes = await this.gitApi!.getPullRequestIterationChanges(
        this.connectionInfo!.repositoryId,
        pullRequestId,
        latestIteration.id!,
        this.config.project
      );

      if (!changes || !changes.changeEntries) {
        return [];
      }

      // Mapear a FileChange
      const fileChanges: FileChange[] = changes.changeEntries.map(change => ({
        ...change,
        path: change.item?.path || '',
        changeType: change.changeType as any,
        originalPath: change.sourceServerItem,
        isPipelineFile: this.isPipelineFile(change.item?.path || ''),
      }));

      const duration = Date.now() - startTime;
      this.recordMetric('get_pr_files', duration, 200);

      this.logDebug('PR files retrieved', {
        pullRequestId,
        fileCount: fileChanges.length,
      });

      return fileChanges;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordMetric('get_pr_files', duration, 0, error as Error);
      throw this.handleApiError(error, 'get_pr_files');
    }
  }


  /**
   * Filtra PRs que tienen archivos de pipeline modificados
   */
  private async filterPRsWithPipelineFiles(prs: PullRequestInfo[]): Promise<PullRequestInfo[]> {
    const filtered: PullRequestInfo[] = [];

    for (const pr of prs) {
      try {
        const files = await this.getPullRequestFiles(pr.pullRequestId!);
        const pipelineFiles = files.filter(f => f.isPipelineFile);

        if (pipelineFiles.length > 0) {
          pr.pipelineFiles = pipelineFiles.map(f => f.path);
          filtered.push(pr);
        }
      } catch (error) {
        this.logWarn('Failed to get files for PR', {
          pullRequestId: pr.pullRequestId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return filtered;
  }

  /**
   * Determina si un archivo es un archivo de pipeline
   */
  private isPipelineFile(path: string): boolean {
    return (
      (path.endsWith('.yml') || path.endsWith('.yaml')) &&
      (path.includes('azure-pipelines') ||
        path.includes('.azure-pipelines') ||
        path.includes('pipelines/') ||
        path === 'azure-pipelines.yml' ||
        path === 'azure-pipelines.yaml')
    );
  }

  /**
   * Mapea filtro de estado a tipo de Azure DevOps
   */
  private mapPullRequestStatus(
    status?: 'active' | 'completed' | 'abandoned' | 'all'
  ): PullRequestStatus | undefined {
    if (!status || status === 'all') {
      return undefined;
    }

    // Usar valores numéricos del enum
    const statusMap: Record<string, PullRequestStatus> = {
      active: 1 as PullRequestStatus,        // PullRequestStatus.Active
      completed: 3 as PullRequestStatus,     // PullRequestStatus.Completed
      abandoned: 2 as PullRequestStatus,     // PullRequestStatus.Abandoned
    };

    return statusMap[status];
  }

  /**
   * Verifica que el cliente esté conectado
   */
  private ensureConnected(): void {
    if (!this.connectionInfo || !this.connectionInfo.isConnected) {
      throw new AzureDevOpsError(
        'Not connected to Azure DevOps. Call connect() first.',
        undefined,
        'NOT_CONNECTED'
      );
    }
    this.ensureApi();
  }

  /**
   * Obtiene los archivos modificados en un Pull Request
   *
   * Implementa: Escenario 6.1.7 - Obtener archivos modificados en PR
   * Con retry automático según configuración
   */
  async getPullRequestChanges(pullRequestId: number): Promise<GitPullRequestChange[]> {
    this.ensureConnected();

    return this.executeWithRetry(async () => {
      const startTime = Date.now();

      try {
        const iterations = await this.gitApi!.getPullRequestIterations(
          this.connectionInfo!.repositoryId,
          pullRequestId,
          this.config.project
        );

        if (!iterations || iterations.length === 0) {
          this.logWarn('No iterations found for pull request', { pullRequestId });
          return [];
        }

        // Obtener la última iteración
        const lastIteration = iterations[iterations.length - 1];

        if (!lastIteration.id) {
          this.logWarn('Last iteration has no ID', { pullRequestId });
          return [];
        }

        // Obtener cambios de la última iteración
        const changes = await this.gitApi!.getPullRequestIterationChanges(
          this.connectionInfo!.repositoryId,
          pullRequestId,
          lastIteration.id,
          this.config.project
        );

        const duration = Date.now() - startTime;
        this.recordMetric('get_pull_request_changes', duration, 200);

        this.logInfo('Pull request changes retrieved', {
          pullRequestId,
          iterationId: lastIteration.id,
          changeCount: changes?.changeEntries?.length || 0,
        });

        return changes?.changeEntries || [];
      } catch (error) {
        const duration = Date.now() - startTime;
        this.recordMetric('get_pull_request_changes', duration, 500);
        throw error;
      }
    }, 'get_pull_request_changes');
  }

  /**
   * Obtiene el contenido de un archivo en un Pull Request
   *
   * Implementa: Escenario 6.1.8 - Obtener contenido de archivo en PR
   * Con retry automático según configuración
   */
  async getFileContent(pullRequestId: number, filePath: string): Promise<string> {
    this.ensureConnected();

    return this.executeWithRetry(async () => {
      const startTime = Date.now();

      try {
        // Primero obtener el PR para conocer el commit
        const pr = await this.getPullRequest(pullRequestId, true);

        if (!pr.lastMergeSourceCommit?.commitId) {
          throw new AzureDevOpsError(
            'Pull Request does not have a source commit',
            undefined,
            'NO_SOURCE_COMMIT',
            { pullRequestId }
          );
        }

        const commitId = pr.lastMergeSourceCommit.commitId;

        // Obtener el contenido del archivo en ese commit
        const item = await this.gitApi!.getItem(
          this.connectionInfo!.repositoryId,
          filePath,
          this.config.project,
          undefined, // scopePath
          undefined, // recursionLevel
          undefined, // includeContentMetadata
          undefined, // latestProcessedChange
          undefined, // download
          {
            versionType: 1, // GitVersionType.Commit
            version: commitId,
          }
        );

        if (!item || !item.content) {
          throw new ResourceNotFoundError('File', filePath);
        }

        const duration = Date.now() - startTime;
        this.recordMetric('get_file_content', duration, 200);

        this.logDebug('File content retrieved', {
          pullRequestId,
          filePath,
          commitId,
          contentLength: item.content.length,
        });

        return item.content;
      } catch (error) {
        const duration = Date.now() - startTime;
        this.recordMetric('get_file_content', duration, 500);
        throw error;
      }
    }, 'get_file_content');
  }

  /**
   * Verifica que las APIs estén disponibles
   */
  private ensureApi(): void {
    if (!this.connection || !this.gitApi) {
      throw new AzureDevOpsError(
        'Azure DevOps APIs not initialized. Call connect() first.',
        undefined,
        'API_NOT_INITIALIZED'
      );
    }
  }

  /**
   * Verifica si el cache es válido
   */
  private isCacheValid(key: string): boolean {
    if (!this.config.enableCache) {
      return false;
    }

    const timestamp = this.cacheTimestamps.get(key);
    if (!timestamp) {
      return false;
    }

    return Date.now() - timestamp < this.CACHE_TTL_MS;
  }

  /**
   * Establece timestamp del cache
   */
  private setCacheTimestamp(key: string): void {
    this.cacheTimestamps.set(key, Date.now());
  }

  /**
   * Maneja errores de API y los convierte a tipos específicos
   */
  private handleApiError(error: unknown, operation: string): Error {
    const message = error instanceof Error ? error.message : 'Unknown error';

    // Detectar rate limiting
    if (message.includes('429') || message.toLowerCase().includes('rate limit')) {
      return new RateLimitError(
        'Azure DevOps API rate limit exceeded',
        undefined,
        { operation, originalError: message }
      );
    }

    // Detectar errores 404
    if (message.includes('404') || message.toLowerCase().includes('not found')) {
      return new AzureDevOpsError(
        `Resource not found: ${operation}`,
        404,
        'NOT_FOUND',
        error
      );
    }

    // Error genérico
    return new AzureDevOpsError(
      `Azure DevOps API error in ${operation}: ${message}`,
      undefined,
      undefined,
      error
    );
  }

  /**
   * Registra métrica de performance
   */
  private recordMetric(
    operation: string,
    duration: number,
    statusCode: number,
    error?: Error
  ): void {
    const metric: PerformanceMetrics = {
      operation,
      api_call_duration: duration,
      api_calls_count: 1,
      rate_limit_hits: error instanceof RateLimitError ? 1 : 0,
      cache_hits: statusCode === 200 && duration === 0 ? 1 : 0,
      cache_misses: statusCode === 200 && duration > 0 ? 1 : 0,
      timestamp: new Date(),
    };

    this.metrics.push(metric);

    // Mantener solo las últimas 1000 métricas
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }
  }

  /**
   * Obtiene métricas de performance
   */
  getMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  /**
   * Limpia el cache
   */
  clearCache(): void {
    this.repositoryCache.clear();
    this.pullRequestCache.clear();
    this.cacheTimestamps.clear();
    this.logInfo('Cache cleared');
  }

  /**
   * Obtiene información de conexión
   */
  getConnectionInfo(): AzureDevOpsConnection | null {
    return this.connectionInfo;
  }

  /**
   * Desconecta del servicio
   */
  disconnect(): void {
    this.connection = null;
    this.gitApi = null;
    this.workItemApi = null;
    this.policyApi = null;
    this.connectionInfo = null;
    this.clearCache();
    this.logInfo('Disconnected from Azure DevOps');
  }

  // ============= Logging Methods =============

  private logDebug(message: string, metadata?: Record<string, any>): void {
    if (this.config.verbose) {
      this.log('debug', message, metadata);
    }
  }

  private logInfo(message: string, metadata?: Record<string, any>): void {
    this.log('info', message, metadata);
  }

  private logWarn(message: string, metadata?: Record<string, any>): void {
    this.log('warn', message, metadata);
  }

  private logError(message: string, error?: Error, metadata?: Record<string, any>): void {
    this.log('error', message, {
      ...metadata,
      error: error ? {
        message: error.message,
        stack: error.stack,
      } : undefined,
    });
  }

  private log(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    metadata?: Record<string, any>
  ): void {
    const logEntry: LogEntry = {
      timestamp: new Date(),
      level,
      operation: 'AzureDevOpsClient',
      metadata: this.redactSensitiveData(metadata),
    };

    // Use structured logger
    const logFn = level === 'error' ? logger.error :
                  level === 'warn' ? logger.warn :
                  level === 'debug' ? logger.debug : logger.info;
    logFn(message, { ...logEntry });
  }

  /**
   * Redacta información sensible de metadata para logging
   *
   * Implementa: Escenario 6.5.1 - PAT nunca debe aparecer en logs
   */
  private redactSensitiveData(metadata?: Record<string, any>): Record<string, any> | undefined {
    if (!metadata) {
      return undefined;
    }

    const redacted = { ...metadata };

    // Redactar PAT y tokens
    const sensitiveKeys = [
      'personalAccessToken',
      'pat',
      'token',
      'password',
      'secret',
      'apikey',
      'api_key',
    ];

    for (const key of Object.keys(redacted)) {
      if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
        redacted[key] = '***REDACTED***';
      }
    }

    return redacted;
  }
}
