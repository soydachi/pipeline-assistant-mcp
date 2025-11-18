/**
 * Tipos TypeScript para integración con Azure DevOps
 *
 * Estos tipos complementan y extienden los tipos del SDK oficial de Azure DevOps
 * para proporcionar una API más conveniente y específica para Pipeline Assistant.
 *
 * @module azure-devops/types
 */

import type {
  GitPullRequest,
  GitPullRequestStatus as AzdoGitPullRequestStatus,
  Comment as AzdoComment,
  CommentThread as AzdoCommentThread,
  GitRepository,
  GitPullRequestChange,
  GitItem,
  CommentType,
  CommentThreadStatus,
  VersionControlChangeType,
} from 'azure-devops-node-api/interfaces/GitInterfaces.js';
import type {
  WorkItem,
  WorkItemReference as AzdoWorkItemReference,
} from 'azure-devops-node-api/interfaces/WorkItemTrackingInterfaces.js';
import type {
  PolicyConfiguration,
} from 'azure-devops-node-api/interfaces/PolicyInterfaces.js';

// ============= Configuration Types =============

/**
 * Configuración principal para conectarse a Azure DevOps
 */
export interface AzureDevOpsConfig {
  /**
   * URL de la organización de Azure DevOps
   * @example "https://dev.azure.com/myorg"
   */
  organizationUrl: string;

  /**
   * Personal Access Token para autenticación
   * Requiere scopes: vso.code, vso.work_write, vso.build
   */
  personalAccessToken: string;

  /**
   * Nombre del proyecto en Azure DevOps
   */
  project: string;

  /**
   * ID del repositorio (opcional, se puede inferir del nombre)
   */
  repositoryId?: string;

  /**
   * Nombre del repositorio
   */
  repository?: string;

  /**
   * Modo de enforcement de políticas
   * - learning: Informativo, no bloquea merge
   * - enforcement: Bloquea merge si hay violaciones críticas
   * @default "learning"
   */
  enforcementMode?: 'learning' | 'enforcement';

  /**
   * Modo estricto de validación
   * @default false
   */
  strictMode?: boolean;

  /**
   * Configuración de retry para llamadas API
   */
  retryPolicy?: RetryPolicyConfig;

  /**
   * Habilitar cache de conexiones
   * @default true
   */
  enableCache?: boolean;

  /**
   * Timeout para operaciones de API en ms
   * @default 30000
   */
  timeout?: number;

  /**
   * Habilitar logging detallado
   * @default false
   */
  verbose?: boolean;
}

/**
 * Configuración de política de reintentos
 */
export interface RetryPolicyConfig {
  /**
   * Número máximo de reintentos
   * @default 3
   */
  maxRetries: number;

  /**
   * Delay inicial en ms antes del primer reintento
   * @default 1000
   */
  retryDelayMs: number;

  /**
   * Multiplicador para backoff exponencial
   * @default 2
   */
  backoffMultiplier: number;

  /**
   * Códigos de status HTTP que deben reintentarse
   * @default [429, 500, 502, 503, 504]
   */
  retryableStatusCodes?: number[];
}

/**
 * Información de conexión establecida
 */
export interface AzureDevOpsConnection {
  organizationUrl: string;
  project: string;
  repositoryId: string;
  repositoryName: string;
  defaultBranch: string;
  isConnected: boolean;
  connectionDate: Date;
  lastActivity?: Date;
}

// ============= Pull Request Types =============

/**
 * Información extendida de Pull Request
 */
export interface PullRequestInfo extends GitPullRequest {
  /**
   * Score de compliance del pipeline (0-100)
   */
  complianceScore?: number;

  /**
   * Número de violaciones críticas encontradas
   */
  criticalViolations?: number;

  /**
   * Número de violaciones de alta prioridad
   */
  highViolations?: number;

  /**
   * Estado del análisis de Pipeline Assistant
   */
  pipelineAnalysisStatus?: 'pending' | 'analyzing' | 'completed' | 'failed';

