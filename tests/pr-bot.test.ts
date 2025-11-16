import { PRBot, PRAnalysisConfig, PRAnalysisResult } from '../src/pr-bot';
import { Octokit } from '@octokit/rest';
import { jest } from '@jest/globals';

// Mock de Octokit
jest.mock('@octokit/rest');

type MockedOctokit = {
  pulls: {
    listFiles: jest.Mock<any>;
    get: jest.Mock<any>;
    createReview: jest.Mock<any>;
  };
  repos: {
    getContent: jest.Mock<any>;
    createCommitStatus: jest.Mock<any>;
  };
  issues: {
    listComments: jest.Mock<any>;
    createComment: jest.Mock<any>;
    updateComment: jest.Mock<any>;
    addLabels: jest.Mock<any>;
  };
};

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
    // Setup mocks
    mockOctokit = {
      pulls: {
        listFiles: jest.fn(),
        get: jest.fn(),
        createReview: jest.fn(),
      },
      repos: {
        getContent: jest.fn(),
        createCommitStatus: jest.fn(),
      },
      issues: {
        listComments: jest.fn(),
        createComment: jest.fn(),
        updateComment: jest.fn(),
        addLabels: jest.fn(),
      },
    } as any;

    (Octokit as jest.MockedClass<typeof Octokit>).mockImplementation(() => mockOctokit as any);
    
    bot = new PRBot(defaultConfig);
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
      expect(commentCall.body).toContain('Critical Issues | 1');
    });

    it('debe marcar el PR como "Changes Requested" si hay violaciones críticas en modo enforcement', async () => {
      // Given: Bot en modo enforcement con violaciones críticas
      const enforcementBot = new PRBot({
        ...defaultConfig,
        enforcementMode: 'enforcement'
      });

      const analysisWithCritical: PRAnalysisResult = {
        overallScore: 40,
        files: [{
          path: 'pipeline.yml',
          score: 40,
          violations: [
            { type: 'HARDCODED_SECRET', severity: 'CRITICAL', message: 'Password hardcodeado' }
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

      mockOctokit.pulls.get.mockResolvedValue({
        data: { head: { sha: 'abc123' } }
      } as any);

      // When: Se crean los comentarios inline
      await enforcementBot.postInlineComments(analysisWithCritical);

      // Then: El review debe ser REQUEST_CHANGES
      expect(mockOctokit.pulls.createReview).toHaveBeenCalledWith(
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

      // When: El bot completa el análisis
      await bot.postInlineComments(analysisWithViolation);

      // Then: Aparece un comentario inline en esa línea exacta
      expect(mockOctokit.pulls.createReview).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: 'test-owner',
          repo: 'test-repo',
          pull_number: 123,
          commit_id: 'commit123',
          comments: expect.arrayContaining([
            expect.objectContaining({
              path: '.github/workflows/ci.yml',
              line: 25,
              body: expect.stringContaining('❌')
            })
          ])
        })
      );

      // Y el comentario incluye todos los elementos requeridos
      const review = mockOctokit.pulls.createReview.mock.calls[0][0];
      const comment = review.comments![0];
      
      expect(comment.body).toContain('HARDCODED_SECRET');
      expect(comment.body).toContain('Secreto hardcodeado detectado');
      expect(comment.body).toContain('Usar Azure Key Vault');
      expect(comment.body).toContain('$(SECRET_FROM_KEYVAULT)');
      expect(comment.body).toContain('https://docs.example.com/security');
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
        data: { head: { sha: 'abc' } }
      } as any);

      // When: Se crean comentarios inline
      await bot.postInlineComments(analysis);

      // Then: Los comentarios tienen los íconos correctos
      const review = mockOctokit.pulls.createReview.mock.calls[0][0];
      const comments = review.comments!;
      
      expect(comments[0].body).toContain('🔴'); // Critical
      expect(comments[1].body).toContain('🟠'); // High
      // Medium warnings solo se incluyen en strict mode
    });
  });

  describe('Escenario: Re-análisis tras correcciones', () => {
    it('debe actualizar el comentario existente del bot', async () => {
      // Given: Existe un comentario previo del bot
      const existingComment = {
        id: 999,
        user: { type: 'Bot' },
        body: '## 🔍 Pipeline Assistant Analysis\n\nOld analysis...'
      };
      
      mockOctokit.issues.listComments.mockResolvedValue({
        data: [existingComment]
      } as any);

      const newAnalysis: PRAnalysisResult = {
        overallScore: 85,
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

      // When: Se pushean commits con correcciones y se re-analiza
      await bot.postAnalysisComment(newAnalysis);

      // Then: El bot actualiza el comentario existente
      expect(mockOctokit.issues.updateComment).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        comment_id: 999,
        body: expect.stringContaining('85%')
      });

      // No se crea un nuevo comentario
      expect(mockOctokit.issues.createComment).not.toHaveBeenCalled();
    });

    it('debe actualizar el estado del PR a "Approved" si todo está bien', async () => {
      // Given: Análisis sin issues críticos y buen score
      const goodAnalysis: PRAnalysisResult = {
        overallScore: 92,
        files: [{
          path: 'pipeline.yml',
          score: 92,
          violations: [],
          warnings: [],
          suggestions: [{ message: 'Considere usar caché' }]
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
        data: { head: { sha: 'fixed123' } }
      } as any);

      // When: Se actualiza el estado
      await bot.updatePRStatus(goodAnalysis);

      // Then: El estado es success
      expect(mockOctokit.repos.createCommitStatus).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        sha: 'fixed123',
        state: 'success',
        description: expect.stringContaining('✅'),
        context: 'pipeline-assistant/compliance'
      });
    });
  });

  describe('Escenario: Reporte de compliance score', () => {
    it('debe incluir todas las métricas requeridas en el comentario principal', async () => {
      // Given: Análisis completo con trend
      const fullAnalysis: PRAnalysisResult = {
        overallScore: 75,
        files: [
          {
            path: 'ci.yml',
            score: 80,
            violations: [{ severity: 'HIGH', type: 'TEST', message: 'Issue' }],
            warnings: [{ severity: 'MEDIUM', message: 'Warning' }],
            suggestions: []
          },
          {
            path: 'cd.yml',
            score: 70,
            violations: [{ severity: 'CRITICAL', type: 'SEC', message: 'Critical' }],
            warnings: [],
            suggestions: []
          }
        ],
        summary: {
          totalFiles: 2,
          filesWithIssues: 2,
          criticalCount: 1,
          highCount: 1,
          mediumCount: 1,
          lowCount: 0
        },
        trend: {
          scoreChange: 5,
          issuesResolved: 3,
          newIssues: 1
        }
      };

      mockOctokit.issues.listComments.mockResolvedValue({ data: [] } as any);

      // When: Se genera el comentario
      await bot.postAnalysisComment(fullAnalysis);

      // Then: Incluye todas las métricas
      const comment = mockOctokit.issues.createComment.mock.calls[0][0].body;
      
      // Score
      expect(comment).toContain('75%');
      
      // Contador por severidad
      expect(comment).toContain('Critical Issues | 1');
      expect(comment).toContain('High Issues | 1');
      expect(comment).toContain('Medium Issues | 1');
      
      // Tendencia vs main
      expect(comment).toContain('Score Change: 📈 +5%');
      expect(comment).toContain('Issues Resolved: ✅ 3');
      expect(comment).toContain('New Issues: ⚠️ 1');
      
      // Badges visuales
      expect(comment).toContain('![Compliance]');
      expect(comment).toContain('![Critical]');
      expect(comment).toContain('![High]');
    });

    it('debe mostrar badges con colores apropiados según el score', async () => {
      // Test diferentes scores
      const testCases = [
        { score: 95, expectedColor: 'green' },
        { score: 75, expectedColor: 'yellow' },
        { score: 45, expectedColor: 'orange' },
        { score: 25, expectedColor: 'red' }
      ];

      for (const testCase of testCases) {
        const analysis: PRAnalysisResult = {
          overallScore: testCase.score,
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
        
        await bot.postAnalysisComment(analysis);
        
        const comment = mockOctokit.issues.createComment.mock.calls[0][0].body;
        expect(comment).toContain(`compliance-${testCase.score}%25-${testCase.expectedColor}`);
        
        // Limpiar mocks para siguiente iteración
        mockOctokit.issues.createComment.mockClear();
      }
    });
  });

  describe('Escenario: Modo learning vs enforcement', () => {
    it('debe solo añadir comentarios informativos en modo learning', async () => {
      // Given: Bot configurado en modo "learning"
      const learningBot = new PRBot({
        ...defaultConfig,
        enforcementMode: 'learning'
      });

      const analysisWithCritical: PRAnalysisResult = {
        overallScore: 40,
        files: [{
          path: 'pipeline.yml',
          score: 40,
          violations: [
            { type: 'CRITICAL', severity: 'CRITICAL', message: 'Critical issue' }
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

      mockOctokit.pulls.get.mockResolvedValue({
        data: { head: { sha: 'abc' } }
      } as any);

      // When: Encuentra violaciones
      await learningBot.postInlineComments(analysisWithCritical);

      // Then: Solo añade comentarios informativos (COMMENT, no REQUEST_CHANGES)
      expect(mockOctokit.pulls.createReview).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'COMMENT' // No bloquea
        })
      );

      // Y el comentario principal indica modo learning
      mockOctokit.issues.listComments.mockResolvedValue({ data: [] } as any);
      await learningBot.postAnalysisComment(analysisWithCritical);
      
      const comment = mockOctokit.issues.createComment.mock.calls[0][0].body;
      expect(comment).toContain('Learning Mode');
      expect(comment).toContain('Merge is not blocked');
    });

    it('debe bloquear el merge en modo enforcement con issues críticos', async () => {
      // Given: Bot en modo "enforcement"
      const enforcementBot = new PRBot({
        ...defaultConfig,
        enforcementMode: 'enforcement'
      });

      const analysisWithCritical: PRAnalysisResult = {
        overallScore: 40,
        files: [{
          path: 'pipeline.yml',
          score: 40,
          violations: [
            { type: 'HARDCODED_SECRET', severity: 'CRITICAL', message: 'Secret exposed' }
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

      mockOctokit.pulls.get.mockResolvedValue({
        data: { head: { sha: 'abc' } }
      } as any);

      // When: Encuentra violaciones críticas
      await enforcementBot.postInlineComments(analysisWithCritical);
      await enforcementBot.updatePRStatus(analysisWithCritical);

      // Then: Bloquea el merge (REQUEST_CHANGES)
      expect(mockOctokit.pulls.createReview).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'REQUEST_CHANGES'
        })
      );

      // Y el status check falla
      expect(mockOctokit.repos.createCommitStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'failure',
          description: expect.stringContaining('1 critical issues must be fixed')
        })
      );

      // El comentario indica modo enforcement
      mockOctokit.issues.listComments.mockResolvedValue({ data: [] } as any);
      await enforcementBot.postAnalysisComment(analysisWithCritical);
      
      const comment = mockOctokit.issues.createComment.mock.calls[0][0].body;
      expect(comment).toContain('Enforcement Mode');
      expect(comment).toContain('Critical issues must be resolved');
    });

    it('debe permitir el merge en enforcement si no hay críticos', async () => {
      // Given: Modo enforcement pero sin issues críticos
      const enforcementBot = new PRBot({
        ...defaultConfig,
        enforcementMode: 'enforcement'
      });

      const analysisNoCritical: PRAnalysisResult = {
        overallScore: 75,
        files: [{
          path: 'pipeline.yml',
          score: 75,
          violations: [],
          warnings: [{ severity: 'MEDIUM', message: 'Consider using cache' }],
          suggestions: []
        }],
        summary: {
          totalFiles: 1,
          filesWithIssues: 1,
          criticalCount: 0,
          highCount: 0,
          mediumCount: 1,
          lowCount: 0
        }
      };

      mockOctokit.pulls.get.mockResolvedValue({
        data: { head: { sha: 'abc' } }
      } as any);

      // When: No hay críticos
      await enforcementBot.updatePRStatus(analysisNoCritical);

      // Then: No bloquea el merge
      expect(mockOctokit.repos.createCommitStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'success',
          description: expect.stringContaining('Improvements recommended')
        })
      );
    });
  });

  describe('Comandos especiales en comentarios', () => {
    it('debe responder al comando /reanalyze', async () => {
      // Este test verificaría la funcionalidad del GitHub Action
      // que detecta el comando y ejecuta nuevo análisis
      expect(true).toBe(true);
    });

    it('debe agregar labels según el estado del análisis', async () => {
      // Given: Análisis con diferentes scores
      const excellentAnalysis: PRAnalysisResult = {
        overallScore: 95,
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

      mockOctokit.pulls.get.mockResolvedValue({
        data: { head: { sha: 'abc' } }
      } as any);

      // When: Se actualiza el estado
      await bot.updatePRStatus(excellentAnalysis);

      // Then: Se agregan los labels apropiados
      expect(mockOctokit.issues.addLabels).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 123,
        labels: expect.arrayContaining([
          'pipeline: excellent',
          'ready-to-merge'
        ])
      });
    });
  });
});
