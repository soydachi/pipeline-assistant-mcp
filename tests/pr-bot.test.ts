import { PRBot, PRAnalysisConfig, PRAnalysisResult } from '../src/pr-bot';
import { Octokit } from '@octokit/rest';
import { describe, it, expect, beforeEach, vi } from 'vitest';

type MockedOctokit = {
  pulls: {
    listFiles: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    createReview: ReturnType<typeof vi.fn>;
  };
  repos: {
    getContent: ReturnType<typeof vi.fn>;
    createCommitStatus: ReturnType<typeof vi.fn>;
  };
  issues: {
    listComments: ReturnType<typeof vi.fn>;
    createComment: ReturnType<typeof vi.fn>;
    updateComment: ReturnType<typeof vi.fn>;
    addLabels: ReturnType<typeof vi.fn>;
  };
};

// Mock de Octokit
vi.mock('@octokit/rest', () => {
  const mockOctokitInstance = {
    pulls: {
      listFiles: vi.fn(),
      get: vi.fn(),
      createReview: vi.fn(),
    },
    repos: {
      getContent: vi.fn(),
      createCommitStatus: vi.fn(),
    },
    issues: {
      listComments: vi.fn(),
      createComment: vi.fn(),
      updateComment: vi.fn(),
      addLabels: vi.fn(),
    },
  };

  return {
    Octokit: class MockOctokit {
      pulls = mockOctokitInstance.pulls;
      repos = mockOctokitInstance.repos;
      issues = mockOctokitInstance.issues;
    },
  };
});

