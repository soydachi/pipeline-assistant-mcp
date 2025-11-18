/**
 * Tests para Azure DevOps PR Bot
 *
 * Cubre escenarios 6.7 - 6.13 de Fase 2
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AzureDevOpsPRBot } from '../../src/azure-devops/pr-bot.js';
import { AzureDevOpsClient } from '../../src/azure-devops/client.js';
import { PipelineAnalyzer } from '../../src/pipeline-analyzer.js';
import type { AzureDevOpsConfig } from '../../src/azure-devops/types.js';
import type { AnalysisResult } from '../../src/pipeline-analyzer.js';

// Mock del cliente
vi.mock('../../src/azure-devops/client.js');

// Mock del analyzer
vi.mock('../../src/pipeline-analyzer.js');

describe('AzureDevOpsPRBot - Fase 2', () => {
  let bot: AzureDevOpsPRBot;
  let mockClient: any;
  let mockAnalyzer: any;
  let mockConfig: AzureDevOpsConfig;

  beforeEach(() => {
    mockConfig = {
      organizationUrl: 'https://dev.azure.com/testorg',
      personalAccessToken: 'test-pat',
      project: 'TestProject',
      repository: 'test-repo',
      enforcementMode: 'learning',
      strictMode: false,
      enableCache: true,
      verbose: false,
    };

    // Mock del cliente
    mockClient = {
      getPullRequest: vi.fn(),
      getPullRequestChanges: vi.fn(),
      getFileContent: vi.fn(),
    };

    // Mock del analyzer
    mockAnalyzer = {
      analyze: vi.fn(),
    };

    bot = new AzureDevOpsPRBot(mockClient, mockAnalyzer, mockConfig);
  });

  describe('Escenario 6.7.1: Inicialización del PR Bot', () => {
    it('debe inicializar el bot correctamente', () => {
      // When: Crear nueva instancia del bot
      const newBot = new AzureDevOpsPRBot(mockClient, mockAnalyzer, mockConfig);

      // Then: Debe estar inicializado
      expect(newBot).toBeDefined();
    });

    it('debe tener acceso al cliente de Azure DevOps', () => {
      // Then: Debe tener cliente configurado
      expect((bot as any).client).toBe(mockClient);
    });

    it('debe tener acceso al analizador de pipelines', () => {
      // Then: Debe tener analyzer configurado
      expect((bot as any).analyzer).toBe(mockAnalyzer);
    });
  });

  describe('Escenario 6.7.2: Análisis básico de PR', () => {
    it('debe obtener lista de archivos modificados en el PR', async () => {
      // Given: PR con archivos modificados
      mockClient.getPullRequest.mockResolvedValue({
        pullRequestId: 123,
        repository: { id: 'repo-123' },
      });

      mockClient.getPullRequestChanges.mockResolvedValue([
        { item: { path: '/azure-pipelines.yml' } },
        { item: { path: '/src/app.ts' } },
      ]);

      mockClient.getFileContent.mockResolvedValue('trigger: main');

      mockAnalyzer.analyze.mockResolvedValue({
        violations: [],
        warnings: [],
        suggestions: [],
        score: 100,
        summary: {
          totalIssues: 0,
          criticalCount: 0,
          highCount: 0,
          mediumCount: 0,
          lowCount: 0,
        },
      });

      // When: Analizar PR
      const result = await bot.analyzePullRequest(123);

      // Then: Debe haber obtenido archivos modificados
      expect(mockClient.getPullRequestChanges).toHaveBeenCalledWith(123);
      expect(result.pullRequestId).toBe(123);
    });

    it('debe filtrar solo archivos de pipeline', async () => {
      // Given: PR con mix de archivos
      mockClient.getPullRequest.mockResolvedValue({
        pullRequestId: 124,
        repository: { id: 'repo-123' },
      });

      mockClient.getPullRequestChanges.mockResolvedValue([
        { item: { path: '/azure-pipelines.yml' } },
        { item: { path: '/src/app.ts' } }, // No es pipeline
        { item: { path: '/.azure-pipelines/build.yml' } },
        { item: { path: '/README.md' } }, // No es pipeline
      ]);

      mockClient.getFileContent.mockResolvedValue('trigger: main');

      mockAnalyzer.analyze.mockResolvedValue({
        violations: [],
        warnings: [],
        suggestions: [],
        score: 100,
        summary: { totalIssues: 0, criticalCount: 0, highCount: 0, mediumCount: 0, lowCount: 0 },
      });

      // When: Analizar PR
      const result = await bot.analyzePullRequest(124);

      // Then: Debe haber filtrado solo archivos de pipeline
      expect(result.pipelineFiles).toHaveLength(2);
      expect(result.pipelineFiles).toContain('/azure-pipelines.yml');
      expect(result.pipelineFiles).toContain('/.azure-pipelines/build.yml');
      expect(result.pipelineFiles).not.toContain('/src/app.ts');
      expect(result.pipelineFiles).not.toContain('/README.md');
    });

    it('debe devolver archivos de pipeline encontrados', async () => {
      // Given: PR con pipeline
      mockClient.getPullRequest.mockResolvedValue({
        pullRequestId: 125,
        repository: { id: 'repo-123' },
      });

      mockClient.getPullRequestChanges.mockResolvedValue([
        { item: { path: '/azure-pipelines.yml' } },
      ]);

      mockClient.getFileContent.mockResolvedValue('trigger: main');

      mockAnalyzer.analyze.mockResolvedValue({
        violations: [],
        warnings: [],
        suggestions: [],
        score: 100,
        summary: { totalIssues: 0, criticalCount: 0, highCount: 0, mediumCount: 0, lowCount: 0 },
      });

      // When: Analizar PR
      const result = await bot.analyzePullRequest(125);

      // Then: Debe retornar archivos de pipeline
      expect(result.pipelineFiles).toEqual(['/azure-pipelines.yml']);
    });
  });

  describe('Escenario 6.7.3: Análisis de PR sin pipelines', () => {
    it('debe retornar lista vacía de pipelines', async () => {
      // Given: PR sin archivos de pipeline
      mockClient.getPullRequest.mockResolvedValue({
        pullRequestId: 126,
        repository: { id: 'repo-123' },
      });

      mockClient.getPullRequestChanges.mockResolvedValue([
        { item: { path: '/src/app.ts' } },
        { item: { path: '/README.md' } },
      ]);

      // When: Analizar PR
      const result = await bot.analyzePullRequest(126);

      // Then: Debe retornar lista vacía
      expect(result.pipelineFiles).toHaveLength(0);
      expect(result.analyses.size).toBe(0);
    });

    it('NO debe crear ningún comment thread', async () => {
      // Given: PR sin pipelines
      mockClient.getPullRequest.mockResolvedValue({
        pullRequestId: 127,
        repository: { id: 'repo-123' },
      });

      mockClient.getPullRequestChanges.mockResolvedValue([
        { item: { path: '/src/app.ts' } },
      ]);

      // When: Analizar PR con createComments habilitado
      const result = await bot.analyzePullRequest(127, {
        createComments: true,
      });

      // Then: No debe haber llamado a crear comentarios
      expect(result.pipelineFiles).toHaveLength(0);
    });

    it('debe retornar resultado indicando que no hay pipelines', async () => {
      // Given: PR sin pipelines
      const verboseConfig = { ...mockConfig, verbose: true };
      const verboseBot = new AzureDevOpsPRBot(mockClient, mockAnalyzer, verboseConfig);

      mockClient.getPullRequest.mockResolvedValue({
        pullRequestId: 128,
        repository: { id: 'repo-123' },
      });

      mockClient.getPullRequestChanges.mockResolvedValue([]);

      // When: Analizar PR
      const result = await verboseBot.analyzePullRequest(128);

      // Then: El resultado debe indicar que no hay pipelines
      expect(result.pipelineFiles).toHaveLength(0);
      expect(result.analyses.size).toBe(0);
      expect(result.overallScore).toBe(100); // Score perfecto cuando no hay pipelines
    });
  });

  describe('Escenario 6.7.4: Análisis completo con violaciones', () => {
    it('debe analizar contenido del pipeline', async () => {
      // Given: PR con pipeline que tiene violaciones
      mockClient.getPullRequest.mockResolvedValue({
        pullRequestId: 129,
        repository: { id: 'repo-123' },
      });

      mockClient.getPullRequestChanges.mockResolvedValue([
        { item: { path: '/azure-pipelines.yml' } },
      ]);

      mockClient.getFileContent.mockResolvedValue('trigger: main\nsteps: []');

      const mockAnalysis: AnalysisResult = {
        violations: [
          {
            type: 'MISSING_REQUIRED_TASK',
            severity: 'CRITICAL',
            line: 5,
            message: 'Missing required security scan task',
            rule: 'SECURITY_SCAN_REQUIRED',
          },
          {
            type: 'INSECURE_CONFIG',
            severity: 'CRITICAL',
            line: 10,
            message: 'Secrets in plaintext',
            rule: 'NO_PLAINTEXT_SECRETS',
          },
          {
            type: 'OUTDATED_TASK',
            severity: 'HIGH',
            line: 15,
            message: 'Using outdated task version',
            rule: 'TASK_VERSION',
          },
        ],
        warnings: [],
        suggestions: [],
        score: 40,
        summary: {
          totalIssues: 3,
          criticalCount: 2,
          highCount: 1,
          mediumCount: 0,
          lowCount: 0,
        },
      };

      mockAnalyzer.analyze.mockResolvedValue(mockAnalysis);

      // When: Analizar PR
      const result = await bot.analyzePullRequest(129);

      // Then: Debe detectar las 3 violaciones críticas
      expect(result.totalViolations).toBe(3);
      expect(result.criticalViolations).toBe(2);
    });

    it('debe calcular compliance score', async () => {
      // Given: PR con violaciones
      mockClient.getPullRequest.mockResolvedValue({
        pullRequestId: 130,
        repository: { id: 'repo-123' },
      });

      mockClient.getPullRequestChanges.mockResolvedValue([
        { item: { path: '/azure-pipelines.yml' } },
      ]);

      mockClient.getFileContent.mockResolvedValue('trigger: main');

      mockAnalyzer.analyze.mockResolvedValue({
        violations: [
          { type: 'TEST', severity: 'CRITICAL', line: 1, message: 'Test' },
        ],
        warnings: [],
        suggestions: [],
        score: 60,
        summary: { totalIssues: 1, criticalCount: 1, highCount: 0, mediumCount: 0, lowCount: 0 },
      });

      // When: Analizar PR
      const result = await bot.analyzePullRequest(130);

      // Then: Debe tener score calculado
      expect(result.overallScore).toBe(60);
    });

    it('debe devolver resultado del análisis con violaciones', async () => {
      // Given: PR con pipeline
      mockClient.getPullRequest.mockResolvedValue({
        pullRequestId: 131,
        repository: { id: 'repo-123' },
      });

      mockClient.getPullRequestChanges.mockResolvedValue([
        { item: { path: '/azure-pipelines.yml' } },
      ]);

      mockClient.getFileContent.mockResolvedValue('trigger: main');

      mockAnalyzer.analyze.mockResolvedValue({
        violations: [
          { type: 'TEST', severity: 'CRITICAL', line: 1, message: 'Test violation' },
        ],
        warnings: [],
        suggestions: [],
        score: 50,
        summary: { totalIssues: 1, criticalCount: 1, highCount: 0, mediumCount: 0, lowCount: 0 },
      });

      // When: Analizar PR
      const result = await bot.analyzePullRequest(131);

      // Then: Debe tener análisis con violaciones
      expect(result.analyses.size).toBe(1);
      expect(result.analyses.get('/azure-pipelines.yml')?.violations).toHaveLength(1);
      expect(result.analyses.get('/azure-pipelines.yml')?.violations[0].message).toBe('Test violation');
    });
  });

  describe('Escenario 6.7.5: Análisis con pipeline válido', () => {
    it('debe analizar pipeline sin violaciones', async () => {
      // Given: PR con pipeline válido
      mockClient.getPullRequest.mockResolvedValue({
        pullRequestId: 132,
        repository: { id: 'repo-123' },
      });

      mockClient.getPullRequestChanges.mockResolvedValue([
        { item: { path: '/azure-pipelines.yml' } },
      ]);

      mockClient.getFileContent.mockResolvedValue('trigger: main\ntasks: []');

      mockAnalyzer.analyze.mockResolvedValue({
        violations: [],
        warnings: [],
        suggestions: [],
        score: 100,
        summary: { totalIssues: 0, criticalCount: 0, highCount: 0, mediumCount: 0, lowCount: 0 },
      });

      // When: Analizar PR
      const result = await bot.analyzePullRequest(132);

      // Then: Compliance score debe ser 100
      expect(result.overallScore).toBe(100);
    });

    it('debe retornar resultado exitoso sin violaciones', async () => {
      // Given: Pipeline perfecto
      mockClient.getPullRequest.mockResolvedValue({
        pullRequestId: 133,
        repository: { id: 'repo-123' },
      });

      mockClient.getPullRequestChanges.mockResolvedValue([
        { item: { path: '/azure-pipelines.yml' } },
      ]);

      mockClient.getFileContent.mockResolvedValue('trigger: main');

      mockAnalyzer.analyze.mockResolvedValue({
        violations: [],
        warnings: [],
        suggestions: [],
        score: 100,
        summary: { totalIssues: 0, criticalCount: 0, highCount: 0, mediumCount: 0, lowCount: 0 },
      });

      // When: Analizar PR
      const result = await bot.analyzePullRequest(133);

      // Then: Debe ser exitoso
      expect(result.status).toBe('passed');
      expect(result.totalViolations).toBe(0);
      expect(result.criticalViolations).toBe(0);
    });
  });

  describe('Integración con PipelineAnalyzer (6.10)', () => {
    it('debe usar PipelineAnalyzer existente (6.10.1)', async () => {
      // Given: Bot con analyzer configurado
      mockClient.getPullRequest.mockResolvedValue({
        pullRequestId: 134,
        repository: { id: 'repo-123' },
      });

      mockClient.getPullRequestChanges.mockResolvedValue([
        { item: { path: '/azure-pipelines.yml' } },
      ]);

      mockClient.getFileContent.mockResolvedValue('trigger: main');

      mockAnalyzer.analyze.mockResolvedValue({
        violations: [],
        warnings: [],
        suggestions: [],
        score: 100,
        summary: { totalIssues: 0, criticalCount: 0, highCount: 0, mediumCount: 0, lowCount: 0 },
      });

      // When: Analizar PR
      await bot.analyzePullRequest(134);

      // Then: Debe usar el analyzer
      expect(mockAnalyzer.analyze).toHaveBeenCalled();
    });

    it('debe pasar strictMode al analyzer (6.10.2)', async () => {
      // Given: Análisis con strict mode
      mockClient.getPullRequest.mockResolvedValue({
        pullRequestId: 135,
        repository: { id: 'repo-123' },
      });

      mockClient.getPullRequestChanges.mockResolvedValue([
        { item: { path: '/azure-pipelines.yml' } },
      ]);

      mockClient.getFileContent.mockResolvedValue('trigger: main');

      mockAnalyzer.analyze.mockResolvedValue({
        violations: [],
        warnings: [],
        suggestions: [],
        score: 100,
        summary: { totalIssues: 0, criticalCount: 0, highCount: 0, mediumCount: 0, lowCount: 0 },
      });

      // When: Analizar con strict mode
      await bot.analyzePullRequest(135, { strictMode: true });

      // Then: Debe pasar strictMode = true
      expect(mockAnalyzer.analyze).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ strictMode: true })
      );
    });
  });

  describe('Re-análisis (6.9.5)', () => {
    it('debe ejecutar re-análisis de PR', async () => {
      // Given: PR previamente analizado
      mockClient.getPullRequest.mockResolvedValue({
        pullRequestId: 136,
        repository: { id: 'repo-123' },
      });

      mockClient.getPullRequestChanges.mockResolvedValue([
        { item: { path: '/azure-pipelines.yml' } },
      ]);

      mockClient.getFileContent.mockResolvedValue('trigger: main');

      mockAnalyzer.analyze.mockResolvedValue({
        violations: [],
        warnings: [],
        suggestions: [],
        score: 100,
        summary: { totalIssues: 0, criticalCount: 0, highCount: 0, mediumCount: 0, lowCount: 0 },
      });

      // When: Re-analizar
      const result = await bot.reanalyze(136);

      // Then: Debe ejecutar análisis nuevamente
      expect(result.pullRequestId).toBe(136);
      expect(mockClient.getPullRequest).toHaveBeenCalled();
    });
  });

  describe('Manejo de Errores (6.12)', () => {
    it('debe manejar error al obtener archivos del PR (6.12.1)', async () => {
      // Given: Error al obtener archivos
      mockClient.getPullRequest.mockResolvedValue({
        pullRequestId: 999,
        repository: { id: 'repo-123' },
      });

      mockClient.getPullRequestChanges.mockRejectedValue(
        new Error('Failed to get PR changes')
      );

      // When/Then: Debe lanzar error
      await expect(bot.analyzePullRequest(999)).rejects.toThrow();
    });

    it('debe manejar error al parsear pipeline YAML (6.12.2)', async () => {
      // Given: Archivo con YAML inválido
      mockClient.getPullRequest.mockResolvedValue({
        pullRequestId: 137,
        repository: { id: 'repo-123' },
      });

      mockClient.getPullRequestChanges.mockResolvedValue([
        { item: { path: '/azure-pipelines.yml' } },
      ]);

      mockClient.getFileContent.mockResolvedValue('invalid: { yaml');

      mockAnalyzer.analyze.mockRejectedValue(new Error('YAML parsing error'));

      // When: Analizar PR
      const result = await bot.analyzePullRequest(137);

      // Then: Debe crear análisis de error
      expect(result.analyses.size).toBe(1);
      const analysis = result.analyses.get('/azure-pipelines.yml');
      expect(analysis?.violations).toHaveLength(1);
      expect(analysis?.violations[0].type).toBe('PARSING_ERROR');
    });
  });

  describe('Determinación de Status', () => {
    it('debe retornar failed con violaciones críticas en enforcement mode', async () => {
      // Given: Bot en enforcement mode
      const strictBot = new AzureDevOpsPRBot(mockClient, mockAnalyzer, {
        ...mockConfig,
        enforcementMode: 'enforcement',
      });

      mockClient.getPullRequest.mockResolvedValue({
        pullRequestId: 138,
        repository: { id: 'repo-123' },
      });

      mockClient.getPullRequestChanges.mockResolvedValue([
        { item: { path: '/azure-pipelines.yml' } },
      ]);

      mockClient.getFileContent.mockResolvedValue('trigger: main');

      mockAnalyzer.analyze.mockResolvedValue({
        violations: [
          { type: 'CRITICAL', severity: 'CRITICAL', line: 1, message: 'Critical issue' },
        ],
        warnings: [],
        suggestions: [],
        score: 50,
        summary: { totalIssues: 1, criticalCount: 1, highCount: 0, mediumCount: 0, lowCount: 0 },
      });

      // When: Analizar PR
      const result = await strictBot.analyzePullRequest(138);

      // Then: Debe retornar failed
      expect(result.status).toBe('failed');
    });

    it('debe retornar warning en learning mode con violaciones', async () => {
      // Given: Bot en learning mode
      mockClient.getPullRequest.mockResolvedValue({
        pullRequestId: 139,
        repository: { id: 'repo-123' },
      });

      mockClient.getPullRequestChanges.mockResolvedValue([
        { item: { path: '/azure-pipelines.yml' } },
      ]);

      mockClient.getFileContent.mockResolvedValue('trigger: main');

      mockAnalyzer.analyze.mockResolvedValue({
        violations: [
          { type: 'MEDIUM', severity: 'MEDIUM', line: 1, message: 'Medium issue' },
        ],
        warnings: [],
        suggestions: [],
        score: 80,
        summary: { totalIssues: 1, criticalCount: 0, highCount: 0, mediumCount: 1, lowCount: 0 },
      });

      // When: Analizar PR
      const result = await bot.analyzePullRequest(139);

      // Then: Debe retornar warning (no bloquea en learning)
      expect(result.status).toBe('warning');
    });
  });
});
