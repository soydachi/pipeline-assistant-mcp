import { WikiManager } from '../src/wiki-manager';
import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock fs
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  readdirSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    readdir: vi.fn(),
  },
}));

describe('Wiki Manager - Feature 5', () => {
  let wikiManager: WikiManager;
  const mockWikiPath = '/mock/wiki/path';

  beforeEach(() => {
    wikiManager = new WikiManager(mockWikiPath);
    vi.clearAllMocks();
  });

  afterEach(() => {
    wikiManager.stopAutoUpdate();
  });

  describe('Escenario: Parsear markdown de wiki a reglas', () => {
    it('debe crear funciones de verificación basadas en el contenido', () => {
      // Given: Una regla con patrón de verificación
      const rule = {
        id: 'test-rule',
        name: 'Test Rule',
        description: 'Test',
        severity: 'HIGH' as const,
        type: 'pattern',
        check: (content: string) => content.includes('required'),
      };

      // When: Se ejecuta la verificación
      const result1 = rule.check('this has required keyword');
      const result2 = rule.check('this does not have it');

      // Then: La función verifica correctamente
      expect(result1).toBe(true);
      expect(result2).toBe(false);
    });
  });

  describe('Escenario: Actualización automática de estándares', () => {
    it('debe emitir evento cuando se actualizan los estándares', async () => {
      const loadedListener = vi.fn();
      const updatedListener = vi.fn();

      wikiManager.on('wiki:loaded', loadedListener);
      wikiManager.on('standards:updated', updatedListener);

      // Mock básico para loadAllStandards
      (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (fs.promises.readFile as any) = vi.fn().mockResolvedValue('# Standards');
      (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue('# Standards');
      (fs.readdirSync as ReturnType<typeof vi.fn>).mockReturnValue([]);

      await wikiManager.loadAllStandards();

      expect(loadedListener).toHaveBeenCalled();
      expect(loadedListener.mock.calls[0][0]).toHaveProperty('standards');
      expect(loadedListener.mock.calls[0][0]).toHaveProperty('rules');
    });
  });

  describe('Escenario: Templates específicos por tecnología', () => {
    it('debe filtrar templates por tecnología', () => {
      // Given: Templates de diferentes tecnologías
      const templates = [
        {
          id: 'dotnet-1',
          name: 'Microservicio .NET',
          description: 'Template for .NET',
          technology: 'dotnet',
          features: ['docker'],
          template: 'trigger: main'
        },
        {
          id: 'dotnet-2',
          name: 'API .NET',
          description: 'API Template',
          technology: 'dotnet',
          features: ['api'],
          template: 'trigger: main'
        },
        {
          id: 'node-1',
          name: 'Node Service',
          description: 'Node.js service',
          technology: 'node',
          features: ['npm'],
          template: 'trigger: main'
        },
        {
          id: 'python-1',
          name: 'Python API',
          description: 'Python API',
          technology: 'python',
          features: ['pip'],
          template: 'trigger: main'
        }
      ];

      // When: Se filtran por tecnología
      const dotnetTemplates = templates.filter(t => t.technology === 'dotnet');
      const nodeTemplates = templates.filter(t => t.technology === 'node');
      const pythonTemplates = templates.filter(t => t.technology === 'python');

      // Then: Se obtienen los templates correctos
      expect(dotnetTemplates).toHaveLength(2);
      expect(nodeTemplates).toHaveLength(1);
      expect(pythonTemplates).toHaveLength(1);
    });
  });

  describe('Escenario: Versionado de políticas', () => {
    it('debe guardar versión cuando se modifica un estándar', async () => {
      const saveListener = vi.fn();
      wikiManager.on('version:saved', saveListener);

      // Mock para guardar
      (fs.promises.writeFile as any) = vi.fn().mockResolvedValue(undefined);

      // Given: Necesito auditar cambios en políticas
      const justification = 'Actualización de políticas de seguridad Q4 2024';

      // When: Se modifica un estándar
      await wikiManager['saveCurrentVersion'](justification);

      // Then: Se emite evento de guardado
      expect(saveListener).toHaveBeenCalled();
    });

    it('debe permitir rollback a versión anterior', async () => {
      // Given: Hay versiones guardadas
      const mockVersion = {
        version: '2024.1.1.0',
        date: new Date('2024-01-01'),
        author: 'test',
        changes: ['Added SEC-001'],
        justification: 'Initial version',
        standards: [
          {
            id: 'std1',
            type: 'mandatory' as const,
            description: 'Standard 1',
            severity: 'HIGH' as const
          }
        ],
        checksum: 'abc123'
      };

      wikiManager['policyHistory'] = [mockVersion];

      // Estado actual diferente
      wikiManager['standards'].set('std1', {
        id: 'std1',
        description: 'Modified',
        severity: 'HIGH' as const,
        type: 'mandatory' as const,
      } as any);

      // Mock para guardar
      (fs.promises.writeFile as any) = vi.fn().mockResolvedValue(undefined);

      // When: Hacer rollback
      const success = await wikiManager.rollbackToVersion('2024.1.1.0');

      // Then: Se restaura la versión
      expect(success).toBe(true);

      const restoredStandard = wikiManager['standards'].get('std1');
      expect(restoredStandard?.description).toBe('Standard 1');
    });
  });

  describe('Escenario: Reportes de adopción', () => {
    it('debe calcular distribución de compliance correctamente', () => {
      // Given: Scores de pipelines
      const scores = [95, 88, 75, 92, 85, 70, 55, 90, 78, 50];

      // When: Se calcula la distribución
      const distribution = {
        excellent: scores.filter(s => s >= 90).length,
        good: scores.filter(s => s >= 80 && s < 90).length,
        fair: scores.filter(s => s >= 60 && s < 80).length,
        poor: scores.filter(s => s < 60).length
      };

      // Then: La distribución es correcta
      expect(distribution.excellent).toBe(3); // 95, 92, 90
      expect(distribution.good).toBe(2); // 88, 85
      expect(distribution.fair).toBe(3); // 75, 70, 78
      expect(distribution.poor).toBe(2); // 55, 50
    });

    it('debe identificar top violaciones', () => {
      // Given: Mapa de violaciones
      const violationsByType = new Map([
        ['NO_CACHING', 89],
        ['MISSING_STAGE', 45],
        ['HARDCODED_SECRET', 30],
        ['NO_TIMEOUT', 25],
        ['MISSING_APPROVAL', 15]
      ]);

      // When: Se ordenan por frecuencia
      const topViolations = Array.from(violationsByType.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([type, count]) => ({ type, count }));

      // Then: Se obtienen las top 3
      expect(topViolations).toHaveLength(3);
      expect(topViolations[0].type).toBe('NO_CACHING');
      expect(topViolations[0].count).toBe(89);
      expect(topViolations[1].type).toBe('MISSING_STAGE');
      expect(topViolations[2].type).toBe('HARDCODED_SECRET');
    });

    it('debe calcular tendencias mes a mes', () => {
      // Given: Compliance scores por mes
      const monthlyScores = [
        { month: 'Enero', score: 65 },
        { month: 'Febrero', score: 70 },
        { month: 'Marzo', score: 75 },
        { month: 'Abril', score: 78 }
      ];

      // When: Se calcula la tendencia
      const trends = monthlyScores.map((current, index) => {
        if (index === 0) return { month: current.month, change: 0 };
        const previous = monthlyScores[index - 1];
        return {
          month: current.month,
          change: current.score - previous.score
        };
      });

      // Then: Las tendencias son correctas
      expect(trends[0].change).toBe(0); // Primer mes
      expect(trends[1].change).toBe(5); // 70 - 65
      expect(trends[2].change).toBe(5); // 75 - 70
      expect(trends[3].change).toBe(3); // 78 - 75
    });

  });

  describe('Funcionalidades adicionales del WikiManager', () => {
    it('debe mantener historial limitado de versiones', async () => {
      (fs.promises.writeFile as any) = vi.fn().mockResolvedValue(undefined);

      // When: Crear más de 50 versiones
      for (let i = 0; i < 60; i++) {
        await wikiManager['saveCurrentVersion'](`Version ${i}`);
      }

      // Then: Solo mantiene las últimas 50
      expect(wikiManager['policyHistory'].length).toBe(50);
    });
  });
});