  /**
   * Timestamp del último análisis
   */
  lastAnalysis?: Date;

  /**
   * Archivos YAML de pipeline modificados en este PR
   */
  pipelineFiles?: string[];
}

/**
 * Filtros para listar Pull Requests
 */
export interface PullRequestFilters {
  /**
   * Estado del PR
   */
  status?: 'active' | 'completed' | 'abandoned' | 'all';

  /**
   * Creador del PR
   */
  creatorId?: string;

  /**
   * Revisores asignados
   */
  reviewerId?: string;

  /**
   * Rama fuente
   */
  sourceRefName?: string;

  /**
   * Rama destino
   */
  targetRefName?: string;

  /**
   * Solo PRs con archivos de pipeline modificados
   */
  pipelineFilesOnly?: boolean;

  /**
   * Límite de resultados
   * @default 100
   */
  top?: number;

  /**
   * Skip para paginación
   */
  skip?: number;
}

// ============= Status Types =============

/**
 * Estado de PR para Pipeline Assistant
 */
export interface GitPullRequestStatus {
  /**
   * Estado del check
   */
  state: 'pending' | 'succeeded' | 'failed' | 'error' | 'notApplicable';

  /**
   * Descripción del estado
   */
  description: string;

  /**
   * URL con detalles del análisis
   */
  targetUrl?: string;

  /**
   * Contexto del status check
   */
  context: {
    /**
     * Nombre del status check
     * @example "pipeline-assistant/compliance"
     */
    name: string;

    /**
     * Género del check
     * @example "continuous-integration"
     */
    genre: string;
  };

  /**
   * Timestamp de creación
   */
  creationDate?: Date;

  /**
   * Timestamp de actualización
   */
  updatedDate?: Date;
}

// ============= Comment Thread Types =============

/**
 * Thread de comentarios en un PR
 */
export interface CommentThread extends AzdoCommentThread {
  /**
   * Comentarios del thread
   */
  comments?: Comment[];

  /**
   * Estado del thread
   */
  status?: CommentThreadStatus;

  /**
   * Contexto de ubicación del thread en el código
   */
  threadContext?: ThreadContext;

  /**
   * Propiedades personalizadas
   */
  properties?: {
    /**
     * Indica que fue creado por Pipeline Assistant
     */
    'pipeline-assistant'?: boolean;

    /**
     * Tipo de violación asociada
     */
    'violation-type'?: string;

    /**
     * Severidad de la violación
     */
    'severity'?: string;

    /**
     * ID de regla violada
     */
    'rule-id'?: string;

    [key: string]: any;
  };
}

/**
 * Comentario individual
 */
export interface Comment extends AzdoComment {
  /**
   * Contenido del comentario (Markdown)
   */
  content?: string;

  /**
   * Tipo de comentario
   */
  commentType?: CommentType;

  /**
   * Autor del comentario
   */
  author?: {
    id: string;
    displayName: string;
    uniqueName?: string;
    imageUrl?: string;
  };

  /**
   * Timestamp de publicación
   */
  publishedDate?: Date;

  /**
   * Timestamp de última actualización
   */
  lastUpdatedDate?: Date;

  /**
   * Si el comentario está activo
   */
  isDeleted?: boolean;
}

/**
 * Contexto de ubicación de un thread en el código
 */
export interface ThreadContext {
  /**
   * Ruta del archivo
   */
  filePath: string;

  /**
   * Lado del diff (izquierdo = base, derecho = cambio)
   */
  rightFileStart?: {
    line: number;
    offset: number;
  };

  /**
   * Fin del rango (para comentarios multi-línea)
   */
  rightFileEnd?: {
    line: number;
    offset: number;
  };

  /**
   * Contexto del lado izquierdo (base branch)
   */
  leftFileStart?: {
    line: number;
    offset: number;
  };

  leftFileEnd?: {
    line: number;
    offset: number;
  };
}

// ============= Policy Types =============

/**
 * Configuración de política de branch
 */
