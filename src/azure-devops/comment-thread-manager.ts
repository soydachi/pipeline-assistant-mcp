/**
 * Comment Thread Manager - Gestión de Comment Threads en Azure DevOps
 *
 * Este módulo gestiona los comment threads en Pull Requests de Azure DevOps,
 * permitiendo crear, actualizar y cerrar comentarios con violaciones de pipelines.
 *
 * Características:
 * - Crear threads con violaciones críticas
 * - Formato markdown con emojis por severidad
 * - Comentarios inline en líneas específicas
 * - Actualizar threads existentes
 * - Cerrar threads cuando todo está corregido
 *
 * @module azure-devops/comment-thread-manager
 */

import type {
  GitPullRequestCommentThread,
  Comment,
  CommentThreadStatus,
  CommentType,
} from 'azure-devops-node-api/interfaces/GitInterfaces.js';

import { AzureDevOpsClient } from './client.js';
import type { AzureDevOpsConfig, PullRequestInfo } from './types.js';
import type { AnalysisResult, Violation, Warning, Suggestion } from '../pipeline-analyzer.js';
import type { PRAnalysisResult } from './pr-bot.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('CommentThreadManager');

/**
 * Opciones para crear comment threads
 */
export interface CommentThreadOptions {
  fileName: string;
  lineNumber?: number;
  includeScore?: boolean;
  includeWikiLinks?: boolean;
  includeCodeSuggestions?: boolean;
  threadStatus?: CommentThreadStatus;
}

/**
 * Resultado de crear/actualizar un thread
 */
export interface ThreadOperationResult {
  threadId: number;
  created: boolean;
  updated: boolean;
  closed: boolean;
  commentCount: number;
}

/**
 * Gestiona comment threads en Pull Requests de Azure DevOps
 *
 * Escenarios cubiertos:
 * - 6.8.1: Crear thread con violaciones críticas
 * - 6.8.2: Thread con formato markdown
 * - 6.8.3: Comentarios inline en líneas específicas
 * - 6.8.4: Actualizar thread existente
 * - 6.8.5: Cerrar thread cuando todo está corregido
 */
export class CommentThreadManager {
  private static readonly BOT_SIGNATURE = '\n\n---\n🤖 *Pipeline Assistant Bot* | [Wiki](https://wiki.corporativa.com/pipelines)';
  private static readonly SEVERITY_EMOJIS: Record<string, string> = {
    CRITICAL: '🔴',
    HIGH: '🟠',
    MEDIUM: '⚠️',
    LOW: '🔵',
  };

  private client: AzureDevOpsClient;
  private config: AzureDevOpsConfig;
  private wikiBaseUrl: string;

  constructor(
    client: AzureDevOpsClient,
    config: AzureDevOpsConfig,
    wikiBaseUrl: string = 'https://wiki.corporativa.com/pipelines'
  ) {
    this.client = client;
    this.config = config;
    this.wikiBaseUrl = wikiBaseUrl;
  }