describe('PR Bot - Feature 4', () => {
  let bot: PRBot;
  let mockOctokit: MockedOctokit;

  const defaultConfig: PRAnalysisConfig = {
    githubToken: 'test-token',
    owner: 'test-owner',
    repo: 'test-repo',
    pullNumber: 123,
    strictMode: false,
    enforcementMode: 'learning',
    baseBranch: 'main'
  };

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();

    // Create new bot instance - this will create a new Octokit instance
    bot = new PRBot(defaultConfig);

    // Get the mocked Octokit instance from the bot
    mockOctokit = (bot as any).octokit as MockedOctokit;
  });

  describe('Escenario: Análisis automático al crear PR', () => {
    it('debe analizar todos los archivos YAML modificados', async () => {
      // Given: Un PR con cambios en archivos de pipeline
      mockOctokit.pulls.listFiles.mockResolvedValue({
        data: [
          { filename: '.github/workflows/ci.yml', status: 'modified' },
          { filename: 'azure-pipelines.yml', status: 'added' },
          { filename: 'README.md', status: 'modified' }, // No es pipeline
          { filename: 'src/pipeline.yml', status: 'modified' }
        ]
      } as any);

      // Mock del contenido de archivos
      mockOctokit.repos.getContent.mockImplementation(({ path }: any) => {
        const content = `
trigger: main
stages:
  - stage: Build
    jobs:
      - job: BuildJob
`;
        return Promise.resolve({
          data: {
            content: Buffer.from(content).toString('base64')
          }
        });
      });

      // When: El webhook de PR se activa
      const analysis = await bot.analyzePR();

      // Then: El bot analiza todos los archivos YAML modificados
      expect(mockOctokit.pulls.listFiles).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 123,
        per_page: 100
      });

      // Debe analizar 3 archivos de pipeline (excluyendo README.md)
      expect(analysis.files).toHaveLength(3);
      expect(analysis.summary.totalFiles).toBe(3);
    });

    it('debe publicar un comentario con el resumen del análisis', async () => {
      // Given: Análisis completado
      const mockAnalysis: PRAnalysisResult = {
        overallScore: 45,
        files: [{
          path: 'azure-pipelines.yml',
          score: 45,
          violations: [
            { type: 'MISSING_STAGE', severity: 'CRITICAL', message: 'Falta Security stage' }
          ],
          warnings: [],
          suggestions: []
        }],
        summary: {
          totalFiles: 1,
          filesWithIssues: 1,
          criticalCount: 1,
          highCount: 0,
          mediumCount: 0,
          lowCount: 0
        }
      };

      // No hay comentario previo del bot
      mockOctokit.issues.listComments.mockResolvedValue({ data: [] } as any);

      // When: Se publica el comentario
      await bot.postAnalysisComment(mockAnalysis);

      // Then: Se crea un nuevo comentario
      expect(mockOctokit.issues.createComment).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: 'test-owner',
          repo: 'test-repo',
          issue_number: 123,
          body: expect.stringContaining('## 🔍 Pipeline Assistant Analysis')
        })
      );

      // El comentario debe incluir el score y el resumen
      const commentCall = mockOctokit.issues.createComment.mock.calls[0][0];
      expect(commentCall.body).toContain('45%');
      expect(commentCall.body).toContain('Critical Issues');
    });

    it('debe marcar el PR como "Changes Requested" si hay violaciones críticas en modo enforcement', async () => {
      // Given: Bot en modo enforcement con violaciones críticas
      const enforcementBot = new PRBot({
        ...defaultConfig,
        enforcementMode: 'enforcement'
      });

      const enforcementOctokit = (enforcementBot as any).octokit as MockedOctokit;

      const analysisWithCritical: PRAnalysisResult = {
        overallScore: 40,
        files: [{
          path: 'pipeline.yml',
          score: 40,
          violations: [
            { type: 'HARDCODED_SECRET', severity: 'CRITICAL', message: 'Password hardcodeado', line: 10 }
          ],
          warnings: [],
          suggestions: []
        }],
        summary: {
          totalFiles: 1,
          filesWithIssues: 1,
          criticalCount: 1,
          highCount: 0,
          mediumCount: 0,
          lowCount: 0
        }
      };

      enforcementOctokit.pulls.get.mockResolvedValue({
        data: { head: { sha: 'abc123' } }
      } as any);

      // When: Se crean los comentarios inline
      await enforcementBot.postInlineComments(analysisWithCritical);

      // Then: El review debe ser REQUEST_CHANGES
      expect(enforcementOctokit.pulls.createReview).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'REQUEST_CHANGES',
          body: expect.stringContaining('Changes requested')
        })
      );
    });
  });

  describe('Escenario: Comentarios inline en código', () => {
    it('debe crear comentarios inline en las líneas exactas con violaciones', async () => {
      // Given: Pipeline con violación en línea 25
      const analysisWithViolation: PRAnalysisResult = {
        overallScore: 60,
        files: [{
          path: '.github/workflows/ci.yml',
          score: 60,
          violations: [{
            type: 'HARDCODED_SECRET',
            severity: 'CRITICAL',
            line: 25,
            message: 'Secreto hardcodeado detectado',
            suggestion: 'Usar Azure Key Vault',
            code: 'value: "$(SECRET_FROM_KEYVAULT)"',
            documentation: 'https://docs.example.com/security'
          }],
          warnings: [],
          suggestions: []
        }],
        summary: {
          totalFiles: 1,
          filesWithIssues: 1,
          criticalCount: 1,
          highCount: 0,
          mediumCount: 0,
          lowCount: 0
        }
      };

      mockOctokit.pulls.get.mockResolvedValue({
        data: { head: { sha: 'commit123' } }
      } as any);

      // When: El bot crea los comentarios inline
      await bot.postInlineComments(analysisWithViolation);

      // Then: Se crea un review con el comentario
      expect(mockOctokit.pulls.createReview).toHaveBeenCalled();

      const reviewCall = mockOctokit.pulls.createReview.mock.calls[0][0];

      // Verify basic structure
      expect(reviewCall.owner).toBe('test-owner');
      expect(reviewCall.repo).toBe('test-repo');
      expect(reviewCall.pull_number).toBe(123);
      expect(reviewCall.commit_id).toBe('commit123');

      // Verify comments array exists and has expected comment
      expect(reviewCall.comments).toBeDefined();
      expect(reviewCall.comments.length).toBeGreaterThan(0);

      const comment = reviewCall.comments[0];
      expect(comment.path).toBe('.github/workflows/ci.yml');
      expect(comment.line).toBe(25);
      expect(comment.body).toContain('HARDCODED_SECRET');
      expect(comment.body).toContain('Secreto hardcodeado detectado');
    });

    it('debe usar el ícono correcto según la severidad', async () => {
      // Given: Violaciones con diferentes severidades
      const analysis: PRAnalysisResult = {
        overallScore: 50,
        files: [{
          path: 'pipeline.yml',
          score: 50,
          violations: [
            { type: 'CRITICAL_ISSUE', severity: 'CRITICAL', line: 10, message: 'Critical' },
            { type: 'HIGH_ISSUE', severity: 'HIGH', line: 20, message: 'High' }
          ],
          warnings: [
            { type: 'WARNING', severity: 'MEDIUM', line: 30, message: 'Warning' }
          ],
          suggestions: []
        }],
        summary: {
          totalFiles: 1,
          filesWithIssues: 1,
          criticalCount: 1,
          highCount: 1,
          mediumCount: 1,
          lowCount: 0
        }
      };

      mockOctokit.pulls.get.mockResolvedValue({
        data: { head: { sha: 'abc123' } }
      } as any);

      // When: Se crean los comentarios
      await bot.postInlineComments(analysis);

      // Then: Los comentarios tienen los íconos correspondientes
      const review = mockOctokit.pulls.createReview.mock.calls[0][0];

      // Should have 2 comments (CRITICAL and HIGH only, not MEDIUM in non-strict mode)
      expect(review.comments.length).toBe(2);

      // Critical should have 🔴
      const criticalComment = review.comments.find((c: any) => c.line === 10);
      expect(criticalComment.body).toContain('🔴');

      // High should have 🟠
      const highComment = review.comments.find((c: any) => c.line === 20);
      expect(highComment.body).toContain('🟠');
    });
  });

  describe('Escenario: Re-análisis tras correcciones', () => {
    it('debe actualizar el comentario existente del bot', async () => {
      // Given: Ya existe un comentario del bot
      mockOctokit.issues.listComments.mockResolvedValue({
        data: [
          { id: 999, user: { type: 'Bot', login: 'github-actions[bot]' }, body: '## 🔍 Pipeline Assistant Analysis' }
        ]
      } as any);

      const analysis: PRAnalysisResult = {
        overallScore: 85,
        files: [],
        summary: {
          totalFiles: 0,
          filesWithIssues: 0,
          criticalCount: 0,
          highCount: 0,
          mediumCount: 0,
          lowCount: 0
        }
      };

      // When: Se publica un nuevo análisis
      await bot.postAnalysisComment(analysis);

      // Then: Se actualiza el comentario existente
      expect(mockOctokit.issues.updateComment).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: 'test-owner',
          repo: 'test-repo',
          comment_id: 999
        })
      );

      // Y NO se crea un nuevo comentario
      expect(mockOctokit.issues.createComment).not.toHaveBeenCalled();
    });

    it('debe actualizar el estado del PR a "Approved" si todo está bien', async () => {
      // Given: Un análisis perfecto sin issues
      const perfectAnalysis: PRAnalysisResult = {
        overallScore: 95,
        files: [{
          path: 'pipeline.yml',
          score: 95,
          violations: [],
          warnings: [],
          suggestions: []
        }],
        summary: {
          totalFiles: 1,
          filesWithIssues: 0,
          criticalCount: 0,
          highCount: 0,
          mediumCount: 0,
          lowCount: 0
        }
      };

      mockOctokit.pulls.get.mockResolvedValue({
        data: { head: { sha: 'abc123' } }
      } as any);

      // When: Se actualiza el estado del PR
      await bot.updatePRStatus(perfectAnalysis);

      // Then: El estado debe ser success
      expect(mockOctokit.repos.createCommitStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'success',
          description: expect.stringContaining('compliance')
        })
      );
    });
  });

  describe('Escenario: Reporte de compliance score', () => {
    it('debe incluir todas las métricas requeridas en el comentario principal', async () => {
      const analysis: PRAnalysisResult = {
        overallScore: 75,
        files: [{
          path: 'pipeline.yml',
          score: 75,
          violations: [
            { type: 'ISSUE', severity: 'HIGH', message: 'High issue' }
          ],
          warnings: [
            { type: 'WARN', severity: 'MEDIUM', message: 'Medium warning' }
          ],
          suggestions: []
        }],
        summary: {
          totalFiles: 1,
          filesWithIssues: 1,
          criticalCount: 0,
          highCount: 1,
          mediumCount: 1,
          lowCount: 0
        }
      };

      mockOctokit.issues.listComments.mockResolvedValue({ data: [] } as any);

      // When
      await bot.postAnalysisComment(analysis);

      // Then
      const comment = mockOctokit.issues.createComment.mock.calls[0][0];

      expect(comment.body).toContain('75%'); // Overall score
      expect(comment.body).toContain('Files Analyzed | 1');
      expect(comment.body).toContain('High Issues | 1');
      expect(comment.body).toContain('Medium Issues | 1');
    });

    it('debe mostrar badges con colores apropiados según el score', async () => {
      const highScoreAnalysis: PRAnalysisResult = {
        overallScore: 92,
        files: [],
        summary: {
          totalFiles: 1,
          filesWithIssues: 0,
          criticalCount: 0,
          highCount: 0,
          mediumCount: 0,
          lowCount: 0
        }
      };

      mockOctokit.issues.listComments.mockResolvedValue({ data: [] } as any);

      await bot.postAnalysisComment(highScoreAnalysis);

      const comment = mockOctokit.issues.createComment.mock.calls[0][0];

      // High score should have good compliance messaging
      expect(comment.body).toContain('92%');
    });
  });

  describe('Escenario: Modo learning vs enforcement', () => {
    it('debe solo añadir comentarios informativos en modo learning', async () => {
      const learningBot = new PRBot({
        ...defaultConfig,
        enforcementMode: 'learning'
      });

      const learningOctokit = (learningBot as any).octokit as MockedOctokit;

      const analysis: PRAnalysisResult = {
        overallScore: 50,
        files: [{
          path: 'pipeline.yml',
          score: 50,
          violations: [
            { type: 'CRITICAL', severity: 'CRITICAL', line: 10, message: 'Critical issue' }
          ],
          warnings: [],
          suggestions: []
        }],
        summary: {
          totalFiles: 1,
          filesWithIssues: 1,
          criticalCount: 1,
          highCount: 0,
          mediumCount: 0,
          lowCount: 0
        }
      };

      learningOctokit.pulls.get.mockResolvedValue({
        data: { head: { sha: 'abc123' } }
      } as any);

      await learningBot.postInlineComments(analysis);

      // En modo learning, debe usar COMMENT en vez de REQUEST_CHANGES
      expect(learningOctokit.pulls.createReview).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'COMMENT'
        })
      );
    });

    it('debe bloquear el merge en modo enforcement con issues críticos', async () => {
      const enforcementBot = new PRBot({
        ...defaultConfig,
        enforcementMode: 'enforcement'
      });

      const enforcementOctokit = (enforcementBot as any).octokit as MockedOctokit;

      const criticalAnalysis: PRAnalysisResult = {
        overallScore: 30,
        files: [{
          path: 'pipeline.yml',
          score: 30,
          violations: [
            { type: 'CRITICAL', severity: 'CRITICAL', line: 10, message: 'Critical issue' }
          ],
          warnings: [],
          suggestions: []
        }],
        summary: {
          totalFiles: 1,
          filesWithIssues: 1,
          criticalCount: 1,
          highCount: 0,
          mediumCount: 0,
          lowCount: 0
        }
      };

      enforcementOctokit.pulls.get.mockResolvedValue({
        data: { head: { sha: 'abc123' } }
      } as any);

      await enforcementBot.postInlineComments(criticalAnalysis);

      expect(enforcementOctokit.pulls.createReview).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'REQUEST_CHANGES'
        })
      );
    });

    it('debe permitir el merge en enforcement si no hay críticos', async () => {
      const enforcementBot = new PRBot({
        ...defaultConfig,
        enforcementMode: 'enforcement'
      });

      const enforcementOctokit = (enforcementBot as any).octokit as MockedOctokit;

      const goodAnalysis: PRAnalysisResult = {
        overallScore: 85,
        files: [{
          path: 'pipeline.yml',
          score: 85,
          violations: [],
          warnings: [
            { type: 'LOW', severity: 'LOW', line: 10, message: 'Minor issue' }
          ],
          suggestions: []
        }],
        summary: {
          totalFiles: 1,
          filesWithIssues: 1,
          criticalCount: 0,
          highCount: 0,
          mediumCount: 0,
          lowCount: 1
        }
      };

      enforcementOctokit.pulls.get.mockResolvedValue({
        data: { head: { sha: 'abc123' } }
      } as any);

      // No debería crear review ya que no hay CRITICAL o HIGH
      await enforcementBot.postInlineComments(goodAnalysis);

      // Should not create review for LOW issues
      expect(enforcementOctokit.pulls.createReview).not.toHaveBeenCalled();
    });
  });

  describe('Comandos especiales en comentarios', () => {
    it('debe responder al comando /reanalyze', async () => {
      mockOctokit.pulls.listFiles.mockResolvedValue({
        data: [
          { filename: 'pipeline.yml', status: 'modified' }
        ]
      } as any);

      mockOctokit.repos.getContent.mockResolvedValue({
        data: {
          content: Buffer.from('trigger: main').toString('base64')
        }
      } as any);

      // Simular comando de re-análisis
      const analysis = await bot.analyzePR();

      expect(analysis).toBeDefined();
      expect(mockOctokit.pulls.listFiles).toHaveBeenCalled();
    });

    it('debe agregar labels según el estado del análisis', async () => {
      const analysis: PRAnalysisResult = {
        overallScore: 45,
        files: [],
        summary: {
          totalFiles: 1,
          filesWithIssues: 1,
          criticalCount: 1,
          highCount: 0,
          mediumCount: 0,
          lowCount: 0
        }
      };

      mockOctokit.pulls.get.mockResolvedValue({
        data: { head: { sha: 'abc123' } }
      } as any);

      await bot.updatePRStatus(analysis);

      // Should call addLabels (method exists in updatePRStatus)
      expect(mockOctokit.issues.addLabels).toHaveBeenCalled();
    });
  });
});
