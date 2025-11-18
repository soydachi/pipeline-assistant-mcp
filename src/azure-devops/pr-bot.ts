/**
 * Azure DevOps PR Bot - Análisis Automático de Pull Requests
 *
 * Este módulo implementa un bot que analiza Pull Requests en Azure DevOps,
 * detecta violaciones de pipelines y proporciona feedback automatizado.
 *
 * Características:
 * - Análisis automático de archivos de pipeline en PRs
 * - Comentarios inline con violaciones específicas
 * - Status checks para bloquear merge
 * - Modo learning vs enforcement
 * - Integración con PipelineAnalyzer existente
 * - Re-análisis automático tras pushes
 *
 * @module azure-devops/pr-bot
 */

import type {
  GitPullRequest,
  GitPullRequestChange,
  Comment as AzdoComment,
  CommentThread,
  CommentThreadStatus,
  GitPullRequestCommentThread,
} from 'azure-devops-node-api/interfaces/GitInterfaces.js';

import type {
  PullRequestStatus as PRStatus,
  GitStatusState,
} from 'azure-devops-node-api/interfaces/GitInterfaces.js';

import { AzureDevOpsClient } from './client.js';
import type { AzureDevOpsConfig, PullRequestInfo } from './types.js';
import type {
  PipelineAnalyzer,
  AnalysisResult,
  Violation,
  Warning,
  Suggestion
} from '../pipeline-analyzer.js';

/**
 * Resultado del análisis de un Pull Request
 */
export interface PRAnalysisResult {
  pullRequestId: number;
  repositoryId: string;
  pipelineFiles: string[];
  analyses: Map<string, AnalysisResult>;
  overallScore: number;
  totalViolations: number;
  criticalViolations: number;
  status: 'passed' | 'failed' | 'warning';
  timestamp: Date;
}

/**
 * Opciones para el análisis de PR
 */
export interface PRAnalysisOptions {
  strictMode?: boolean;
  enforcementMode?: 'learning' | 'enforcement';
  createComments?: boolean;
  updateStatus?: boolean;
  skipIfNoChanges?: boolean;
}

/**
 * Thread de comentario creado por el bot
 */
export interface BotCommentThread {
  threadId: number;
  fileName: string;
  lineNumber?: number;
  status: CommentThreadStatus;
  violationCount: number;
  lastUpdated: Date;
}

/**
 * Clase principal del PR Bot para Azure DevOps
 *
 * Escenarios cubiertos:
 * - 6.7.1: Inicialización del PR Bot
 * - 6.7.2: Análisis básico de PR
 * - 6.7.3: Análisis de PR sin pipelines
 * - 6.7.4: Análisis completo con violaciones
 * - 6.7.5: Análisis con pipeline válido
 */
export class AzureDevOpsPRBot {
  private client: AzureDevOpsClient;
  private analyzer: PipelineAnalyzer;
  private config: AzureDevOpsConfig;
  private activeThreads: Map<number, BotCommentThread[]> = new Map();

  /**
   * Constructor del PR Bot
   *
   * @param client Cliente de Azure DevOps configurado
   * @param analyzer Analizador de pipelines
   * @param config Configuración de Azure DevOps
   *
   * Escenario 6.7.1: Inicialización del PR Bot
   */
  constructor(
    client: AzureDevOpsClient,
    analyzer: PipelineAnalyzer,
    config: AzureDevOpsConfig
  ) {
    this.client = client;
    this.analyzer = analyzer;
    this.config = config;

    this.log('info', 'AzureDevOpsPRBot initialized', {
      enforcementMode: config.enforcementMode || 'learning',
      strictMode: config.strictMode || false,
    });
  }