export interface BranchPolicyConfiguration extends Omit<PolicyConfiguration, 'isBlocking' | 'isEnabled' | 'settings'> {
  /**
   * Tipo de política
   */
  type?: {
    id: string;
    displayName?: string;
  };

  /**
   * Settings específicos de la política
   */
  settings?: {
    /**
     * Nombre del status check requerido
     */
    statusName?: string;

    /**
     * Género del status
     */
    statusGenre?: string;

    /**
     * ID del autor del status
     */
    authorId?: string;

    /**
     * Si se debe invalidar al actualizar el PR
     */
    invalidateOnUpdate?: boolean;

    /**
     * Scope de la política (branches afectados)
     */
    scope?: Array<{
      refName: string;
      matchKind: 'exact' | 'prefix';
      repositoryId?: string;
    }>;

    /**
     * Nombre a mostrar
     */
    displayName?: string;

    /**
     * Número mínimo de aprobaciones requeridas
     */
    minimumApprovalCount?: number;

    /**
     * Si creadores pueden aprobar sus propios PRs
     */
    creatorVoteCounts?: boolean;

    /**
     * Si se requiere que no haya votos de rechazo
     */
    blockLastPusherVote?: boolean;

    [key: string]: any;
  };

  /**
   * Si la política está habilitada
   */
  isEnabled?: boolean;

  /**
   * Si la política bloquea el merge
   */
  isBlocking?: boolean;

  /**
   * Si la política es eliminable
   */
  isDeleted?: boolean;
}

// ============= Work Item Types =============

/**
 * Referencia a Work Item
 */
export interface WorkItemReference extends Omit<AzdoWorkItemReference, 'id'> {
  /**
   * ID del work item
   */
  id?: string;

  /**
   * URL del work item
   */
  url?: string;

  /**
   * Tipo de work item (Bug, Task, User Story, etc.)
   */
  type?: string;

  /**
   * Título del work item
   */
  title?: string;

  /**
   * Estado del work item
   */
  state?: string;

  /**
   * Asignado a
   */
  assignedTo?: {
    id: string;
    displayName: string;
  };
}

/**
 * Configuración para crear un Work Item
 */
export interface WorkItemCreationConfig {
  /**
   * Tipo de work item a crear
   */
  type: 'Bug' | 'Task' | 'Issue' | 'User Story';

  /**
   * Título del work item
   */
  title: string;

  /**
   * Descripción (HTML o Markdown)
   */
  description: string;

  /**
   * Severidad (para Bugs)
   */
  severity?: '1 - Critical' | '2 - High' | '3 - Medium' | '4 - Low';

  /**
   * Prioridad
   */
  priority?: number;

  /**
   * Usuario asignado (ID o email)
   */
  assignedTo?: string;

  /**
   * Area path
   */
  areaPath?: string;

  /**
   * Iteration path
   */
  iterationPath?: string;

  /**
   * Tags
   */
  tags?: string[];

  /**
   * ID del PR relacionado
   */
  linkedPullRequestId?: number;

  /**
   * Información de la violación asociada
   */
  violation?: {
    type: string;
    severity: string;
    rule: string;
    line?: number;
    file?: string;
  };

  /**
   * Campos personalizados adicionales
   */
  customFields?: Record<string, any>;
}

// ============= File Change Types =============

/**
 * Cambio en archivo con información adicional
 */
export interface FileChange extends GitPullRequestChange {
  /**
   * Ruta del archivo
   */
  path: string;

  /**
   * Tipo de cambio
   */
  changeType?: VersionControlChangeType;

  /**
   * Ruta original (para renames)
   */
  originalPath?: string;

  /**
   * Contenido del archivo (si fue solicitado)
   */
  content?: string;

  /**
   * Si es un archivo de pipeline
   */
  isPipelineFile?: boolean;

  /**
   * Lenguaje del archivo
   */
  language?: string;

  /**
   * Tamaño del archivo en bytes
   */
  size?: number;
}

