/**
 * Módulo de integración con Azure DevOps
 *
 * Este módulo proporciona toda la funcionalidad necesaria para
 * integrar Pipeline Assistant con Azure DevOps:
 *
 * - Cliente base para API de Azure DevOps
 * - Gestión de configuración
 * - Tipos TypeScript completos
 * - Análisis de Pull Requests
 * - Gestión de Work Items
 * - Branch Policies
 *
 * @module azure-devops
 */

// ============= Exports de Tipos =============
export * from './types.js';

// ============= Exports de Configuración =============
export {
  AzureDevOpsConfigManager,
  ConfigValidationError,
  createConfig,
  REQUIRED_PAT_SCOPES,
} from './config.js';

// ============= Exports de Cliente =============
export { AzureDevOpsClient } from './client.js';

// ============= Re-exports útiles de azure-devops-node-api =============
export type {
  GitRepository,
  GitPullRequest,
} from 'azure-devops-node-api/interfaces/GitInterfaces.js';

export type {
  WorkItem,
} from 'azure-devops-node-api/interfaces/WorkItemTrackingInterfaces.js';

export type {
  PolicyConfiguration,
} from 'azure-devops-node-api/interfaces/PolicyInterfaces.js';
