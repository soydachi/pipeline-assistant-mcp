import { PipelineAnalyzer } from '../src/pipeline-analyzer';
import { WikiParser } from '../src/wiki-parser';

describe('Pipeline Analyzer - Feature 2', () => {
  let analyzer: PipelineAnalyzer;
  let wikiParser: WikiParser;

  beforeEach(async () => {
    wikiParser = new WikiParser('./wiki/standards');
    await wikiParser.loadStandards();
    analyzer = new PipelineAnalyzer(wikiParser);
  });

  describe('Escenario: Detectar violaciones críticas', () => {
    it('debe detectar pipeline sin stage de seguridad', async () => {
      // Given: Tengo un pipeline sin stage de seguridad
      const pipelineWithoutSecurity = `
trigger:
  branches:
    include:
      - main

stages:
  - stage: Build
    jobs:
      - job: BuildJob
        steps:
          - script: echo "Building..."
  
  - stage: Test
    jobs:
      - job: TestJob
        steps:
          - script: echo "Testing..."
`;

      // When: Ejecuto el análisis con "analyze_pipeline"
      const result = await analyzer.analyze(pipelineWithoutSecurity);

      // Then: Recibo una violación de severidad "CRITICAL"
      const securityViolation = result.violations.find(
        v => v.type === 'MISSING_MANDATORY_STAGE' && v.message.includes('Security')
      );
      expect(securityViolation).toBeDefined();
      expect(securityViolation?.severity).toBe('CRITICAL');

      // Y el mensaje indica "Stage obligatorio faltante: Security"
      expect(securityViolation?.message).toBe('Stage obligatorio faltante: Security');

      // Y se proporciona código de ejemplo para añadir el stage
      expect(securityViolation?.code).toBeDefined();
      expect(securityViolation?.code).toContain('- stage: Security');
      expect(securityViolation?.code).toContain('TruffleHog@1');
      expect(securityViolation?.code).toContain('SonarQubePrepare@5');
      expect(securityViolation?.code).toContain('SnykSecurityScan@1');
    });

    it('debe detectar múltiples stages faltantes', async () => {
      // Given: Pipeline con solo Build stage
      const minimalPipeline = `
trigger: main

stages:
  - stage: Build
    jobs:
      - job: BuildJob
        steps:
          - script: echo "Build"
`;

      // When: Analizo el pipeline
      const result = await analyzer.analyze(minimalPipeline);

      // Then: Debe detectar todos los stages faltantes
      const missingStages = result.violations.filter(
        v => v.type === 'MISSING_MANDATORY_STAGE'
      );

      expect(missingStages.length).toBeGreaterThanOrEqual(3); // Validate, Security, Test
      
      const stageNames = missingStages.map(v => v.message);
      expect(stageNames).toContain('Stage obligatorio faltante: Validate');
      expect(stageNames).toContain('Stage obligatorio faltante: Security');
      expect(stageNames).toContain('Stage obligatorio faltante: Test');
    });

    it('debe detectar pipeline sin estructura de stages', async () => {
      // Given: Pipeline sin stages ni jobs
      const invalidPipeline = `
trigger: main
pool:
  vmImage: ubuntu-latest

steps:
  - script: echo "Hello"
`;

      // When: Analizo el pipeline
      const result = await analyzer.analyze(invalidPipeline);

      // Then: Debe detectar violación crítica de estructura
      const structureViolation = result.violations.find(
        v => v.type === 'MISSING_STRUCTURE'
      );
      
      expect(structureViolation).toBeDefined();
      expect(structureViolation?.severity).toBe('CRITICAL');
      expect(structureViolation?.message).toContain('debe contener "stages" o "jobs"');
    });

    it('debe proporcionar templates correctos para cada stage faltante', async () => {
      // Given: Pipeline sin Security stage
      const pipeline = `
stages:
  - stage: Validate
  - stage: Build
  - stage: Test
`;

      // When: Analizo
      const result = await analyzer.analyze(pipeline);

      // Then: Debe proporcionar template específico de Security
      const securityViolation = result.violations.find(
        v => v.message.includes('Security')
      );

      expect(securityViolation?.code).toContain('- stage: Security');
      expect(securityViolation?.code).toContain('dependsOn: Validate');
      expect(securityViolation?.code).toContain('SecurityScan');
      expect(securityViolation?.suggestion).toContain('estándares corporativos');
    });
  });

  describe('Escenario: Detectar configuraciones inseguras', () => {
    it('debe detectar passwords hardcodeados', async () => {
      // Given: Mi pipeline tiene passwords hardcodeados
      const insecurePipeline = `
trigger: main

variables:
  - name: dbPassword
    value: "MySecretPass123!"
  - name: apiKey
    value: "sk-1234567890abcdef"

stages:
  - stage: Deploy
    jobs:
      - job: DeployJob
        steps:
          - script: |
              echo "password: admin123"
              connectionString="Server=myserver;Password=secret123;"
`;

      // When: Se analiza el contenido YAML
      const result = await analyzer.analyze(insecurePipeline);

      // Then: Se detecta una violación "NO_SECRETS"
      const secretViolations = result.violations.filter(
        v => v.type === 'HARDCODED_SECRET'
      );

      expect(secretViolations.length).toBeGreaterThan(0);
      expect(secretViolations[0].severity).toBe('CRITICAL');
      expect(secretViolations[0].rule).toBe('NO_SECRETS');

      // Y se sugiere usar Azure Key Vault
      expect(secretViolations[0].suggestion).toContain('Azure Key Vault');
      expect(secretViolations[0].code).toContain('AzureKeyVault@2');

      // Y el análisis retorna un score de compliance < 50%
      expect(result.score).toBeLessThan(50);
    });

    it('debe detectar múltiples tipos de secretos', async () => {
      // Given: Diferentes tipos de secretos hardcodeados
      const pipeline = `
variables:
  - name: password
    value: "admin123"
  - name: pwd
    value: "secret"
  - name: api_key
    value: "abc123"
  - name: token
    value: "bearer-token"
  - name: secret
    value: "my-secret"
  - name: connectionString
    value: "Data Source=server;Password=pass123"
`;

      // When: Analizo
      const result = await analyzer.analyze(pipeline);

      // Then: Debe detectar todos los tipos
      const violations = result.violations.filter(v => v.type === 'HARDCODED_SECRET');
      expect(violations.length).toBeGreaterThanOrEqual(5);
    });

    it('debe ignorar referencias a variables seguras', async () => {
      // Given: Pipeline con variables seguras (usando $())
      const securePipeline = `
variables:
  - name: password
    value: "$(DB_PASSWORD)"
  - name: apiKey
    value: "$(API_KEY)"
  - group: my-secrets

stages:
  - stage: Build
    jobs:
      - job: Build
        steps:
          - script: echo "Using $(SECRET_VALUE)"
`;

      // When: Analizo
      const result = await analyzer.analyze(securePipeline);

      // Then: No debe detectar secretos hardcodeados
      const secretViolations = result.violations.filter(
        v => v.type === 'HARDCODED_SECRET'
      );
      expect(secretViolations.length).toBe(0);
    });

    it('debe detectar bypass de seguridad con continueOnError', async () => {
      // Given: Tareas de seguridad con continueOnError: true
      const bypassPipeline = `
stages:
  - stage: Security
    jobs:
      - job: Scan
        steps:
          - task: SonarQubePrepare@5
            continueOnError: true
          - task: SnykSecurityScan@1
            continueOnError: true
`;

      // When: Analizo
      const result = await analyzer.analyze(bypassPipeline);

      // Then: Debe detectar bypass de seguridad
      const bypassViolations = result.violations.filter(
        v => v.type === 'SECURITY_BYPASS'
      );

      expect(bypassViolations.length).toBeGreaterThan(0);
      expect(bypassViolations[0].severity).toBe('HIGH');
      expect(bypassViolations[0].message).toContain('continuar en error');
    });
  });

  describe('Escenario: Sugerir mejoras de rendimiento', () => {
    it('debe sugerir caché para dependencias', async () => {
      // Given: Mi pipeline no usa caché para dependencias
      const pipelineWithoutCache = `
trigger: main

stages:
  - stage: Build
    jobs:
      - job: BuildJob
        steps:
          - task: NodeTool@0
            inputs:
              versionSpec: '16.x'
          - script: npm install
          - script: npm run build
`;

      // When: Analizo el pipeline en modo normal
      const result = await analyzer.analyze(pipelineWithoutCache, {
        projectType: 'node'
      });

      // Then: Recibo una sugerencia de tipo "PERFORMANCE"
      const cacheSuggestion = result.suggestions.find(
        s => s.type === 'PERFORMANCE' && s.message.includes('caché')
      );

      expect(cacheSuggestion).toBeDefined();
      expect(cacheSuggestion?.priority).toBeDefined();

      // Y se proporciona ejemplo de configuración de caché
      expect(cacheSuggestion?.code).toBeDefined();
      expect(cacheSuggestion?.code).toContain('Cache@2');
      expect(cacheSuggestion?.code).toContain('npm_config_cache');

      // Y la prioridad es apropiada
      expect(['LOW', 'MEDIUM', 'HIGH']).toContain(cacheSuggestion?.priority);
    });

    it('debe sugerir caché específico por tipo de proyecto', async () => {
      // .NET
      const dotnetPipeline = `
stages:
  - stage: Build
    jobs:
      - job: Build
        steps:
          - task: DotNetCoreCLI@2
            inputs:
              command: restore
`;

      const dotnetResult = await analyzer.analyze(dotnetPipeline, {
        projectType: 'dotnet'
      });

      const dotnetCache = dotnetResult.suggestions.find(
        s => s.message.includes('caché')
      );
      expect(dotnetCache?.code).toContain('NUGET_PACKAGES');

      // Python
      const pythonPipeline = `
stages:
  - stage: Build
    jobs:
      - job: Build
        steps:
          - script: pip install -r requirements.txt
`;

      const pythonResult = await analyzer.analyze(pythonPipeline, {
        projectType: 'python'
      });

      const pythonCache = pythonResult.suggestions.find(
        s => s.message.includes('caché')
      );
      expect(pythonCache?.code).toContain('PIP_CACHE_DIR');
    });

    it('debe sugerir paralelización de stages', async () => {
      // Given: Pipeline con múltiples stages secuenciales
      const sequentialPipeline = `
stages:
  - stage: Validate
  - stage: Security
    dependsOn: Validate
  - stage: Build
    dependsOn: Security
  - stage: Test
    dependsOn: Build
  - stage: Package
    dependsOn: Test
`;

      // When: Analizo
      const result = await analyzer.analyze(sequentialPipeline);

      // Then: Debe sugerir paralelización
      const parallelSuggestion = result.suggestions.find(
        s => s.message.includes('paralelizar')
      );

      expect(parallelSuggestion).toBeDefined();
      expect(parallelSuggestion?.description).toContain('paralelo');
    });
  });

  describe('Escenario: Validar estructura según tipo de proyecto', () => {
    it('debe detectar falta de npm audit en proyecto Node.js', async () => {
      // Given: Analizo un pipeline para proyecto Node.js
      const nodePipeline = `
stages:
  - stage: Build
    jobs:
      - job: BuildJob
        steps:
          - script: npm install
          - script: npm run build
          - script: npm test
`;

      // When: El pipeline no incluye "npm audit"
      const result = await analyzer.analyze(nodePipeline, {
        projectType: 'node'
      });

      // Then: Recibo un warning "MISSING_SECURITY_AUDIT"
      const auditWarning = result.warnings.find(
        w => w.type === 'MISSING_SECURITY_AUDIT'
      );

      expect(auditWarning).toBeDefined();
      expect(auditWarning?.message).toContain('npm audit');

      // Y se sugiere añadir el comando después de npm install
      expect(auditWarning?.suggestion).toContain('npm audit --audit-level=high');
    });

    it('debe validar requisitos específicos de .NET', async () => {
      // Given: Pipeline .NET sin verificación de vulnerabilidades
      const dotnetPipeline = `
stages:
  - stage: Build
    jobs:
      - job: Build
        steps:
          - task: DotNetCoreCLI@2
            inputs:
              command: build
`;

      // When: Analizo
      const result = await analyzer.analyze(dotnetPipeline, {
        projectType: 'dotnet'
      });

      // Then: Debe detectar falta de verificación de vulnerabilidades
      const vulnWarning = result.warnings.find(
        w => w.type === 'MISSING_VULNERABILITY_CHECK'
      );

      expect(vulnWarning).toBeDefined();
      expect(vulnWarning?.message).toContain('vulnerables');
    });

    it('debe validar requisitos específicos de Python', async () => {
      // Given: Pipeline Python sin safety check
      const pythonPipeline = `
stages:
  - stage: Build
    jobs:
      - job: Build
        steps:
          - script: pip install -r requirements.txt
          - script: python -m pytest
`;

      // When: Analizo
      const result = await analyzer.analyze(pythonPipeline, {
        projectType: 'python'
      });

      // Then: Debe detectar falta de safety check
      const safetyWarning = result.warnings.find(
        w => w.type === 'MISSING_SAFETY_CHECK'
      );

      expect(safetyWarning).toBeDefined();
      expect(safetyWarning?.message).toContain('safety check');
    });
  });

  describe('Escenario: Modo estricto vs modo normal', () => {
    it('debe convertir sugerencias en warnings en modo estricto', async () => {
      // Given: Ejecuto análisis en modo estricto
      const pipeline = `
stages:
  - stage: Validate
  - stage: Security
  - stage: Build
  - stage: Test
`;

      // When: Encuentro cualquier desviación de mejores prácticas
      const normalResult = await analyzer.analyze(pipeline, {
        strictMode: false
      });
      const strictResult = await analyzer.analyze(pipeline, {
        strictMode: true
      });

      // Then: Todas las sugerencias se convierten en warnings
      expect(strictResult.warnings.length).toBeGreaterThanOrEqual(
        normalResult.suggestions.filter(s => 
          s.priority === 'HIGH' || s.priority === 'MEDIUM'
        ).length
      );

      // Y los warnings se convierten en violaciones
      expect(strictResult.violations.length).toBeGreaterThan(
        normalResult.violations.length
      );

      // Verificar que los mensajes indican modo estricto
      const strictViolations = strictResult.violations.filter(
        v => v.message.includes('[STRICT MODE]')
      );
      expect(strictViolations.length).toBeGreaterThan(0);
    });

    it('debe tener score mínimo de 95% en modo estricto', async () => {
      // Given: Pipeline con pequeñas desviaciones
      const pipeline = `
trigger: true  # Problema menor

stages:
  - stage: Validate
  - stage: Security
  - stage: Build
  - stage: Test
`;

      // When: Analizo en modo estricto
      const result = await analyzer.analyze(pipeline, {
        strictMode: true
      });

      // Then: El score mínimo aceptable es 95%
      // Si hay violaciones, el score debe ser penalizado adicionalmente
      if (result.violations.length > 0) {
        expect(result.score).toBeLessThanOrEqual(50);
      }
    });

    it('debe comparar resultados entre modo normal y estricto', async () => {
      // Given: El mismo pipeline
      const pipeline = `
trigger:
  branches:
    include: [main]

stages:
  - stage: Build
    jobs:
      - job: Build
        steps:
          - script: npm install
          - script: npm build
`;

      // When: Analizo en ambos modos
      const normalResult = await analyzer.analyze(pipeline, {
        strictMode: false,
        projectType: 'node'
      });

      const strictResult = await analyzer.analyze(pipeline, {
        strictMode: true,
        projectType: 'node'
      });

      // Then: Modo estricto debe ser más severo
      expect(strictResult.violations.length).toBeGreaterThanOrEqual(
        normalResult.violations.length
      );
      expect(strictResult.score).toBeLessThanOrEqual(normalResult.score);
      expect(strictResult.summary.totalIssues).toBeGreaterThanOrEqual(
        normalResult.summary.totalIssues
      );
    });
  });
});