// ============= Analysis Result Types =============

/**
 * Resultado del análisis de un PR
 */
export interface PRAnalysisResult {
  /**
   * ID del Pull Request
   */
  pullRequestId: number;

  /**
   * Score global de compliance (0-100)
   */
  overallScore: number;

  /**
   * Análisis por archivo
   */
  files: FileAnalysis[];

  /**
   * Resumen de hallazgos
   */
  summary: AnalysisSummary;

  /**
   * Tendencia comparada con análisis anterior
   */
  trend?: AnalysisTrend;

  /**
   * Timestamp del análisis
   */
  analyzedAt: Date;

  /**
   * Duración del análisis en ms
   */
  duration: number;
}

/**
 * Análisis de un archivo individual
 */
export interface FileAnalysis {
  /**
   * Ruta del archivo
   */
  path: string;

  /**
   * Score de compliance del archivo (0-100)
   */
  score: number;

  /**
   * Violaciones encontradas
   */
  violations: Violation[];

  /**
   * Warnings encontrados
   */
  warnings: Warning[];

  /**
   * Sugerencias de mejora
   */
  suggestions: Suggestion[];

  /**
   * Tipo de proyecto detectado
   */
  projectType?: 'dotnet' | 'node' | 'python' | 'java' | 'go';
}

/**
 * Violación de política
 */
export interface Violation {
  /**
   * Tipo de violación
   */
  type: string;

  /**
   * Mensaje descriptivo
   */
  message: string;

  /**
   * Severidad
   */
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

  /**
   * Línea donde ocurre la violación
   */
  line?: number;

  /**
   * Columna donde ocurre la violación
   */
  column?: number;

  /**
   * ID de la regla violada
   */
  rule?: string;

  /**
   * Sugerencia de corrección
   */
  suggestion?: string;

  /**
   * Código sugerido para corregir
   */
  code?: string;

  /**
   * URL de documentación
   */
  documentation?: string;

  /**
   * Tags asociados
   */
  tags?: string[];
}

/**
 * Warning de análisis
 */
export interface Warning {
  /**
   * Tipo de warning
   */
  type: string;

  /**
   * Mensaje
   */
  message: string;

  /**
   * Severidad del warning
   */
  severity?: 'MEDIUM' | 'LOW';

  /**
   * Línea
   */
  line?: number;

  /**
   * Sugerencia
   */
  suggestion?: string;
}

/**
 * Sugerencia de mejora
 */
export interface Suggestion {
  /**
   * Tipo de sugerencia
   */
  type: 'SECURITY' | 'PERFORMANCE' | 'QUALITY' | 'COMPLIANCE';

  /**
   * Mensaje
   */
  message: string;

  /**
   * Descripción detallada
   */
  description?: string;

  /**
   * Prioridad
   */
  priority?: 'HIGH' | 'MEDIUM' | 'LOW';

  /**
   * Código sugerido
   */
  code?: string;

  /**
   * Estimación de impacto
   */
  impact?: string;
}

/**
 * Resumen del análisis
 */
export interface AnalysisSummary {
  /**
   * Total de archivos analizados
   */
  totalFiles: number;

  /**
   * Archivos con issues
   */
  filesWithIssues: number;

  /**
   * Número de violaciones críticas
   */
  criticalCount: number;

  /**
   * Número de violaciones altas
   */
  highCount: number;

  /**
   * Número de violaciones medias
   */
  mediumCount: number;

  /**
   * Número de violaciones bajas
   */
  lowCount: number;

  /**
   * Total de issues
   */
  totalIssues: number;
}

/**
 * Tendencia de análisis
 */
export interface AnalysisTrend {
  /**
   * Cambio en score vs análisis anterior
   */
  scoreChange: number;

  /**
   * Issues resueltos desde último análisis
   */
  issuesResolved: number;

  /**
   * Nuevos issues encontrados
   */
  newIssues: number;

  /**
   * Timestamp del análisis anterior
   */
  previousAnalysisDate?: Date;
}

