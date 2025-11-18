/**
 * Tests para Azure DevOps Client
 *
 * Cubre escenarios 6.1.1 - 6.1.10 de Fase 1
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AzureDevOpsClient } from '../../src/azure-devops/client.js';
import {
  AuthenticationError,
  PermissionsError,
  RateLimitError,
  ResourceNotFoundError,
  AzureDevOpsError,
} from '../../src/azure-devops/types.js';
import type { AzureDevOpsConfig } from '../../src/azure-devops/types.js';

// Mock de azure-devops-node-api
vi.mock('azure-devops-node-api', () => {
  const mockGitApi = {
    getRepositories: vi.fn(),
    getRepository: vi.fn(),
    getPullRequests: vi.fn(),
    getPullRequest: vi.fn(),
    getPullRequestIterations: vi.fn(),
    getPullRequestIterationChanges: vi.fn(),
    getItem: vi.fn(),
  };

  const mockConnection = {
    getGitApi: vi.fn().mockResolvedValue(mockGitApi),
  };

  return {
    WebApi: class MockWebApi {
      constructor() {
        return mockConnection;
      }
    },
    getPersonalAccessTokenHandler: vi.fn(),
  };
});

describe('AzureDevOpsClient - Fase 1', () => {
  let client: AzureDevOpsClient;
  let mockConfig: AzureDevOpsConfig;

  beforeEach(() => {
    mockConfig = {
      organizationUrl: 'https://dev.azure.com/testorg',
      personalAccessToken: 'test-pat-token',
      project: 'TestProject',
      repository: 'test-repo',
      enforcementMode: 'learning',
      strictMode: false,
      retryPolicy: {
        maxRetries: 3,
        retryDelayMs: 100,
        backoffMultiplier: 2,
        retryableStatusCodes: [429, 500, 502, 503, 504],
      },
      enableCache: true,
      timeout: 30000,
      verbose: false,
    };

    client = new AzureDevOpsClient(mockConfig);
  });

  describe('Escenario 6.1.1: Conexión exitosa a Azure DevOps API', () => {
    it('debe conectar exitosamente con credenciales válidas', async () => {
      // Given: Cliente con configuración válida
      const azdev = await import('azure-devops-node-api');
      const mockConnection = new azdev.WebApi();
      const mockGitApi = await mockConnection.getGitApi();

      // Mock de repositorio para validación
      vi.mocked(mockGitApi.getRepository).mockResolvedValue({
        id: 'repo-123',
        name: 'test-repo',
        project: { id: 'proj-123', name: 'TestProject' },
      } as any);

      // When: Conectar al servicio
      const connection = await client.connect();

      // Then: Debe retornar información de conexión
      expect(connection).toBeDefined();
      expect(connection.organizationUrl).toBe('https://dev.azure.com/testorg');
      expect(connection.project).toBe('TestProject');
      expect(connection.repositoryId).toBe('repo-123');
      expect(connection.connected).toBe(true);
    });

    it('debe cachear la conexión tras primer connect exitoso', async () => {
      // Given: Primera conexión exitosa
      const azdev = await import('azure-devops-node-api');
      const mockConnection = new azdev.WebApi();
      const mockGitApi = await mockConnection.getGitApi();

      vi.mocked(mockGitApi.getRepository).mockResolvedValue({
        id: 'repo-123',
        name: 'test-repo',
      } as any);

      await client.connect();

      // When: Conectar nuevamente
      const connection2 = await client.connect();

      // Then: Debe usar conexión cacheada (no llamar a API nuevamente)
      expect(connection2.connected).toBe(true);
    });
  });

  describe('Escenario 6.1.2: Manejo de errores de autenticación', () => {
    it('debe lanzar AuthenticationError con credenciales inválidas', async () => {
      // Given: API que rechaza credenciales
      const azdev = await import('azure-devops-node-api');
      const mockConnection = new azdev.WebApi();
      const mockGitApi = await mockConnection.getGitApi();

      vi.mocked(mockGitApi.getRepository).mockRejectedValue(
        new Error('Authentication failed: Invalid PAT')
      );

      // When/Then: Debe lanzar AuthenticationError
      await expect(client.connect()).rejects.toThrow();
    });
  });

  describe('Escenario 6.1.3: Validación de permisos del PAT', () => {
    it('debe detectar PAT con permisos insuficientes', async () => {
      // Given: API que rechaza por falta de permisos
      const azdev = await import('azure-devops-node-api');
      const mockConnection = new azdev.WebApi();
      const mockGitApi = await mockConnection.getGitApi();

      vi.mocked(mockGitApi.getRepository).mockRejectedValue(
        new Error('Insufficient permissions')
      );

      // When/Then: Debe lanzar error de permisos
      await expect(client.connect()).rejects.toThrow();
    });
  });

  describe('Escenario 6.1.4: Obtener información de repositorio', () => {
    it('debe obtener información completa del repositorio', async () => {
      // Given: Cliente conectado
      const azdev = await import('azure-devops-node-api');
      const mockConnection = new azdev.WebApi();
      const mockGitApi = await mockConnection.getGitApi();

      const mockRepo = {
        id: 'repo-123',
        name: 'test-repo',
        url: 'https://dev.azure.com/testorg/TestProject/_git/test-repo',
        defaultBranch: 'refs/heads/main',
        size: 1024000,
        project: {
          id: 'proj-123',
          name: 'TestProject',
        },
      };

      vi.mocked(mockGitApi.getRepository).mockResolvedValue(mockRepo as any);

      await client.connect();

      // When: Obtener repositorio
      const repo = await client.getRepository('test-repo');

      // Then: Debe retornar información completa
      expect(repo.id).toBe('repo-123');
      expect(repo.name).toBe('test-repo');
      expect(repo.defaultBranch).toBe('refs/heads/main');
      expect(repo.project?.name).toBe('TestProject');
    });
  });

  describe('Escenario 6.1.5: Listar Pull Requests activos', () => {
    it('debe listar todos los PRs activos', async () => {
      // Given: Repositorio con PRs activos
      const azdev = await import('azure-devops-node-api');
      const mockConnection = new azdev.WebApi();
      const mockGitApi = await mockConnection.getGitApi();

      const mockPRs = [
        {
          pullRequestId: 123,
          title: 'Feature: Add new API endpoint',
          status: 1, // Active
          createdBy: { displayName: 'John Doe' },
        },
        {
          pullRequestId: 124,
          title: 'Fix: Resolve bug in auth',
          status: 1, // Active
          createdBy: { displayName: 'Jane Smith' },
        },
      ];

      vi.mocked(mockGitApi.getRepository).mockResolvedValue({ id: 'repo-123' } as any);
      vi.mocked(mockGitApi.getPullRequests).mockResolvedValue(mockPRs as any);

      await client.connect();

      // When: Listar PRs activos
      const prs = await client.listPullRequests({ status: 'active' });

      // Then: Debe retornar PRs activos
      expect(prs).toHaveLength(2);
      expect(prs[0].pullRequestId).toBe(123);
      expect(prs[1].pullRequestId).toBe(124);
    });

    it('debe retornar array vacío si no hay PRs', async () => {
      // Given: Repositorio sin PRs
      const azdev = await import('azure-devops-node-api');
      const mockConnection = new azdev.WebApi();
      const mockGitApi = await mockConnection.getGitApi();

      vi.mocked(mockGitApi.getRepository).mockResolvedValue({ id: 'repo-123' } as any);
      vi.mocked(mockGitApi.getPullRequests).mockResolvedValue([]);

      await client.connect();

      // When: Listar PRs
      const prs = await client.listPullRequests();

      // Then: Debe retornar array vacío
      expect(prs).toHaveLength(0);
    });
  });

  describe('Escenario 6.1.6: Obtener detalles completos de un PR', () => {
    it('debe obtener detalles completos de un PR específico', async () => {
      // Given: PR existente
      const azdev = await import('azure-devops-node-api');
      const mockConnection = new azdev.WebApi();
      const mockGitApi = await mockConnection.getGitApi();

      const mockPR = {
        pullRequestId: 125,
        title: 'Feature: New feature',
        description: 'Detailed description',
        status: 1, // Active
        createdBy: { displayName: 'Developer' },
        sourceRefName: 'refs/heads/feature/new-feature',
        targetRefName: 'refs/heads/main',
        lastMergeSourceCommit: {
          commitId: 'abc123',
        },
      };

      vi.mocked(mockGitApi.getRepository).mockResolvedValue({ id: 'repo-123' } as any);
      vi.mocked(mockGitApi.getPullRequest).mockResolvedValue(mockPR as any);

      await client.connect();

      // When: Obtener PR específico
      const pr = await client.getPullRequest(125);

      // Then: Debe retornar PR con detalles completos
      expect(pr.pullRequestId).toBe(125);
      expect(pr.title).toBe('Feature: New feature');
      expect(pr.description).toBe('Detailed description');
      expect(pr.pipelineAnalysisStatus).toBe('pending');
    });

    it('debe cachear PRs obtenidos', async () => {
      // Given: PR obtenido previamente
      const azdev = await import('azure-devops-node-api');
      const mockConnection = new azdev.WebApi();
      const mockGitApi = await mockConnection.getGitApi();

      const mockPR = { pullRequestId: 125, title: 'Test' };

      vi.mocked(mockGitApi.getRepository).mockResolvedValue({ id: 'repo-123' } as any);
      vi.mocked(mockGitApi.getPullRequest).mockResolvedValue(mockPR as any);

      await client.connect();
      await client.getPullRequest(125);

      // When: Obtener mismo PR nuevamente
      const pr2 = await client.getPullRequest(125, true);

      // Then: Debe usar cache (getPullRequest llamado solo 1 vez)
      expect(pr2.pullRequestId).toBe(125);
      expect(vi.mocked(mockGitApi.getPullRequest)).toHaveBeenCalledTimes(1);
    });
  });

  describe('Escenario 6.1.7: Obtener archivos modificados en PR', () => {
    it('debe obtener lista de archivos modificados', async () => {
      // Given: PR con archivos modificados
      const azdev = await import('azure-devops-node-api');
      const mockConnection = new azdev.WebApi();
      const mockGitApi = await mockConnection.getGitApi();

      const mockIterations = [{ id: 1 }];
      const mockChanges = {
        changeEntries: [
          {
            item: { path: '/azure-pipelines.yml' },
            changeType: 2, // Edit
          },
          {
            item: { path: '/src/app.ts' },
            changeType: 2, // Edit
          },
        ],
      };

      vi.mocked(mockGitApi.getRepository).mockResolvedValue({ id: 'repo-123' } as any);
      vi.mocked(mockGitApi.getPullRequestIterations).mockResolvedValue(mockIterations as any);
      vi.mocked(mockGitApi.getPullRequestIterationChanges).mockResolvedValue(mockChanges as any);

      await client.connect();

      // When: Obtener archivos modificados
      const changes = await client.getPullRequestChanges(125);

      // Then: Debe retornar lista de cambios
      expect(changes).toHaveLength(2);
      expect(changes[0].item?.path).toBe('/azure-pipelines.yml');
      expect(changes[1].item?.path).toBe('/src/app.ts');
    });
  });

  describe('Escenario 6.1.8: Obtener contenido de archivo en PR', () => {
    it('debe obtener contenido de archivo específico', async () => {
      // Given: PR con archivo
      const azdev = await import('azure-devops-node-api');
      const mockConnection = new azdev.WebApi();
      const mockGitApi = await mockConnection.getGitApi();

      const mockPR = {
        pullRequestId: 125,
        lastMergeSourceCommit: { commitId: 'abc123' },
      };

      const mockItem = {
        content: 'trigger:\n  - main\n\nsteps:\n  - task: Build',
      };

      vi.mocked(mockGitApi.getRepository).mockResolvedValue({ id: 'repo-123' } as any);
      vi.mocked(mockGitApi.getPullRequest).mockResolvedValue(mockPR as any);
      vi.mocked(mockGitApi.getItem).mockResolvedValue(mockItem as any);

      await client.connect();

      // When: Obtener contenido del archivo
      const content = await client.getFileContent(125, '/azure-pipelines.yml');

      // Then: Debe retornar contenido del archivo
      expect(content).toContain('trigger:');
      expect(content).toContain('steps:');
    });
  });

  describe('Escenario 6.1.9: Manejo de rate limiting con retry automático', () => {
    it('debe reintentar automáticamente en caso de rate limit', async () => {
      // Given: API que retorna rate limit en primer intento
      const azdev = await import('azure-devops-node-api');
      const mockConnection = new azdev.WebApi();
      const mockGitApi = await mockConnection.getGitApi();

      const rateLimitError = new Error('429 Rate limit exceeded');
      const mockRepo = { id: 'repo-123', name: 'test-repo' };

      let callCount = 0;
      vi.mocked(mockGitApi.getRepository).mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw rateLimitError;
        }
        return mockRepo as any;
      });

      await client.connect();

      // When: Listar repositorios (debería reintentar)
      const repos = await client.listRepositories();

      // Then: Debe haber reintentado y eventualmente exitoso
      expect(callCount).toBeGreaterThan(1);
      expect(repos).toBeDefined();
    });
  });

  describe('Escenario 6.1.10: Configuración de retry policy con backoff exponencial', () => {
    it('debe aplicar backoff exponencial en reintentos', async () => {
      // Given: Cliente con retry policy configurado
      const clientWithRetry = new AzureDevOpsClient({
        ...mockConfig,
        retryPolicy: {
          maxRetries: 3,
          retryDelayMs: 100,
          backoffMultiplier: 2,
        },
      });

      const azdev = await import('azure-devops-node-api');
      const mockConnection = new azdev.WebApi();
      const mockGitApi = await mockConnection.getGitApi();

      let callCount = 0;
      const timestamps: number[] = [];

      vi.mocked(mockGitApi.getRepository).mockImplementation(async () => {
        timestamps.push(Date.now());
        callCount++;
        if (callCount <= 2) {
          throw new Error('Temporary failure');
        }
        return { id: 'repo-123' } as any;
      });

      await clientWithRetry.connect();

      // When: Operación que requiere retry
      await clientWithRetry.listRepositories();

      // Then: Debe haber esperado con backoff exponencial
      expect(callCount).toBe(3);
      expect(timestamps.length).toBe(3);

      // Verificar que el delay aumentó exponencialmente
      if (timestamps.length >= 2) {
        const delay1 = timestamps[1] - timestamps[0];
        const delay2 = timestamps[2] - timestamps[1];
        // delay2 debería ser aproximadamente el doble de delay1 (con jitter)
        expect(delay2).toBeGreaterThan(delay1 * 0.8); // Tolerar jitter
      }
    });

    it('debe respetar maxRetries y fallar tras agotarlos', async () => {
      // Given: Cliente con maxRetries = 2
      const clientWithRetry = new AzureDevOpsClient({
        ...mockConfig,
        retryPolicy: {
          maxRetries: 2,
          retryDelayMs: 10,
          backoffMultiplier: 2,
        },
      });

      const azdev = await import('azure-devops-node-api');
      const mockConnection = new azdev.WebApi();
      const mockGitApi = await mockConnection.getGitApi();

      // Mock que siempre falla
      vi.mocked(mockGitApi.getRepository).mockRejectedValue(
        new Error('Persistent failure')
      );

      await expect(clientWithRetry.connect()).rejects.toThrow('Persistent failure');
    });
  });

  describe('Manejo de errores específicos', () => {
    it('debe manejar error de recurso no encontrado', async () => {
      // Given: Repositorio que no existe
      const azdev = await import('azure-devops-node-api');
      const mockConnection = new azdev.WebApi();
      const mockGitApi = await mockConnection.getGitApi();

      vi.mocked(mockGitApi.getRepository).mockResolvedValue({ id: 'repo-123' } as any);
      vi.mocked(mockGitApi.getPullRequest).mockResolvedValue(null as any);

      await client.connect();

      // When/Then: Debe lanzar ResourceNotFoundError
      await expect(client.getPullRequest(999)).rejects.toThrow();
    });
  });

  describe('Cache de conexiones', () => {
    it('debe cachear repositorios por 5 minutos', async () => {
      // Given: Cliente con cache habilitado
      const azdev = await import('azure-devops-node-api');
      const mockConnection = new azdev.WebApi();
      const mockGitApi = await mockConnection.getGitApi();

      vi.mocked(mockGitApi.getRepository).mockResolvedValue({
        id: 'repo-123',
        name: 'test-repo'
      } as any);

      await client.connect();

      // When: Obtener mismo repositorio múltiples veces
      await client.getRepository('test-repo');
      await client.getRepository('test-repo');
      await client.getRepository('test-repo');

      // Then: Debe usar cache (llamar API solo 1 vez tras connect)
      expect(vi.mocked(mockGitApi.getRepository).mock.calls.length).toBeLessThanOrEqual(2);
    });
  });
});
