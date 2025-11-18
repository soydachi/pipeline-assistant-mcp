/**
 * Webhook Handler - Procesamiento de Eventos de Azure DevOps
 *
 * Este módulo maneja webhooks de Azure DevOps para análisis automático
 * de Pull Requests cuando se crean o actualizan.
 *
 * Características:
 * - Procesamiento de eventos pull request created/updated
 * - Filtrado de eventos irrelevantes
 * - Validación de firma de webhook (opcional)
 * - Re-análisis automático tras pushes
 * - Queue de procesamiento para evitar sobrecarga
 *
 * @module azure-devops/webhook-handler
 */

import * as crypto from 'crypto';
import { AzureDevOpsPRBot, type PRAnalysisResult } from './pr-bot.js';
import type { AzureDevOpsConfig } from './types.js';
import { createLogger } from '../utils/logger.js';
import {
  RateLimiter,
  createWebhookRateLimiter,
  type RateLimitResult,
} from '../utils/rate-limiter.js';

const logger = createLogger('WebhookHandler');

// Signature validation constants
const SIGNATURE_ALGORITHM = 'sha256';
const SIGNATURE_PREFIX = 'sha256=';

/**
 * Tipos de eventos de webhook soportados
 */
export type WebhookEventType =
  | 'git.pullrequest.created'
  | 'git.pullrequest.updated'
  | 'git.pullrequest.merged'
  | 'git.push';

/**
 * Payload de webhook de Azure DevOps
 */
export interface WebhookPayload {
  eventType: WebhookEventType;
  publisherId: string;
  scope?: string;
  message?: {
    text: string;
    html: string;
    markdown: string;
  };
  detailedMessage?: {
    text: string;
    html: string;
    markdown: string;
  };
  resource: {
    pullRequestId?: number;
    repository?: {
      id: string;
      name: string;
      project: {
        id: string;
        name: string;
      };
    };
    commits?: Array<{
      commitId: string;
      comment: string;
    }>;
    [key: string]: any;
  };
  createdDate: string;
  id: string;
  subscriptionId?: string;
}

/**
 * Resultado del procesamiento de webhook
 */
export interface WebhookProcessingResult {
  success: boolean;
  eventType: WebhookEventType;
  pullRequestId?: number;
  analysisResult?: PRAnalysisResult;
  skipped: boolean;
  skipReason?: string;
  error?: string;
  processingTimeMs: number;
  /** Rate limit information */
  rateLimit?: RateLimitResult;
}

/**
 * Opciones para el webhook handler
 */
export interface WebhookHandlerOptions {
  validateSignature?: boolean;
  webhookSecret?: string;
  skipNoChanges?: boolean;
  autoAnalyze?: boolean;
  queueEnabled?: boolean;
  maxQueueSize?: number;
  /** Enable rate limiting */
  rateLimitEnabled?: boolean;
  /** Max requests per minute per client */
  rateLimitPerMinute?: number;
}

/**
 * Clase para manejar webhooks de Azure DevOps
 *
 * Escenarios cubiertos:
 * - 6.13.1: Webhook para PR creado
 * - 6.13.2: Webhook para PR actualizado
 * - 6.13.3: Filtrar eventos irrelevantes
 */
export class WebhookHandler {
  private bot: AzureDevOpsPRBot;
  private config: AzureDevOpsConfig;
  private options: Required<WebhookHandlerOptions>;
  private processingQueue: WebhookPayload[] = [];
  private processing: boolean = false;
  private rateLimiter: RateLimiter | null = null;