// ============= Error Types =============

/**
 * Error de Azure DevOps con contexto adicional
 */
export class AzureDevOpsError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public errorCode?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AzureDevOpsError';
    Object.setPrototypeOf(this, AzureDevOpsError.prototype);
  }
}

/**
 * Error de autenticación
 */
export class AuthenticationError extends AzureDevOpsError {
  constructor(message: string, details?: any) {
    super(message, 401, 'AUTH_ERROR', details);
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/**
 * Error de permisos insuficientes
 */
export class InsufficientPermissionsError extends AzureDevOpsError {
  constructor(
    message: string,
    public requiredScopes: string[],
    details?: any
  ) {
    super(message, 403, 'INSUFFICIENT_PERMISSIONS', details);
    this.name = 'InsufficientPermissionsError';
    Object.setPrototypeOf(this, InsufficientPermissionsError.prototype);
  }
}

/**
 * Error de recurso no encontrado
 */
export class ResourceNotFoundError extends AzureDevOpsError {
  constructor(
    public resourceType: string,
    public resourceId: string,
    details?: any
  ) {
    super(
      `${resourceType} '${resourceId}' not found`,
      404,
      'RESOURCE_NOT_FOUND',
      details
    );
    this.name = 'ResourceNotFoundError';
    Object.setPrototypeOf(this, ResourceNotFoundError.prototype);
  }
}

/**
 * Error de rate limiting
 */
export class RateLimitError extends AzureDevOpsError {
  constructor(
    message: string,
    public retryAfter?: number,
    details?: any
  ) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', details);
    this.name = 'RateLimitError';
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

// ============= Logging Types =============

/**
 * Estructura de log
 */
export interface LogEntry {
  /**
   * Timestamp del log
   */
  timestamp: Date;

  /**
   * Nivel de log
   */
  level: 'debug' | 'info' | 'warn' | 'error';

  /**
   * Operación realizada
   */
  operation: string;

  /**
   * Duración de la operación en ms
   */
  duration?: number;

  /**
   * Código de status HTTP
   */
  statusCode?: number;

  /**
   * Error si ocurrió
   */
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };

  /**
   * Metadata adicional
   */
  metadata?: Record<string, any>;
}

/**
 * Métricas de performance
 */
export interface PerformanceMetrics {
  /**
   * Duración de llamada API en ms
   */
  api_call_duration: number;

  /**
   * Contador de llamadas API
   */
  api_calls_count: number;

  /**
   * Hits de rate limit
   */
  rate_limit_hits: number;

  /**
   * Cache hits
   */
  cache_hits: number;

  /**
   * Cache misses
   */
  cache_misses: number;

  /**
   * Timestamp de la métrica
   */
  timestamp: Date;

  /**
   * Operación medida
   */
  operation: string;
}

// ============= Utility Types =============

/**
 * Opciones para análisis de pipeline
 */
export interface AnalysisOptions {
  /**
   * Modo estricto
   */
  strictMode?: boolean;

  /**
   * Tipo de proyecto
   */
  projectType?: 'dotnet' | 'node' | 'python' | 'java' | 'go';

  /**
   * Verificar seguridad
   */
  checkSecurity?: boolean;

  /**
   * Verificar performance
   */
  checkPerformance?: boolean;

  /**
   * Verificar compliance
   */
  checkCompliance?: boolean;

  /**
   * Incluir sugerencias
   */
  includeSuggestions?: boolean;
}

/**
 * Configuración para crear comentario
 */
export interface CommentCreationConfig {
  /**
   * Contenido del comentario (Markdown)
   */
  content: string;

  /**
   * Ubicación del comentario
   */
  threadContext?: ThreadContext;

  /**
   * Estado inicial del thread
   */
  status?: 'active' | 'pending';

  /**
   * Propiedades personalizadas
   */
  properties?: Record<string, any>;

  /**
   * Si el thread debe estar activo
   */
  isActive?: boolean;
}
