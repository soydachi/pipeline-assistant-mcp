import { WikiManager } from '../src/wiki-manager';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs
jest.mock('fs');

describe('Wiki Manager - Feature 5', () => {
  let wikiManager: WikiManager;
  const mockWikiPath = '/mock/wiki/path';
  
  beforeEach(() => {
    wikiManager = new WikiManager(mockWikiPath);
    jest.clearAllMocks();
  });

  afterEach(() => {
    wikiManager.stopAutoUpdate();
  });

  describe('Escenario: Parsear markdown de wiki a reglas', () => {
    it('debe parsear sección "## Obligatorio" y extraer reglas', async () => {
      // Given: La wiki tiene sección "## Obligatorio"
      const markdownContent = `
# Pipeline Standards

## Obligatorio

### SEC-001: Escaneo de Secretos
Descripción: Todos los pipelines deben escanear secretos
Severidad: CRITICAL
Tags: security, secrets
Categoría: Security

\`\`\`yaml
- task: TruffleHog@1
  inputs:
    failOnSecrets: true
\`\`\`

Fix: Agregar TruffleHog al stage de Security

### SEC-002: Análisis SAST
Descripción: Análisis estático de código obligatorio
Severidad: HIGH

\`\`\`yaml
- task: SonarQubePrepare@5
\`\`\`
`;

      // When: El parser procesa el contenido
      const rules = await wikiManager.parseMarkdownToRules(markdownContent);

      // Then: Extrae reglas de tipo "mandatory"
      expect(rules).toHaveLength(2);
      
      // Y cada regla tiene los campos requeridos
      const rule1 = rules[0];
      expect(rule1.id).toBe('sec-001-escaneo-de-secretos');
      expect(rule1.name).toBe('SEC-001: Escaneo de Secretos');
      expect(rule1.description).toBe('Todos los pipelines deben escanear secretos');
      expect(rule1.severity).toBe('CRITICAL');
      expect(rule1.type).toBe('mandatory');
      expect(rule1.example).toContain('TruffleHog@1');
      expect(rule1.tags).toContain('security');
      expect(rule1.tags).toContain('secrets');
      expect(rule1.category).toBe('Security');
      expect(rule1.fix).toBe('Agregar TruffleHog al stage de Security');
      
      const rule2 = rules[1];
      expect(rule2.id).toBe('sec-002-análisis-sast');
      expect(rule2.severity).toBe('HIGH');
    });

    it('debe procesar múltiples secciones (Obligatorio, Recomendado, Prohibido)', async () => {
      const markdownContent = `
## Obligatorio
### Regla obligatoria
Descripción: Test obligatorio

## Recomendado  
### Regla recomendada
Descripción: Test recomendado

## Prohibido
### Regla prohibida
Descripción: Test prohibido
`;

      const rules = await wikiManager.parseMarkdownToRules(markdownContent);

      const mandatory = rules.filter(r => r.type === 'mandatory');
      const recommended = rules.filter(r => r.type === 'recommended');
      const forbidden = rules.filter(r => r.type === 'forbidden');

      expect(mandatory).toHaveLength(1);
      expect(recommended).toHaveLength(1);
      expect(forbidden).toHaveLength(1);
    });

    it('debe crear funciones de verificación basadas en el contenido', async () => {
      const markdownContent = `
## Obligatorio
### Usar TruffleHog
\`\`\`yaml
- task: TruffleHog@1
\`\`\`

## Prohibido
### No usar trigger: true
\`\`\`yaml
trigger: true
\`\`\`
`;

      const rules = await wikiManager.parseMarkdownToRules(markdownContent);
      
      const mandatoryRule = rules.find(r => r.name.includes('TruffleHog'));
      const forbiddenRule = rules.find(r => r.name.includes('trigger'));

      // Verificar que las funciones de check funcionan
      const pipelineWithTruffleHog = 'stages:\n  - task: TruffleHog@1';
      const pipelineWithoutTruffleHog = 'stages:\n  - task: OtherTask@1';
      const pipelineWithUnsafeTrigger = 'trigger: true\nstages:';

      expect(mandatoryRule?.check(pipelineWithTruffleHog)).toBe(true);
      expect(mandatoryRule?.check(pipelineWithoutTruffleHog)).toBe(false);
      expect(forbiddenRule?.check(pipelineWithUnsafeTrigger)).toBe(false);
    });
  });

  describe('Escenario: Actualización automática de estándares', () => {
    it('debe recargar estándares cuando la wiki se actualiza', async () => {
      // Setup mocks
      let fileContent = 'version: 1';
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockImplementation(() => fileContent);
      (fs.readdirSync as jest.Mock).mockReturnValue([]);
      (fs.promises.readFile as any) = jest.fn().mockResolvedValue(fileContent);
      (fs.promises.writeFile as any) = jest.fn().mockResolvedValue(undefined);
      
      // Espiar eventos
      const updateListener = jest.fn();
      wikiManager.on('standards:updated', updateListener);

      // Given: La wiki se actualiza con nuevas políticas
      await wikiManager.startAutoUpdate(100); // 100ms para test rápido

      // Simular cambio de archivo
      fileContent = 'version: 2\nnew content';

      // When: Pasan 5 minutos (o se fuerza refresh) - simulado con timeout corto
      await new Promise(resolve => setTimeout(resolve, 150));

      // Then: El MCP recarga los estándares
      expect(updateListener).toHaveBeenCalled();
      
      // Y notifica a clientes conectados sobre cambios
      const updateEvent = updateListener.mock.calls[0][0];
      expect(updateEvent).toHaveProperty('newChecksum');
      expect(updateEvent).toHaveProperty('timestamp');
    });

    it('debe detectar cambios mediante checksum', async () => {
      // Mock de archivos
      const files = [
        { name: 'standards.md', content: 'content1' },
        { name: 'policies.yaml', content: 'content2' }
      ];
      
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readdirSync as jest.Mock).mockReturnValue(
        files.map(f => ({ name: f.name, isFile: () => true, isDirectory: () => false }))
      );
      (fs.readFileSync as jest.Mock).mockImplementation((file) => {
        const f = files.find(f => file.includes(f.name));
        return f ? f.content : '';
      });

      // Calcular checksum inicial
      const checksum1 = await wikiManager['calculateChecksum']();
      
      // Cambiar contenido
      files[0].content = 'modified content';
      
      // Calcular nuevo checksum
      const checksum2 = await wikiManager['calculateChecksum']();
      
      expect(checksum1).not.toBe(checksum2);
    });

    it('debe emitir evento cuando se actualizan los estándares', async () => {
      const loadedListener = jest.fn();
      const updatedListener = jest.fn();
      
      wikiManager.on('wiki:loaded', loadedListener);
      wikiManager.on('standards:updated', updatedListener);

      // Mock básico para loadAllStandards
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.promises.readFile as any) = jest.fn().mockResolvedValue('# Standards');
      (fs.readFileSync as jest.Mock).mockReturnValue('# Standards');
      (fs.readdirSync as jest.Mock).mockReturnValue([]);

      await wikiManager.loadAllStandards();

      expect(loadedListener).toHaveBeenCalled();
      expect(loadedListener.mock.calls[0][0]).toHaveProperty('standards');
      expect(loadedListener.mock.calls[0][0]).toHaveProperty('rules');
      expect(loadedListener.mock.calls[0][0]).toHaveProperty('templates');
    });
  });

  describe('Escenario: Templates específicos por tecnología', () => {
    it('debe cargar y servir template para microservicio-dotnet', async () => {
      // Given: Tenemos templates para diferentes stacks
      const dotnetTemplate = `# metadata:
#   name: Microservicio .NET
#   technology: dotnet
#   features:
#     - Multi-stage pipeline
#     - Docker build and push to ACR
#     - Helm deployment
#     - Health checks

trigger:
  branches:
    include: [main]

stages:
  - stage: Build
    jobs:
      - job: BuildJob
        steps:
          - task: DotNetCoreCLI@2
`;

      const templatesDir = path.join(mockWikiPath, 'templates');
      (fs.existsSync as jest.Mock).mockImplementation((p) => p === templatesDir);
      (fs.readdirSync as jest.Mock).mockReturnValue(['microservicio-dotnet.yml']);
      (fs.readFileSync as jest.Mock).mockReturnValue(dotnetTemplate);

      await wikiManager.loadTechnologyTemplates();

      // When: Solicito template para "microservicio-dotnet"
      const template = wikiManager.getTemplate('microservicio-dotnet');

      // Then: Obtengo pipeline con características específicas
      expect(template).toBeDefined();
      expect(template?.technology).toBe('dotnet');
      expect(template?.template).toContain('DotNetCoreCLI@2');
      
      // Verificar metadata
      expect(template?.metadata?.multiStage).toBe(true);
      expect(template?.metadata?.dockerized).toBe(false); // No contiene 'Docker' en este ejemplo
      expect(template?.metadata?.helmChart).toBe(false); // No contiene 'HelmDeploy' en este ejemplo
    });

    it('debe crear templates por defecto si no existen', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      (fs.mkdirSync as jest.Mock).mockImplementation(() => {});
      (fs.writeFileSync as jest.Mock).mockImplementation(() => {});

      await wikiManager.loadTechnologyTemplates();

      // Verificar que se crearon los templates por defecto
      expect(fs.mkdirSync).toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalledTimes(3); // dotnet, node, python
    });

    it('debe filtrar templates por tecnología', async () => {
      // Setup múltiples templates
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readdirSync as jest.Mock).mockReturnValue([
        'microservicio-dotnet.yml',
        'api-dotnet.yml',
        'microservicio-node.yml',
        'lambda-python.yml'
      ]);
      (fs.readFileSync as jest.Mock).mockImplementation((file) => {
        if (file.includes('dotnet')) return '# technology: dotnet';
        if (file.includes('node')) return '# technology: node';
        if (file.includes('python')) return '# technology: python';
        return '';
      });

      await wikiManager.loadTechnologyTemplates();

      const dotnetTemplates = wikiManager.getTemplatesByTechnology('dotnet');
      const nodeTemplates = wikiManager.getTemplatesByTechnology('node');
      const pythonTemplates = wikiManager.getTemplatesByTechnology('python');

      expect(dotnetTemplates).toHaveLength(2);
      expect(nodeTemplates).toHaveLength(1);
      expect(pythonTemplates).toHaveLength(1);
    });
  });

  describe('Escenario: Versionado de políticas', () => {
    it('debe guardar versión cuando se modifica un estándar', async () => {
      const saveListener = jest.fn();
      wikiManager.on('version:saved', saveListener);

      // Mock para guardar
      (fs.promises.writeFile as any) = jest.fn().mockResolvedValue(undefined);

      // Given: Necesito auditar cambios en políticas
      const justification = 'Actualización de políticas de seguridad Q4 2024';

      // When: Se modifica un estándar
      await wikiManager['saveCurrentVersion'](justification);

      // Then: Se guarda la información requerida
      expect(saveListener).toHaveBeenCalled();
      
      const savedVersion = saveListener.mock.calls[0][0];
      expect(savedVersion).toHaveProperty('version');
      expect(savedVersion).toHaveProperty('date');
      expect(savedVersion).toHaveProperty('author');
      expect(savedVersion).toHaveProperty('justification');
      expect(savedVersion.justification).toBe(justification);
    });

    it('debe detectar cambios entre versiones', () => {
      // Simular versión anterior
      const previousStandards = [
        { id: 'std1', description: 'Standard 1', severity: 'HIGH' },
        { id: 'std2', description: 'Standard 2', severity: 'LOW' }
      ];

      wikiManager['policyHistory'] = [{
        version: '2024.1.1.0',
        date: new Date('2024-01-01'),
        author: 'user',
        changes: [],
        justification: 'Initial',
        standards: previousStandards,
        checksum: 'abc'
      }];

      // Simular estándares actuales
      wikiManager['standards'].set('std1', { 
        id: 'std1', 
        description: 'Standard 1 Modified',
        severity: 'CRITICAL' 
      } as any);
      wikiManager['standards'].set('std3', {
        id: 'std3',
        description: 'New Standard 3',
        severity: 'MEDIUM'
      } as any);

      const changes = wikiManager['detectChanges']();

      expect(changes).toContain('Modified: std1 - severity: HIGH → CRITICAL, description updated');
      expect(changes).toContain('Removed: std2 - Standard 2');
      expect(changes).toContain('Added: std3 - New Standard 3');
    });

    it('debe permitir rollback a versión anterior', async () => {
      // Setup historial
      const version1 = {
        version: '2024.1.1.0',
        date: new Date('2024-01-01'),
        author: 'user',
        changes: ['Initial'],
        justification: 'Initial version',
        standards: [
          { id: 'std1', description: 'Original', severity: 'LOW' }
        ],
        checksum: 'v1'
      };

      wikiManager['policyHistory'] = [version1];
      
      // Estado actual diferente
      wikiManager['standards'].set('std1', {
        id: 'std1',
        description: 'Modified',
        severity: 'HIGH'
      } as any);

      // Mock para guardar
      (fs.promises.writeFile as any) = jest.fn().mockResolvedValue(undefined);

      // Hacer rollback
      const success = await wikiManager.rollbackToVersion('2024.1.1.0');

      expect(success).toBe(true);
      
      // Verificar que se restauró la versión anterior
      const restoredStandard = wikiManager['standards'].get('std1');
      expect(restoredStandard?.description).toBe('Original');
      expect(restoredStandard?.severity).toBe('LOW');
    });
  });

  describe('Escenario: Exportar métricas de adopción', () => {
    it('debe generar reporte con todas las métricas requeridas', async () => {
      // Given: Quiero medir adopción de estándares
      const analysisResults = [
        {
          score: 85,
          violations: [
            { type: 'MISSING_STAGE', severity: 'HIGH' },
            { type: 'MISSING_STAGE', severity: 'HIGH' },
            { type: 'HARDCODED_SECRET', severity: 'CRITICAL' }
          ]
        },
        {
          score: 92,
          violations: []
        },
        {
          score: 65,
          violations: [
            { type: 'UNSAFE_TRIGGER', severity: 'HIGH' },
            { type: 'MISSING_CACHE', severity: 'LOW' }
          ]
        }
      ];

      await wikiManager.recordMetrics(analysisResults);

      // When: Genero reporte mensual
      const report = await wikiManager.generateMetricsReport('markdown');

      // Then: Obtengo todas las métricas
      expect(report).toContain('Pipelines Analizados | 3');
      expect(report).toContain('Compliance Promedio');
      expect(report).toContain('Top 10 Violaciones');
      
      // Verificar cálculo de compliance promedio
      const avgCompliance = (85 + 92 + 65) / 3;
      expect(report).toContain(avgCompliance.toFixed(1));
    });

    it('debe calcular distribución de compliance correctamente', async () => {
      const analysisResults = [
        { score: 95 },  // Excelente
        { score: 91 },  // Excelente
        { score: 85 },  // Bueno
        { score: 75 },  // Regular
        { score: 65 },  // Regular
        { score: 45 }   // Pobre
      ];

      await wikiManager.recordMetrics(analysisResults);
      
      const metrics = wikiManager.getCurrentMonthMetrics();

      expect(metrics?.compliance.distribution.excellent).toBe(2);
      expect(metrics?.compliance.distribution.good).toBe(1);
      expect(metrics?.compliance.distribution.fair).toBe(2);
      expect(metrics?.compliance.distribution.poor).toBe(1);
    });

    it('debe identificar top violaciones', async () => {
      const analysisResults = [
        {
          score: 70,
          violations: [
            { type: 'MISSING_STAGE', severity: 'HIGH' },
            { type: 'MISSING_STAGE', severity: 'HIGH' },
            { type: 'HARDCODED_SECRET', severity: 'CRITICAL' },
            { type: 'HARDCODED_SECRET', severity: 'CRITICAL' },
            { type: 'HARDCODED_SECRET', severity: 'CRITICAL' },
            { type: 'UNSAFE_TRIGGER', severity: 'HIGH' }
          ]
        }
      ];

      await wikiManager.recordMetrics(analysisResults);
      
      const metrics = wikiManager.getCurrentMonthMetrics();
      const topViolations = metrics?.violations.topViolations || [];

      expect(topViolations[0].type).toBe('HARDCODED_SECRET');
      expect(topViolations[0].count).toBe(3);
      expect(topViolations[1].type).toBe('MISSING_STAGE');
      expect(topViolations[1].count).toBe(2);
    });

    it('debe calcular tendencias mes a mes', async () => {
      // Simular mes anterior
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      
      wikiManager['metrics'] = [{
        period: {
          start: new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1),
          end: new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0)
        },
        pipelines: { analyzed: 10, generated: 5, fixed: 3 },
        compliance: {
          average: 70,
          trend: 0,
          distribution: { excellent: 2, good: 3, fair: 3, poor: 2 }
        },
        violations: {
          total: 50,
          byType: new Map(),
          bySeverity: { critical: 10, high: 15, medium: 20, low: 5 },
          topViolations: []
        },
        improvements: {
          monthOverMonth: 0,
          resolvedIssues: 0,
          newAdoptions: 0
        }
      }];

      // Registrar métricas del mes actual
      const currentResults = [
        { score: 80 },
        { score: 85 },
        { score: 75 }
      ];

      await wikiManager.recordMetrics(currentResults);
      
      const currentMetrics = wikiManager.getCurrentMonthMetrics();

      // Verificar cálculo de tendencia
      expect(currentMetrics?.compliance.trend).toBeGreaterThan(0);
      expect(currentMetrics?.improvements.monthOverMonth).toBeGreaterThan(0);
    });

    it('debe generar reporte en diferentes formatos', async () => {
      await wikiManager.recordMetrics([{ score: 85 }]);

      const jsonReport = await wikiManager.generateMetricsReport('json');
      const htmlReport = await wikiManager.generateMetricsReport('html');
      const markdownReport = await wikiManager.generateMetricsReport('markdown');

      expect(() => JSON.parse(jsonReport)).not.toThrow();
      expect(htmlReport).toContain('<!DOCTYPE html>');
      expect(markdownReport).toContain('#');
    });
  });

  describe('Funcionalidades adicionales del WikiManager', () => {
    it('debe manejar eventos de ciclo de vida correctamente', async () => {
      const startListener = jest.fn();
      const stopListener = jest.fn();
      
      wikiManager.on('autoupdate:started', startListener);
      wikiManager.on('autoupdate:stopped', stopListener);

      await wikiManager.startAutoUpdate(1000);
      expect(startListener).toHaveBeenCalledWith({ intervalMs: 1000 });

      wikiManager.stopAutoUpdate();
      expect(stopListener).toHaveBeenCalled();
    });

    it('debe mantener historial limitado de versiones', async () => {
      (fs.promises.writeFile as any) = jest.fn().mockResolvedValue(undefined);

      // Crear más de 50 versiones
      for (let i = 0; i < 60; i++) {
        await wikiManager['saveCurrentVersion'](`Version ${i}`);
      }

      // Verificar que solo mantiene las últimas 50
      expect(wikiManager['policyHistory'].length).toBe(50);
      expect(wikiManager['policyHistory'][0].justification).toBe('Version 10');
      expect(wikiManager['policyHistory'][49].justification).toBe('Version 59');
    });
  });
});
