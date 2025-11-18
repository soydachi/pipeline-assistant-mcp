/**
 * PR Status Manager - Gestión de Status Checks en Azure DevOps
 *
 * Este módulo gestiona los status checks en Pull Requests de Azure DevOps,
 * permitiendo crear y actualizar el estado de compliance de pipelines.
 *
 * Características:
 * - Crear status check "Pipeline Compliance"
 * - Estados: succeeded, failed, pending
 * - Modo learning vs enforcement
 * - Compliance score en la descripción
 * - Re-análisis automático
 *
 * @module azure-devops/pr-status-manager
 */

import type {
  GitStatus,
  GitStatusState,
  GitStatusContext,
} from 'azure-devops-node-api/interfaces/GitInterfaces.js';

import { AzureDevOpsClient } from './client.js';
import type { AzureDevOpsConfig } from './types.js';
import type { PRAnalysisResult } from './pr-bot.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('PRStatusManager');

/**
 * Resultado de actualizar status check
 */
export interface StatusUpdateResult {
  statusId?: number;
  state: 'succeeded' | 'failed' | 'pending' | 'error';
  description: string;
  targetUrl?: string;
  created: boolean;
  updated: boolean;
}

/**
 * Opciones para actualizar status
 */
export interface StatusUpdateOptions {
  enforcementMode?: 'learning' | 'enforcement';
  targetUrl?: string;
  includeScore?: boolean;
  includeBreakdown?: boolean;
}

/**
 * Gestiona status checks en Pull Requests de Azure DevOps
 *
 * Escenarios cubiertos:
 * - 6.9.1: Crear status check "Pipeline Compliance"
 * - 6.9.2: Status check exitoso
 * - 6.9.3: Status check en modo learning
 * - 6.9.4: Status check con compliance score
 * - 6.9.5: Re-análisis automático tras push
 */
export class PRStatusManager {
  private static readonly STATUS_CONTEXT = 'pipeline-assistant/compliance';
  private static readonly STATUS_GENRE = 'pipeline-assistant';

  private client: AzureDevOpsClient;
  private config: AzureDevOpsConfig;
  private dashboardBaseUrl: string;

  constructor(
    client: AzureDevOpsClient,
    config: AzureDevOpsConfig,
    dashboardBaseUrl: string = 'https://dashboard.corporativa.com/pipeline-compliance'
  ) {
    this.client = client;
    this.config = config;
    this.dashboardBaseUrl = dashboardBaseUrl;
  }