  /**
   * Analiza un Pull Request completo
   *
   * @param pullRequestId ID del Pull Request a analizar
   * @param options Opciones de análisis
   * @returns Resultado del análisis del PR
   *
   * Escenarios:
   * - 6.7.2: Análisis básico de PR
   * - 6.7.3: Análisis de PR sin pipelines
   * - 6.7.4: Análisis completo con violaciones
   * - 6.7.5: Análisis con pipeline válido
   */
  async analyzePullRequest(
    pullRequestId: number,
    options: PRAnalysisOptions = {}
  ): Promise<PRAnalysisResult> {
    const {
      strictMode = this.config.strictMode || false,
      enforcementMode = this.config.enforcementMode || 'learning',
      createComments = true,
      updateStatus = true,
      skipIfNoChanges = true,
    } = options;

    this.log('info', `Starting PR analysis for PR #${pullRequestId}`, {
      strictMode,
      enforcementMode,
      createComments,
      updateStatus,
    });

    try {
      // 1. Obtener información del PR
      const pr = await this.client.getPullRequest(pullRequestId);

      if (!pr.repository?.id) {
        throw new Error(`Pull Request ${pullRequestId} does not have a repository ID`);
      }

      const repositoryId = pr.repository.id;

      // 2. Obtener archivos modificados en el PR
      const changes = await this.client.getPullRequestChanges(pullRequestId);

      // 3. Filtrar solo archivos de pipeline (*.yml, *.yaml)
      const pipelineFiles = this.filterPipelineFiles(changes);

      this.log('info', `Found ${pipelineFiles.length} pipeline files in PR #${pullRequestId}`, {
        files: pipelineFiles,
      });

      // Escenario 6.7.3: Análisis de PR sin pipelines
      if (pipelineFiles.length === 0) {
        this.log('info', `No pipeline files found in PR #${pullRequestId}, skipping analysis`);
        return this.createEmptyResult(pullRequestId, repositoryId);
      }

      // 4. Analizar cada archivo de pipeline
      const analyses = new Map<string, AnalysisResult>();
      let totalViolations = 0;
      let criticalViolations = 0;

      for (const filePath of pipelineFiles) {
        try {
          // Obtener contenido del archivo
          const content = await this.client.getFileContent(pullRequestId, filePath);

          // Analizar con PipelineAnalyzer
          const analysis = await this.analyzer.analyze(content, {
            strictMode,
            checkSecurity: true,
            checkPerformance: true,
            checkCompliance: true,
          });

          analyses.set(filePath, analysis);
          totalViolations += analysis.summary.totalIssues;
          criticalViolations += analysis.summary.criticalCount;

          this.log('info', `Analyzed ${filePath}`, {
            violations: analysis.violations.length,
            score: analysis.score,
          });
        } catch (error) {
          this.log('error', `Failed to analyze ${filePath}`, {
            error: error instanceof Error ? error.message : 'Unknown error',
          });

          // Agregar violación por error de parsing
          analyses.set(filePath, this.createErrorAnalysis(error));
          totalViolations++;
          criticalViolations++;
        }
      }

      // 5. Calcular score general del PR
      const overallScore = this.calculateOverallScore(analyses);

      // 6. Determinar status del PR
      const status = this.determinePRStatus(
        criticalViolations,
        totalViolations,
        enforcementMode
      );

      const result: PRAnalysisResult = {
        pullRequestId,
        repositoryId,
        pipelineFiles,
        analyses,
        overallScore,
        totalViolations,
        criticalViolations,
        status,
        timestamp: new Date(),
      };

      // 7. Crear comentarios si está habilitado
      if (createComments) {
        await this.createOrUpdateComments(result);
      }

      // 8. Actualizar status check si está habilitado
      if (updateStatus) {
        await this.updatePRStatusCheck(result);
      }

      this.log('info', `Completed PR analysis for PR #${pullRequestId}`, {
        overallScore,
        totalViolations,
        criticalViolations,
        status,
      });

      return result;
    } catch (error) {
      this.log('error', `Failed to analyze PR #${pullRequestId}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Filtra archivos de pipeline de una lista de cambios
   *
   * @param changes Cambios del Pull Request
   * @returns Lista de rutas de archivos de pipeline
   */
  private filterPipelineFiles(changes: GitPullRequestChange[]): string[] {
    const pipelineExtensions = ['.yml', '.yaml'];
    const pipelinePatterns = [
      /azure-pipelines.*\.ya?ml$/i,
      /\.azure-pipelines\/.*\.ya?ml$/i,
      /pipelines\/.*\.ya?ml$/i,
      /\.pipelines\/.*\.ya?ml$/i,
      /ci\/.*\.ya?ml$/i,
      /\.ci\/.*\.ya?ml$/i,
    ];

    return changes
      .filter(change => {
        const path = change.item?.path || '';

        // Verificar extensión
        const hasValidExtension = pipelineExtensions.some(ext =>
          path.toLowerCase().endsWith(ext)
        );

        if (!hasValidExtension) {
          return false;
        }

        // Verificar patrón de nombre
        return pipelinePatterns.some(pattern => pattern.test(path));
      })
      .map(change => change.item?.path || '')
      .filter(path => path.length > 0);
  }

  /**
   * Crea resultado vacío para PRs sin pipelines
   */
  private createEmptyResult(
    pullRequestId: number,
    repositoryId: string
  ): PRAnalysisResult {
    return {
      pullRequestId,
      repositoryId,
      pipelineFiles: [],
      analyses: new Map(),
      overallScore: 100,
      totalViolations: 0,
      criticalViolations: 0,
      status: 'passed',
      timestamp: new Date(),
    };
  }

  /**
   * Crea análisis de error cuando falla el parsing
   */
  private createErrorAnalysis(error: unknown): AnalysisResult {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return {
      violations: [{
        type: 'PARSING_ERROR',
        severity: 'CRITICAL',
        line: 0,
        message: `Failed to parse pipeline: ${errorMessage}`,
        rule: 'YAML_SYNTAX',
        suggestion: 'Check YAML syntax using a validator',
      }],
      warnings: [],
      suggestions: [{
        type: 'QUALITY',
        priority: 'HIGH',
        message: 'Use a YAML validator to check syntax',
        documentation: 'https://www.yamllint.com/',
      }],
      score: 0,
      summary: {
        totalIssues: 1,
        criticalCount: 1,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
      },
    };
  }

  /**
   * Calcula el score general del PR basado en todos los análisis
   */
  private calculateOverallScore(analyses: Map<string, AnalysisResult>): number {
    if (analyses.size === 0) {
      return 100;
    }

    const scores = Array.from(analyses.values()).map(a => a.score);
    const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;

    return Math.round(average);
  }

  /**
   * Determina el status del PR basado en violaciones y modo
   */
  private determinePRStatus(
    criticalViolations: number,
    totalViolations: number,
    enforcementMode: 'learning' | 'enforcement'
  ): 'passed' | 'failed' | 'warning' {
    // En modo learning, siempre pasa pero puede mostrar warning
    if (enforcementMode === 'learning') {
      return totalViolations > 0 ? 'warning' : 'passed';
    }

    // En modo enforcement, falla si hay violaciones críticas
    if (criticalViolations > 0) {
      return 'failed';
    }

    return totalViolations > 0 ? 'warning' : 'passed';
  }

  /**
   * Crea o actualiza comentarios en el PR
   *
   * Este método será implementado por CommentThreadManager
   */
  private async createOrUpdateComments(result: PRAnalysisResult): Promise<void> {
    // TODO: Implementar en siguiente escenario (6.8)
    this.log('info', 'Comment creation will be implemented in CommentThreadManager', {
      pullRequestId: result.pullRequestId,
      filesWithViolations: result.pipelineFiles.length,
    });
  }

  /**
   * Actualiza el status check del PR
   *
   * Este método será implementado por PRStatusManager
   */
  private async updatePRStatusCheck(result: PRAnalysisResult): Promise<void> {
    // TODO: Implementar en siguiente escenario (6.9)
    this.log('info', 'Status check update will be implemented in PRStatusManager', {
      pullRequestId: result.pullRequestId,
      status: result.status,
    });
  }

  /**
   * Re-analiza un PR (útil tras pushes)
   *
   * @param pullRequestId ID del Pull Request
   * @returns Resultado del re-análisis
   */
  async reanalyze(pullRequestId: number): Promise<PRAnalysisResult> {
    this.log('info', `Re-analyzing PR #${pullRequestId}`);

    return this.analyzePullRequest(pullRequestId, {
      skipIfNoChanges: false, // Forzar re-análisis
    });
  }

  /**
   * Obtiene el resultado del último análisis de un PR
   *
   * @param pullRequestId ID del Pull Request
   * @returns Threads activos del bot en ese PR
   */
  getActiveThreads(pullRequestId: number): BotCommentThread[] {
    return this.activeThreads.get(pullRequestId) || [];
  }

  /**
   * Logging estructurado
   */
  private log(
    level: 'info' | 'warn' | 'error',
    message: string,
    metadata?: Record<string, any>
  ): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      component: 'AzureDevOpsPRBot',
      message,
      ...metadata,
    };

    if (this.config.verbose) {
      console.log(JSON.stringify(logEntry));
    }
  }
}
