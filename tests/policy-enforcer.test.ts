import { PolicyEnforcer } from '../src/policy-enforcer';
import { PipelineGenerator } from '../src/pipeline-generator';
import { WikiParser } from '../src/wiki-parser';

describe('Policy Enforcer - Políticas de Seguridad Obligatorias', () => {
  let enforcer: PolicyEnforcer;
  let generator: PipelineGenerator;
  let wikiParser: WikiParser;

  beforeEach(async () => {
    wikiParser = new WikiParser('./wiki/standards');
    await wikiParser.loadStandards();
    enforcer = new PolicyEnforcer(wikiParser);
    await enforcer.loadPolicies();
    generator = new PipelineGenerator(wikiParser);
  });

  describe('Escenario: Aplicar políticas de seguridad obligatorias', () => {
    it('debe incluir todas las políticas de seguridad obligatorias', async () => {
      // Given: La wiki define políticas de seguridad obligatorias
      const mandatoryPolicies = enforcer.getMandatoryPolicies();
      expect(mandatoryPolicies.length).toBeGreaterThan(0);
      
      // When: Genero cualquier pipeline
      const standards = await wikiParser.getStandardsForProject('dotnet');
      const pipeline = await generator.generatePipeline({
        projectType: 'dotnet',
        services: [],
        environment: 'prod',
        standards,
        enforceAllPolicies: true
      });

      // Then: Se incluyen automáticamente las herramientas requeridas
      
      // Secret scanning - TruffleHog
      expect(pipeline).toContain('TruffleHog@1');
      expect(pipeline).toContain('🔐');
      expect(pipeline).toContain('failOnSecrets');
      
      // SAST - SonarQube
      expect(pipeline).toContain('SonarQubePrepare@5');
      expect(pipeline).toContain('SonarQubeAnalyze@5');
      expect(pipeline).toContain('SonarQubePublish@5');
      expect(pipeline).toContain('Quality Gate');
      
      // Dependency scanning - Snyk
      expect(pipeline).toContain('SnykSecurityScan@1');
      expect(pipeline).toContain('severityThreshold');
      
      // Y estas tareas fallan el build si encuentran vulnerabilidades críticas
      expect(pipeline).toContain('continueOnError: false');
      expect(pipeline).toContain('exit 1');
    });

    it('debe incluir escaneo de contenedores cuando se usa Docker', async () => {
      // Given: Un proyecto que usa Docker
      const standards = await wikiParser.getStandardsForProject('node');
      
      // When: Genero pipeline con Docker habilitado
      const pipeline = await generator.generatePipeline({
        projectType: 'node',
        services: [],
        environment: 'prod',
        standards,
        usesDocker: true,
        enforceAllPolicies: true
      });

      // Then: Debe incluir Trivy para escaneo de contenedores
      expect(pipeline).toContain('trivy@1');
      expect(pipeline).toContain('🐳');
      expect(pipeline).toContain('exitCode:');
      expect(pipeline).toContain('severities: \'CRITICAL,HIGH\'');
      
      // Y análisis de Dockerfile
      expect(pipeline).toContain('hadolint');
      expect(pipeline).toContain('Dockerfile');
    });

    it('debe aplicar políticas específicas por tipo de proyecto', async () => {
      // Node.js
      const nodeStandards = await wikiParser.getStandardsForProject('node');
      const nodePipeline = await generator.generatePipeline({
        projectType: 'node',
        services: [],
        environment: 'staging',
        standards: nodeStandards,
        enforceAllPolicies: true
      });
      
      expect(nodePipeline).toContain('npm audit --audit-level=high');
      expect(nodePipeline).toContain('🔒 NPM Security Audit');

      // .NET
      const dotnetStandards = await wikiParser.getStandardsForProject('dotnet');
      const dotnetPipeline = await generator.generatePipeline({
        projectType: 'dotnet',
        services: [],
        environment: 'staging',
        standards: dotnetStandards,
        enforceAllPolicies: true
      });
      
      expect(dotnetPipeline).toContain('package --vulnerable --include-transitive');
      expect(dotnetPipeline).toContain('🔒 .NET Vulnerability Check');

      // Python
      const pythonStandards = await wikiParser.getStandardsForProject('python');
      const pythonPipeline = await generator.generatePipeline({
        projectType: 'python',
        services: [],
        environment: 'staging',
        standards: pythonStandards,
        enforceAllPolicies: true
      });
      
      expect(pythonPipeline).toContain('safety check');
      expect(pythonPipeline).toContain('🔒 Python Safety Check');
    });

    it('debe generar reporte de compliance', async () => {
      // Given: Pipeline con todas las políticas
      const standards = await wikiParser.getStandardsForProject('dotnet');
      
      // When: Genero pipeline
      const pipeline = await generator.generatePipeline({
        projectType: 'dotnet',
        services: ['azuresql'],
        environment: 'prod',
        standards,
        enforceAllPolicies: true
      });

      // Then: Debe generar y publicar reporte de compliance
      expect(pipeline).toContain('RESUMEN DE POLÍTICAS DE SEGURIDAD');
      expect(pipeline).toContain('security-compliance-report.json');
      expect(pipeline).toContain('ComplianceStatus');
      expect(pipeline).toContain('PublishBuildArtifacts@1');
      expect(pipeline).toContain('artifactName: \'security-compliance\'');
    });
  });

  describe('Validación de políticas', () => {
    it('debe validar que todas las políticas obligatorias están implementadas', () => {
      // Given: Un pipeline sin todas las políticas
      const incompletePipeline = `
stages:
- stage: Security
  jobs:
  - job: SecurityScan
    steps:
    - task: SonarQubePrepare@5
`;

      // When: Valido el pipeline
      const result = enforcer.enforcePolicy(incompletePipeline, {
        projectType: 'dotnet',
        environment: 'prod'
      });

      // Then: Debe detectar políticas faltantes
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('SEC-001'))).toBe(true); // Secret scanning
      expect(result.errors.some(e => e.includes('SEC-003'))).toBe(true); // Dependency scanning
    });

    it('debe marcar políticas como aplicadas cuando están presentes', () => {
      // Given: Un pipeline completo
      const completePipeline = `
stages:
- stage: Security
  jobs:
  - job: SecurityScan
    steps:
    - task: TruffleHog@1
    - task: SonarQubePrepare@5
    - task: SnykSecurityScan@1
`;

      // When: Valido el pipeline
      const result = enforcer.enforcePolicy(completePipeline, {
        projectType: 'node',
        environment: 'prod'
      });

      // Then: Debe reconocer las políticas aplicadas
      expect(result.applied.length).toBeGreaterThan(0);
      expect(result.errors.length).toBe(0);
    });

    it('debe aplicar políticas condicionales solo cuando apliquen', () => {
      // Given: Contexto sin Docker
      const context = {
        projectType: 'python' as const,
        usesDocker: false,
        environment: 'dev' as const
      };

      // When: Obtengo políticas aplicables
      const policies = enforcer.getApplicablePolicies(context);

      // Then: No debe incluir políticas de Docker
      const dockerPolicies = policies.filter(p => p.id === 'SEC-004');
      expect(dockerPolicies.length).toBe(0);
    });
  });

  describe('Generación de Security Stage', () => {
    it('debe generar un stage completo con todas las políticas', () => {
      // When: Genero security stage
      const securityStage = enforcer.generateSecurityStage('dotnet', {
        usesDocker: true,
        environment: 'prod'
      });

      // Then: Debe contener estructura completa
      expect(securityStage).toContain('- stage: Security');
      expect(securityStage).toContain('Análisis de Seguridad (Políticas Obligatorias)');
      expect(securityStage).toContain('pool:');
      expect(securityStage).toContain('vmImage: \'ubuntu-latest\'');
      
      // Y todas las categorías de políticas
      expect(securityStage).toContain('SEC-001'); // Secrets
      expect(securityStage).toContain('SEC-002'); // SAST
      expect(securityStage).toContain('SEC-003'); // Dependencies
      expect(securityStage).toContain('SEC-004'); // Containers (cuando usa Docker)
    });

    it('debe incluir validaciones adicionales de secretos', () => {
      // When: Genero security stage
      const securityStage = enforcer.generateSecurityStage('node');

      // Then: Debe incluir búsqueda de patrones peligrosos
      expect(securityStage).toContain('Verificando patrones de secretos comunes');
      expect(securityStage).toContain('password');
      expect(securityStage).toContain('api[_-]?key');
      expect(securityStage).toContain('Se encontraron posibles passwords hardcodeados');
    });

    it('debe configurar correctamente SonarQube por lenguaje', () => {
      // .NET
      const dotnetStage = enforcer.generateSecurityStage('dotnet');
      expect(dotnetStage).toContain('sonar.cs.opencover.reportsPaths');
      expect(dotnetStage).toContain('sonar.cs.vstest.reportsPaths');

      // Node.js
      const nodeStage = enforcer.generateSecurityStage('node');
      expect(nodeStage).toContain('sonar.javascript.lcov.reportPaths');
      expect(nodeStage).toContain('sonar.typescript.lcov.reportPaths');

      // Python
      const pythonStage = enforcer.generateSecurityStage('python');
      expect(pythonStage).toContain('sonar.python.coverage.reportPaths');
      expect(pythonStage).toContain('sonar.python.xunit.reportPath');
    });
  });
});