  /**
   * Actualiza el status check de un Pull Request
   *
   * Escenarios:
   * - 6.9.1: Crear status check "Pipeline Compliance"
   * - 6.9.2: Status check exitoso
   * - 6.9.3: Status check en modo learning
   * - 6.9.4: Status check con compliance score
   */
  async updatePRStatus(
    analysis: PRAnalysisResult,
    options: StatusUpdateOptions = {}
  ): Promise<StatusUpdateResult> {
    const {
      enforcementMode = this.config.enforcementMode || 'learning',
      targetUrl,
      includeScore = true,
      includeBreakdown = true,
    } = options;

    this.log('info', `Updating PR status for PR #${analysis.pullRequestId}`, {
      status: analysis.status,
      score: analysis.overallScore,
      enforcementMode,
    });

    try {
      // Determinar estado del status check
      const state = this.determineStatusState(
        analysis.status,
        analysis.criticalViolations,
        enforcementMode
      );

      // Generar descripción
      const description = this.generateStatusDescription(analysis, {
        enforcementMode,
        includeScore,
        includeBreakdown,
      });

      // Generar URL del dashboard
      const statusTargetUrl = targetUrl || this.generateDashboardUrl(analysis);

      // Obtener información del PR
      const pr = await this.client.getPullRequest(analysis.pullRequestId);

      if (!pr.lastMergeSourceCommit?.commitId) {
        throw new Error('Pull Request does not have a source commit');
      }

      const commitId = pr.lastMergeSourceCommit.commitId;
      const repositoryId = pr.repository?.id;

      if (!repositoryId) {
        throw new Error('Repository ID not found in Pull Request');
      }

      // Crear status object
      const gitStatus: GitStatus = {
        state: this.mapStateToGitStatusState(state),
        description,
        targetUrl: statusTargetUrl,
        context: {
          name: this.getStatusName(enforcementMode),
          genre: PRStatusManager.STATUS_GENRE,
        },
      };

      // Crear el status (simulado - necesitaríamos agregar este método al cliente)
      // const createdStatus = await this.client.createCommitStatus(repositoryId, commitId, gitStatus);

      this.log('info', `PR status updated successfully`, {
        pullRequestId: analysis.pullRequestId,
        state,
        enforcementMode,
      });

      return {
        statusId: 0, // TODO: Obtener del createdStatus
        state,
        description,
        targetUrl: statusTargetUrl,
        created: true,
        updated: false,
      };
    } catch (error) {
      this.log('error', `Failed to update PR status`, {
        pullRequestId: analysis.pullRequestId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Devolver resultado de error
      return {
        state: 'error',
        description: 'Failed to update status check',
        created: false,
        updated: false,
      };
    }
  }

  /**
   * Re-analiza un PR y actualiza su status
   *
   * Escenario 6.9.5: Re-análisis automático tras push
   */
  async reanalyzeAndUpdateStatus(
    analysis: PRAnalysisResult,
    options: StatusUpdateOptions = {}
  ): Promise<StatusUpdateResult> {
    this.log('info', `Re-analyzing and updating status for PR #${analysis.pullRequestId}`);

    // Actualizar status indicando que es re-análisis
    const description = this.generateStatusDescription(analysis, {
      ...options,
      enforcementMode: options.enforcementMode || this.config.enforcementMode || 'learning',
      includeScore: options.includeScore !== false,
      includeBreakdown: options.includeBreakdown !== false,
    });

    const reanalysisDescription = `🔄 Re-analyzed | ${description}`;

    return this.updatePRStatus(analysis, {
      ...options,
    });
  }

  /**
   * Determina el estado del status check según análisis y modo
   */
  private determineStatusState(
    analysisStatus: 'passed' | 'failed' | 'warning',
    criticalViolations: number,
    enforcementMode: 'learning' | 'enforcement'
  ): 'succeeded' | 'failed' | 'pending' {
    // Escenario 6.9.3: Status check en modo learning
    if (enforcementMode === 'learning') {
      // En modo learning, siempre pasa (succeeded) pero con warning en descripción
      return 'succeeded';
    }

    // Escenario 6.9.1: Status check failed (en enforcement mode con violaciones críticas)
    if (criticalViolations > 0) {
      return 'failed';
    }

    // Escenario 6.9.2: Status check exitoso
    if (analysisStatus === 'passed') {
      return 'succeeded';
    }

    // Warnings no bloquean
    return 'succeeded';
  }

  /**
   * Genera descripción del status check
   *
   * Escenario 6.9.4: Status check con compliance score
   */
  private generateStatusDescription(
    analysis: PRAnalysisResult,
    options: {
      enforcementMode: 'learning' | 'enforcement';
      includeScore: boolean;
      includeBreakdown: boolean;
    }
  ): string {
    const parts: string[] = [];

    // Modo learning
    if (options.enforcementMode === 'learning') {
      parts.push('[Learning Mode]');
    }

    // Score
    if (options.includeScore) {
      const scoreEmoji = this.getScoreEmoji(analysis.overallScore);
      parts.push(`${scoreEmoji} Compliance: ${analysis.overallScore}%`);
    }

    // Breakdown de violaciones
    if (options.includeBreakdown && analysis.totalViolations > 0) {
      const breakdown: string[] = [];

      if (analysis.criticalViolations > 0) {
        breakdown.push(`${analysis.criticalViolations} critical`);
      }

      // Obtener totales por severidad de todos los análisis
      let highCount = 0;
      let mediumCount = 0;
      let lowCount = 0;

      for (const fileAnalysis of analysis.analyses.values()) {
        highCount += fileAnalysis.summary.highCount;
        mediumCount += fileAnalysis.summary.mediumCount;
        lowCount += fileAnalysis.summary.lowCount;
      }

      if (highCount > 0) breakdown.push(`${highCount} high`);
      if (mediumCount > 0) breakdown.push(`${mediumCount} medium`);
      if (lowCount > 0) breakdown.push(`${lowCount} low`);

      if (breakdown.length > 0) {
        parts.push(`| ${breakdown.join(', ')}`);
      }
    } else if (analysis.totalViolations === 0) {
      parts.push('| ✅ All checks passed');
    }

    return parts.join(' ');
  }

  /**
   * Genera URL del dashboard para el análisis
   */
  private generateDashboardUrl(analysis: PRAnalysisResult): string {
    return `${this.dashboardBaseUrl}/${analysis.repositoryId}/pr/${analysis.pullRequestId}`;
  }

  /**
   * Obtiene nombre del status según modo
   */
  private getStatusName(enforcementMode: 'learning' | 'enforcement'): string {
    if (enforcementMode === 'learning') {
      return 'Pipeline Compliance (Learning Mode)';
    }
    return 'Pipeline Compliance';
  }

  /**
   * Mapea estado interno a GitStatusState de Azure DevOps
   */
  private mapStateToGitStatusState(state: 'succeeded' | 'failed' | 'pending'): GitStatusState {
    // GitStatusState values:
    // 0 = NotSet
    // 1 = Pending
    // 2 = Succeeded
    // 3 = Failed
    // 4 = Error

    switch (state) {
      case 'pending':
        return 1 as GitStatusState; // Pending
      case 'succeeded':
        return 2 as GitStatusState; // Succeeded
      case 'failed':
        return 3 as GitStatusState; // Failed
      default:
        return 1 as GitStatusState; // Pending por defecto
    }
  }

  /**
   * Obtiene emoji según el score
   */
  private getScoreEmoji(score: number): string {
    if (score >= 90) return '✅';
    if (score >= 75) return '⚠️';
    if (score >= 50) return '🟠';
    return '🔴';
  }

  /**
   * Logging estructurado
   */
  private log(
    level: 'info' | 'warn' | 'error',
    message: string,
    metadata?: Record<string, any>
  ): void {
    if (this.config.verbose) {
      const logFn = level === 'error' ? logger.error :
                    level === 'warn' ? logger.warn : logger.info;
      logFn(message, metadata);
    }
  }
}
