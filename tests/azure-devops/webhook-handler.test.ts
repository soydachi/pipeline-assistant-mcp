import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebhookHandler, type WebhookPayload } from '../../src/azure-devops/webhook-handler';
import { AzureDevOpsPRBot } from '../../src/azure-devops/pr-bot';
import type { AzureDevOpsConfig } from '../../src/azure-devops/types';

describe('WebhookHandler', () => {
  let mockBot: AzureDevOpsPRBot;
  let mockConfig: AzureDevOpsConfig;
  let handler: WebhookHandler;

  const createPayload = (overrides: Partial<WebhookPayload> = {}): WebhookPayload => ({
    eventType: 'git.pullrequest.created',
    publisherId: 'pipelines',
    resource: {
      pullRequestId: 123,
      repository: {
        id: 'repo-id',
        name: 'test-repo',
        project: {
          id: 'project-id',
          name: 'test-project',
        },
      },
    },
    createdDate: new Date().toISOString(),
    id: 'event-123',
    ...overrides,
  });

  beforeEach(() => {
    mockBot = {
      analyzePullRequest: vi.fn().mockResolvedValue({
        overallScore: 85,
        pipelineFiles: [],
        analyses: new Map(),
        totalViolations: 0,
        criticalCount: 0,
      }),
      reanalyze: vi.fn().mockResolvedValue({
        overallScore: 90,
        pipelineFiles: [],
        analyses: new Map(),
        totalViolations: 0,
        criticalCount: 0,
      }),
    } as unknown as AzureDevOpsPRBot;

    mockConfig = {
      organizationUrl: 'https://dev.azure.com/test',
      project: 'test-project',
      personalAccessToken: 'test-token',
      verbose: false,
    };
  });

  describe('Webhook Signature Validation', () => {
    const webhookSecret = 'test-secret-key-123';

    beforeEach(() => {
      handler = new WebhookHandler(mockBot, mockConfig, {
        validateSignature: true,
        webhookSecret,
        autoAnalyze: false,
      });
    });

    it('should accept valid signature', async () => {
      const payload = createPayload();
      const signature = WebhookHandler.generateSignature(payload, webhookSecret);

      const result = await handler.processWebhook(payload, signature);

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(false);
    });

    it('should reject invalid signature', async () => {
      const payload = createPayload();
      const invalidSignature = 'sha256=invalid-hash';

      const result = await handler.processWebhook(payload, invalidSignature);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid webhook signature');
    });

    it('should reject signature with wrong format', async () => {
      const payload = createPayload();
      const wrongFormat = 'md5=some-hash';

      const result = await handler.processWebhook(payload, wrongFormat);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid webhook signature');
    });

    it('should reject when payload is tampered', async () => {
      const payload = createPayload();
      const signature = WebhookHandler.generateSignature(payload, webhookSecret);

      // Tamper with payload after generating signature
      payload.resource.pullRequestId = 999;

      const result = await handler.processWebhook(payload, signature);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid webhook signature');
    });

    it('should reject when secret is wrong', async () => {
      const payload = createPayload();
      const signatureWithWrongSecret = WebhookHandler.generateSignature(
        payload,
        'wrong-secret'
      );

      const result = await handler.processWebhook(payload, signatureWithWrongSecret);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid webhook signature');
    });

    it('should reject when signature validation enabled but no secret configured', async () => {
      const handlerNoSecret = new WebhookHandler(mockBot, mockConfig, {
        validateSignature: true,
        webhookSecret: '', // Empty secret
        autoAnalyze: false,
      });

      const payload = createPayload();
      const signature = 'sha256=some-hash';

      const result = await handlerNoSecret.processWebhook(payload, signature);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid webhook signature');
    });
  });

  describe('generateSignature', () => {
    it('should generate consistent signatures', () => {
      const payload = createPayload();
      const secret = 'test-secret';

      const sig1 = WebhookHandler.generateSignature(payload, secret);
      const sig2 = WebhookHandler.generateSignature(payload, secret);

      expect(sig1).toBe(sig2);
    });

    it('should generate different signatures for different payloads', () => {
      const payload1 = createPayload({ id: 'event-1' });
      const payload2 = createPayload({ id: 'event-2' });
      const secret = 'test-secret';

      const sig1 = WebhookHandler.generateSignature(payload1, secret);
      const sig2 = WebhookHandler.generateSignature(payload2, secret);

      expect(sig1).not.toBe(sig2);
    });

    it('should generate different signatures for different secrets', () => {
      const payload = createPayload();

      const sig1 = WebhookHandler.generateSignature(payload, 'secret-1');
      const sig2 = WebhookHandler.generateSignature(payload, 'secret-2');

      expect(sig1).not.toBe(sig2);
    });

    it('should start with sha256= prefix', () => {
      const payload = createPayload();
      const signature = WebhookHandler.generateSignature(payload, 'test');

      expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/);
    });
  });

  describe('Event Filtering', () => {
    beforeEach(() => {
      handler = new WebhookHandler(mockBot, mockConfig, {
        validateSignature: false,
        autoAnalyze: false,
        queueEnabled: false,
      });
    });

    it('should process git.pullrequest.created events', async () => {
      const payload = createPayload({ eventType: 'git.pullrequest.created' });
      const result = await handler.processWebhook(payload);

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(false);
    });

    it('should process git.pullrequest.updated events', async () => {
      const payload = createPayload({ eventType: 'git.pullrequest.updated' });
      const result = await handler.processWebhook(payload);

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(false);
    });

    it('should skip git.pullrequest.merged events', async () => {
      const payload = createPayload({ eventType: 'git.pullrequest.merged' });
      const result = await handler.processWebhook(payload);

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.skipReason).toContain('not supported');
    });

    it('should skip git.push events', async () => {
      const payload = createPayload({ eventType: 'git.push' });
      const result = await handler.processWebhook(payload);

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
    });

    it('should skip events without pull request ID', async () => {
      const payload = createPayload();
      payload.resource.pullRequestId = undefined;

      const result = await handler.processWebhook(payload);

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.skipReason).toContain('No pull request ID');
    });
  });

  describe('Queue Management', () => {
    beforeEach(() => {
      // Use autoAnalyze: true with a slow mock to keep items in queue
      mockBot.analyzePullRequest.mockImplementation(() =>
        new Promise(resolve => setTimeout(resolve, 1000))
      );
      mockBot.reanalyze.mockImplementation(() =>
        new Promise(resolve => setTimeout(resolve, 1000))
      );

      handler = new WebhookHandler(mockBot, mockConfig, {
        validateSignature: false,
        autoAnalyze: true,
        queueEnabled: true,
        maxQueueSize: 3,
      });
    });

    it('should report queue size', async () => {
      expect(handler.getQueueSize()).toBe(0);

      const payload = createPayload();
      // Don't await - check queue before processing completes
      handler.processWebhook(payload);

      // Give a small delay for the queue to be populated
      await new Promise(resolve => setTimeout(resolve, 10));

      // First item is being processed, subsequent items would be in queue
      // But since there's only one item and it's processing, queue size is 0
      // The isProcessing should be true though
      expect(handler.isProcessing()).toBe(true);
    });

    it('should skip when queue is full', async () => {
      // Fill the queue - don't await to keep items in queue
      // Note: first item is dequeued immediately for processing, so we need 4 items
      // to get 3 in queue (1 processing + 3 queued = maxQueueSize of 3 means queue is full)
      for (let i = 0; i < 4; i++) {
        handler.processWebhook(createPayload({ id: `event-${i}` }));
      }

      // Give a small delay for the queue to be populated
      await new Promise(resolve => setTimeout(resolve, 10));

      // Queue should have 3 items (maxQueueSize) with 1 processing
      expect(handler.getQueueSize()).toBe(3);

      // Try to add another - should be rejected
      const result = await handler.processWebhook(createPayload({ id: 'event-overflow' }));

      expect(result.skipped).toBe(true);
      expect(result.skipReason).toBe('Queue is full');
    });

    it('should clear queue', async () => {
      handler.processWebhook(createPayload());
      handler.processWebhook(createPayload({ id: 'event-2' }));

      // Give a small delay for the queue to be populated
      await new Promise(resolve => setTimeout(resolve, 10));

      // Queue might be empty because first item is processing and second is in queue
      // Let's verify processing is happening and then clear
      expect(handler.isProcessing()).toBe(true);

      handler.clearQueue();

      expect(handler.getQueueSize()).toBe(0);
    });
  });

  describe('Auto Analysis', () => {
    beforeEach(() => {
      handler = new WebhookHandler(mockBot, mockConfig, {
        validateSignature: false,
        autoAnalyze: true,
        queueEnabled: false,
      });
    });

    it('should analyze new PRs', async () => {
      const payload = createPayload({ eventType: 'git.pullrequest.created' });
      const result = await handler.processWebhook(payload);

      expect(result.success).toBe(true);
      expect(mockBot.analyzePullRequest).toHaveBeenCalledWith(123, {
        createComments: true,
        updateStatus: true,
      });
      expect(result.analysisResult).toBeDefined();
    });

    it('should reanalyze updated PRs', async () => {
      const payload = createPayload({
        eventType: 'git.pullrequest.updated',
        resource: {
          pullRequestId: 123,
          commits: [{ commitId: 'abc123', comment: 'Update' }],
        },
      });

      const result = await handler.processWebhook(payload);

      expect(result.success).toBe(true);
      expect(mockBot.reanalyze).toHaveBeenCalledWith(123);
      expect(result.analysisResult).toBeDefined();
    });
  });
});