  constructor(
    bot: AzureDevOpsPRBot,
    config: AzureDevOpsConfig,
    options: WebhookHandlerOptions = {}
  ) {
    this.bot = bot;
    this.config = config;
    this.options = {
      validateSignature: options.validateSignature || false,
      webhookSecret: options.webhookSecret || '',
      skipNoChanges: options.skipNoChanges !== false,
      autoAnalyze: options.autoAnalyze !== false,
      queueEnabled: options.queueEnabled !== false,
      maxQueueSize: options.maxQueueSize || 100,
      rateLimitEnabled: options.rateLimitEnabled || false,
      rateLimitPerMinute: options.rateLimitPerMinute || 30,
    };

    // Initialize rate limiter if enabled
    if (this.options.rateLimitEnabled) {
      this.rateLimiter = createWebhookRateLimiter({
        maxRequests: this.options.rateLimitPerMinute,
        name: 'webhook-handler',
      });
    }
  }

  /**
   * Procesa un evento de webhook
   *
   * Escenarios:
   * - 6.13.1: Webhook para PR creado
   * - 6.13.2: Webhook para PR actualizado
   * - 6.13.3: Filtrar eventos irrelevantes
   */
  async processWebhook(
    payload: WebhookPayload,
    signature?: string,
    clientId?: string
  ): Promise<WebhookProcessingResult> {
    const startTime = Date.now();

    this.log('info', `Processing webhook event: ${payload.eventType}`, {
      eventId: payload.id,
      pullRequestId: payload.resource.pullRequestId,
    });

    try {
      // Check rate limit if enabled
      let rateLimitResult: RateLimitResult | undefined;
      if (this.rateLimiter && clientId) {
        rateLimitResult = this.rateLimiter.checkLimit(clientId);
        if (!rateLimitResult.allowed) {
          return {
            success: false,
            eventType: payload.eventType,
            pullRequestId: payload.resource.pullRequestId,
            skipped: true,
            skipReason: 'Rate limit exceeded',
            processingTimeMs: Date.now() - startTime,
            rateLimit: rateLimitResult,
          };
        }
      }

      // Validar firma si está habilitado
      if (this.options.validateSignature && signature) {
        const isValid = this.validateWebhookSignature(payload, signature);
        if (!isValid) {
          return this.createErrorResult(
            payload,
            'Invalid webhook signature',
            startTime,
            rateLimitResult
          );
        }
      }

      // Filtrar eventos irrelevantes (Escenario 6.13.3)
      const shouldProcess = this.shouldProcessEvent(payload);
      if (!shouldProcess.process) {
        return this.createSkippedResult(
          payload,
          shouldProcess.reason || 'Event filtered out',
          startTime,
          rateLimitResult
        );
      }

      // Encolar o procesar directamente
      if (this.options.queueEnabled) {
        return this.enqueueWebhook(payload, startTime, rateLimitResult);
      }

      return await this.processWebhookInternal(payload, startTime, rateLimitResult);
    } catch (error) {
      this.log('error', 'Failed to process webhook', {
        eventId: payload.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return this.createErrorResult(
        payload,
        error instanceof Error ? error.message : 'Unknown error',
        startTime
      );
    }
  }

  /**
   * Procesa el webhook internamente
   */
  private async processWebhookInternal(
    payload: WebhookPayload,
    startTime: number,
    rateLimit?: RateLimitResult
  ): Promise<WebhookProcessingResult> {
    const pullRequestId = payload.resource.pullRequestId;

    if (!pullRequestId) {
      return this.createSkippedResult(
        payload,
        'No pull request ID in payload',
        startTime,
        rateLimit
      );
    }

    // Determinar si es creación o actualización
    const isCreated = payload.eventType === 'git.pullrequest.created';
    const isUpdated = payload.eventType === 'git.pullrequest.updated';

    this.log('info', `Processing ${isCreated ? 'new' : 'updated'} PR #${pullRequestId}`);

    // Analizar el PR si autoAnalyze está habilitado
    let analysisResult: PRAnalysisResult | undefined;

    if (this.options.autoAnalyze) {
      if (isCreated) {
        // Escenario 6.13.1: Webhook para PR creado
        analysisResult = await this.bot.analyzePullRequest(pullRequestId, {
          createComments: true,
          updateStatus: true,
        });
      } else if (isUpdated) {
        // Escenario 6.13.2: Webhook para PR actualizado
        // Re-analizar solo si hay cambios en archivos
        const hasFileChanges = this.detectFileChanges(payload);

        if (hasFileChanges) {
          analysisResult = await this.bot.reanalyze(pullRequestId);
        } else if (!this.options.skipNoChanges) {
          analysisResult = await this.bot.reanalyze(pullRequestId);
        } else {
          return this.createSkippedResult(
            payload,
            'No file changes detected',
            startTime,
            rateLimit
          );
        }
      }
    }

    const processingTimeMs = Date.now() - startTime;

    return {
      success: true,
      eventType: payload.eventType,
      pullRequestId,
      analysisResult,
      skipped: false,
      processingTimeMs,
      rateLimit,
    };
  }

  /**
   * Determina si un evento debe ser procesado
   *
   * Escenario 6.13.3: Filtrar eventos irrelevantes
   */
  private shouldProcessEvent(payload: WebhookPayload): {
    process: boolean;
    reason?: string;
  } {
    // Solo procesar eventos de Pull Requests
    const supportedEvents: WebhookEventType[] = [
      'git.pullrequest.created',
      'git.pullrequest.updated',
    ];

    if (!supportedEvents.includes(payload.eventType)) {
      return {
        process: false,
        reason: `Event type ${payload.eventType} not supported`,
      };
    }

    // Verificar que tenga Pull Request ID
    if (!payload.resource.pullRequestId) {
      return {
        process: false,
        reason: 'No pull request ID in payload',
      };
    }

    // Para eventos de actualización, verificar si hay cambios relevantes
    if (payload.eventType === 'git.pullrequest.updated') {
      const hasFileChanges = this.detectFileChanges(payload);

      if (!hasFileChanges && this.options.skipNoChanges) {
        return {
          process: false,
          reason: 'No file changes detected (update event)',
        };
      }
    }

    return { process: true };
  }

  /**
   * Detecta si hay cambios en archivos en el payload
   */
  private detectFileChanges(payload: WebhookPayload): boolean {
    // Azure DevOps incluye información de commits en el payload
    if (payload.resource.commits && payload.resource.commits.length > 0) {
      return true;
    }

    // Si no hay información de commits, asumir que hay cambios
    // (para ser conservadores)
    return true;
  }

  /**
   * Encola un webhook para procesamiento posterior
   */
  private enqueueWebhook(
    payload: WebhookPayload,
    startTime: number,
    rateLimit?: RateLimitResult
  ): WebhookProcessingResult {
    if (this.processingQueue.length >= this.options.maxQueueSize) {
      this.log('warn', 'Webhook queue is full, dropping event', {
        eventId: payload.id,
        queueSize: this.processingQueue.length,
      });

      return this.createSkippedResult(
        payload,
        'Queue is full',
        startTime,
        rateLimit
      );
    }

    this.processingQueue.push(payload);

    this.log('info', 'Webhook enqueued', {
      eventId: payload.id,
      queueSize: this.processingQueue.length,
    });

    // Iniciar procesamiento de la queue si no está activa
    if (!this.processing) {
      this.processQueue().catch(error => {
        this.log('error', 'Queue processing failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      });
    }

    return {
      success: true,
      eventType: payload.eventType,
      pullRequestId: payload.resource.pullRequestId,
      skipped: false,
      processingTimeMs: Date.now() - startTime,
      rateLimit,
    };
  }

  /**
   * Procesa la queue de webhooks
   */
  private async processQueue(): Promise<void> {
    if (this.processing) {
      return;
    }

    this.processing = true;

    while (this.processingQueue.length > 0) {
      const payload = this.processingQueue.shift();
      if (!payload) continue;

      try {
        await this.processWebhookInternal(payload, Date.now());
      } catch (error) {
        this.log('error', 'Failed to process queued webhook', {
          eventId: payload.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    this.processing = false;
  }

  /**
   * Valida la firma del webhook usando HMAC-SHA256
   *
   * @param payload - El payload del webhook
   * @param signature - La firma recibida en el header
   * @returns true si la firma es válida
   */
  private validateWebhookSignature(
    payload: WebhookPayload,
    signature: string
  ): boolean {
    if (!this.options.webhookSecret) {
      this.log('warn', 'Webhook signature validation enabled but no secret configured');
      return false;
    }

    // Validate signature format
    if (!signature.startsWith(SIGNATURE_PREFIX)) {
      this.log('warn', 'Invalid webhook signature format', {
        expected: `${SIGNATURE_PREFIX}<hash>`,
      });
      return false;
    }

    // Extract the hash from the signature
    const receivedHash = signature.slice(SIGNATURE_PREFIX.length);

    // Calculate expected signature using HMAC-SHA256
    const payloadString = JSON.stringify(payload);
    const expectedHash = crypto
      .createHmac(SIGNATURE_ALGORITHM, this.options.webhookSecret)
      .update(payloadString, 'utf8')
      .digest('hex');

    // Use timing-safe comparison to prevent timing attacks
    try {
      const receivedBuffer = Buffer.from(receivedHash, 'hex');
      const expectedBuffer = Buffer.from(expectedHash, 'hex');

      if (receivedBuffer.length !== expectedBuffer.length) {
        this.log('warn', 'Webhook signature length mismatch');
        return false;
      }

      const isValid = crypto.timingSafeEqual(receivedBuffer, expectedBuffer);

      if (!isValid) {
        this.log('warn', 'Webhook signature validation failed', {
          eventId: payload.id,
        });
      }

      return isValid;
    } catch (error) {
      this.log('error', 'Error validating webhook signature', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Generates a webhook signature for testing purposes
   *
   * @param payload - The webhook payload
   * @param secret - The webhook secret
   * @returns The signature in format "sha256=<hash>"
   */
  static generateSignature(payload: WebhookPayload, secret: string): string {
    const payloadString = JSON.stringify(payload);
    const hash = crypto
      .createHmac(SIGNATURE_ALGORITHM, secret)
      .update(payloadString, 'utf8')
      .digest('hex');
    return `${SIGNATURE_PREFIX}${hash}`;
  }

  /**
   * Crea resultado de error
   */
  private createErrorResult(
    payload: WebhookPayload,
    error: string,
    startTime: number,
    rateLimit?: RateLimitResult
  ): WebhookProcessingResult {
    return {
      success: false,
      eventType: payload.eventType,
      pullRequestId: payload.resource.pullRequestId,
      skipped: false,
      error,
      processingTimeMs: Date.now() - startTime,
      rateLimit,
    };
  }

  /**
   * Crea resultado de skip
   */
  private createSkippedResult(
    payload: WebhookPayload,
    reason: string,
    startTime: number,
    rateLimit?: RateLimitResult
  ): WebhookProcessingResult {
    return {
      success: true,
      eventType: payload.eventType,
      pullRequestId: payload.resource.pullRequestId,
      skipped: true,
      skipReason: reason,
      processingTimeMs: Date.now() - startTime,
      rateLimit,
    };
  }

  /**
   * Obtiene el tamaño actual de la queue
   */
  getQueueSize(): number {
    return this.processingQueue.length;
  }

  /**
   * Verifica si está procesando
   */
  isProcessing(): boolean {
    return this.processing;
  }

  /**
   * Limpia la queue
   */
  clearQueue(): void {
    this.processingQueue = [];
    this.log('info', 'Webhook queue cleared');
  }

  /**
   * Gets rate limit status for a client
   */
  getRateLimitStatus(clientId: string): RateLimitResult | null {
    if (!this.rateLimiter) {
      return null;
    }
    return this.rateLimiter.getStatus(clientId);
  }

  /**
   * Resets rate limit for a client
   */
  resetRateLimit(clientId: string): void {
    if (this.rateLimiter) {
      this.rateLimiter.reset(clientId);
    }
  }

  /**
   * Stops the webhook handler and cleans up resources
   */
  stop(): void {
    if (this.rateLimiter) {
      this.rateLimiter.stop();
    }
    this.clearQueue();
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