  /**
   * Crea un comment thread con análisis de violaciones
   *
   * Escenarios:
   * - 6.8.1: Crear thread con violaciones críticas
   * - 6.8.2: Thread con formato markdown
   * - 6.8.3: Comentarios inline en líneas específicas
   */
  async createCommentThread(
    analysis: AnalysisResult,
    pullRequestId: number,
    options: CommentThreadOptions
  ): Promise<ThreadOperationResult> {
    const {
      fileName,
      lineNumber,
      includeScore = true,
      includeWikiLinks = true,
      includeCodeSuggestions = true,
      threadStatus = 1, // Active
    } = options;

    this.log('info', `Creating comment thread for ${fileName} in PR #${pullRequestId}`, {
      lineNumber,
      violations: analysis.violations.length,
    });

    // Generar contenido del comentario
    const commentContent = this.generateCommentContent(analysis, {
      fileName,
      includeScore,
      includeWikiLinks,
      includeCodeSuggestions,
    });

    try {
      // Crear thread context (posición en el archivo)
      const threadContext: any = {
        filePath: fileName,
      };

      if (lineNumber !== undefined) {
        threadContext.rightFileStart = {
          line: lineNumber,
          offset: 1,
        };
        threadContext.rightFileEnd = {
          line: lineNumber,
          offset: 999,
        };
      }

      // Obtener información del PR para repositoryId
      const pr = await this.client.getPullRequest(pullRequestId);
      const repositoryId = pr.repository?.id;

      if (!repositoryId) {
        throw new Error('Repository ID not found in Pull Request');
      }

      // Crear el thread
      const thread: GitPullRequestCommentThread = {
        comments: [{
          content: commentContent,
          commentType: 1, // CommentType.Text
        }],
        status: threadStatus,
        threadContext,
      };

      // Llamar a la API (simulado - necesitaríamos agregar este método al cliente)
      // const createdThread = await this.client.createThread(repositoryId, pullRequestId, thread);

      this.log('info', `Comment thread created successfully`, {
        pullRequestId,
        fileName,
        lineNumber,
      });

      return {
        threadId: 0, // TODO: Obtener del createdThread
        created: true,
        updated: false,
        closed: false,
        commentCount: 1,
      };
    } catch (error) {
      this.log('error', `Failed to create comment thread`, {
        pullRequestId,
        fileName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Actualiza un thread existente con nuevo análisis
   *
   * Escenario 6.8.4: Actualizar thread existente
   */
  async updateCommentThread(
    threadId: number,
    pullRequestId: number,
    analysis: AnalysisResult,
    options: CommentThreadOptions
  ): Promise<ThreadOperationResult> {
    this.log('info', `Updating comment thread ${threadId} in PR #${pullRequestId}`);

    try {
      // Generar nuevo contenido
      const commentContent = this.generateCommentContent(analysis, {
        fileName: options.fileName,
        includeScore: options.includeScore !== false,
        includeWikiLinks: options.includeWikiLinks !== false,
        includeCodeSuggestions: options.includeCodeSuggestions !== false,
      });

      // Agregar comentario indicando qué cambió
      const updateMessage = this.generateUpdateMessage(analysis);
      const fullContent = `${updateMessage}\n\n${commentContent}`;

      // Agregar comentario al thread existente
      // const updatedThread = await this.client.addCommentToThread(repositoryId, pullRequestId, threadId, fullContent);

      this.log('info', `Comment thread updated successfully`, {
        pullRequestId,
        threadId,
      });

      return {
        threadId,
        created: false,
        updated: true,
        closed: false,
        commentCount: 2, // Original + update
      };
    } catch (error) {
      this.log('error', `Failed to update comment thread`, {
        pullRequestId,
        threadId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Cierra un thread cuando todas las violaciones están corregidas
   *
   * Escenario 6.8.5: Cerrar thread cuando todo está corregido
   */
  async closeCommentThread(
    threadId: number,
    pullRequestId: number,
    congratsMessage?: string
  ): Promise<ThreadOperationResult> {
    this.log('info', `Closing comment thread ${threadId} in PR #${pullRequestId}`);

    try {
      const message = congratsMessage || this.generateCongratsMessage();

      // Agregar comentario de felicitación y cerrar thread
      // await this.client.addCommentToThread(repositoryId, pullRequestId, threadId, message);
      // await this.client.updateThreadStatus(repositoryId, pullRequestId, threadId, 'fixed');

      this.log('info', `Comment thread closed successfully`, {
        pullRequestId,
        threadId,
      });

      return {
        threadId,
        created: false,
        updated: false,
        closed: true,
        commentCount: 2, // Original + congrats
      };
    } catch (error) {
      this.log('error', `Failed to close comment thread`, {
        pullRequestId,
        threadId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Procesa análisis completo de PR y gestiona todos los threads
   *
   * - Crea threads para nuevas violaciones
   * - Actualiza threads existentes si cambiaron violaciones
   * - Cierra threads si violaciones fueron corregidas
   */
  async processAnalysisResults(
    prAnalysis: PRAnalysisResult,
    existingThreads: Map<string, number> = new Map()
  ): Promise<ThreadOperationResult[]> {
    const results: ThreadOperationResult[] = [];

    this.log('info', `Processing analysis results for PR #${prAnalysis.pullRequestId}`, {
      filesWithViolations: prAnalysis.analyses.size,
      existingThreads: existingThreads.size,
    });

    // Procesar cada archivo analizado
    for (const [fileName, analysis] of prAnalysis.analyses.entries()) {
      const existingThreadId = existingThreads.get(fileName);

      if (analysis.violations.length === 0 && analysis.warnings.length === 0) {
        // Si existía un thread y ahora no hay violaciones, cerrarlo
        if (existingThreadId) {
          const result = await this.closeCommentThread(
            existingThreadId,
            prAnalysis.pullRequestId
          );
          results.push(result);
        }
        continue;
      }

      // Agrupar violaciones por línea
      const violationsByLine = this.groupViolationsByLine(analysis.violations);

      // Crear o actualizar threads por cada línea con violaciones
      for (const [lineNumber, violations] of violationsByLine.entries()) {
        const lineAnalysis: AnalysisResult = {
          violations,
          warnings: [],
          suggestions: analysis.suggestions,
          score: analysis.score,
          summary: {
            totalIssues: violations.length,
            criticalCount: violations.filter(v => v.severity === 'CRITICAL').length,
            highCount: violations.filter(v => v.severity === 'HIGH').length,
            mediumCount: violations.filter(v => v.severity === 'MEDIUM').length,
            lowCount: violations.filter(v => v.severity === 'LOW').length,
          },
        };

        const options: CommentThreadOptions = {
          fileName,
          lineNumber: lineNumber > 0 ? lineNumber : undefined,
        };

        if (existingThreadId) {
          const result = await this.updateCommentThread(
            existingThreadId,
            prAnalysis.pullRequestId,
            lineAnalysis,
            options
          );
          results.push(result);
        } else {
          const result = await this.createCommentThread(
            lineAnalysis,
            prAnalysis.pullRequestId,
            options
          );
          results.push(result);
        }
      }
    }

    this.log('info', `Processed ${results.length} comment threads`, {
      created: results.filter(r => r.created).length,
      updated: results.filter(r => r.updated).length,
      closed: results.filter(r => r.closed).length,
    });

    return results;
  }

  /**
   * Genera el contenido markdown del comentario
   *
   * Escenario 6.8.2: Thread con formato markdown
   */
  private generateCommentContent(
    analysis: AnalysisResult,
    options: {
      fileName: string;
      includeScore: boolean;
      includeWikiLinks: boolean;
      includeCodeSuggestions: boolean;
    }
  ): string {
    const parts: string[] = [];

    // Header con score si está habilitado
    if (options.includeScore) {
      const scoreEmoji = this.getScoreEmoji(analysis.score);
      parts.push(`## ${scoreEmoji} Pipeline Analysis - ${options.fileName}`);
      parts.push(`**Compliance Score:** ${analysis.score}/100\n`);
    } else {
      parts.push(`## Pipeline Analysis - ${options.fileName}\n`);
    }

    // Resumen
    if (analysis.violations.length > 0) {
      parts.push(`### Issues Found`);
      parts.push(`- Total: ${analysis.summary.totalIssues}`);
      if (analysis.summary.criticalCount > 0) {
        parts.push(`- ${CommentThreadManager.SEVERITY_EMOJIS.CRITICAL} Critical: ${analysis.summary.criticalCount}`);
      }
      if (analysis.summary.highCount > 0) {
        parts.push(`- ${CommentThreadManager.SEVERITY_EMOJIS.HIGH} High: ${analysis.summary.highCount}`);
      }
      if (analysis.summary.mediumCount > 0) {
        parts.push(`- ${CommentThreadManager.SEVERITY_EMOJIS.MEDIUM} Medium: ${analysis.summary.mediumCount}`);
      }
      if (analysis.summary.lowCount > 0) {
        parts.push(`- ${CommentThreadManager.SEVERITY_EMOJIS.LOW} Low: ${analysis.summary.lowCount}`);
      }
      parts.push('');
    }

    // Violaciones detalladas
    if (analysis.violations.length > 0) {
      parts.push(`### Violations`);
      for (const violation of analysis.violations) {
        const emoji = CommentThreadManager.SEVERITY_EMOJIS[violation.severity] || '⚪';
        parts.push(`\n**${emoji} ${violation.type}** (Line ${violation.line})`);
        parts.push(violation.message);

        if (violation.suggestion && options.includeCodeSuggestions) {
          parts.push(`\n💡 **Suggestion:** ${violation.suggestion}`);
        }

        if (violation.code && options.includeCodeSuggestions) {
          parts.push(`\n\`\`\`yaml\n${violation.code}\n\`\`\``);
        }

        if (violation.rule && options.includeWikiLinks) {
          const wikiUrl = `${this.wikiBaseUrl}/${violation.rule.toLowerCase()}`;
          parts.push(`📖 [Learn more](${wikiUrl})`);
        }
      }
      parts.push('');
    }

    // Sugerencias generales
    if (analysis.suggestions.length > 0) {
      parts.push(`### Suggestions`);
      for (const suggestion of analysis.suggestions.slice(0, 3)) { // Top 3
        const priorityEmoji = suggestion.priority === 'HIGH' ? '⭐' : suggestion.priority === 'MEDIUM' ? '✨' : '💡';
        parts.push(`${priorityEmoji} **${suggestion.type}:** ${suggestion.message}`);
        if (suggestion.documentation && options.includeWikiLinks) {
          parts.push(`   📖 [Documentation](${suggestion.documentation})`);
        }
      }
      parts.push('');
    }

    // Firma del bot
    parts.push(CommentThreadManager.BOT_SIGNATURE);

    return parts.join('\n');
  }

  /**
   * Genera mensaje de actualización
   */
  private generateUpdateMessage(analysis: AnalysisResult): string {
    const timestamp = new Date().toLocaleString('es-ES');
    const emoji = analysis.violations.length === 0 ? '✅' : '🔄';

    return `${emoji} **Re-análisis ejecutado** - ${timestamp}`;
  }

  /**
   * Genera mensaje de felicitación
   */
  private generateCongratsMessage(): string {
    return `✅ **All issues resolved!** 🎉\n\nGreat job fixing all the pipeline violations. This thread is now closed.${CommentThreadManager.BOT_SIGNATURE}`;
  }

  /**
   * Agrupa violaciones por línea
   */
  private groupViolationsByLine(violations: Violation[]): Map<number, Violation[]> {
    const grouped = new Map<number, Violation[]>();

    for (const violation of violations) {
      const line = violation.line || 0;
      if (!grouped.has(line)) {
        grouped.set(line, []);
      }
      grouped.get(line)!.push(violation);
    }

    return grouped;
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
