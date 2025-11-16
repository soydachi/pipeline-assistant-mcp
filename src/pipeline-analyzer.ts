import { parse, Document } from 'yaml';
import { WikiParser, Standard, Rule } from './wiki-parser.js';
import { PolicyEnforcer, SecurityPolicy } from './policy-enforcer.js';

export interface Violation {
  type: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  line: number;
  column?: number;
  message: string;
  rule?: string;
  suggestion?: string;
  code?: string;
}

export interface Warning {
  type: string;
  severity: 'MEDIUM' | 'LOW';
  line: number;
  message: string;
  suggestion?: string;
}

export interface Suggestion {
  type: 'PERFORMANCE' | 'QUALITY' | 'SECURITY' | 'MAINTAINABILITY';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
  description?: string;
  code?: string;
  documentation?: string;
}

export interface AnalysisResult {
  violations: Violation[];
  warnings: Warning[];
  suggestions: Suggestion[];
  score: number;
  summary: {
    totalIssues: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
  };
}

export interface AnalysisOptions {
  strictMode?: boolean;
  projectType?: 'dotnet' | 'node' | 'python';
  checkSecurity?: boolean;
  checkPerformance?: boolean;
  checkCompliance?: boolean;
}

export class PipelineAnalyzer {
  private policyEnforcer: PolicyEnforcer;
  
  constructor(private wikiParser: WikiParser) {
    this.policyEnforcer = new PolicyEnforcer(wikiParser);
  }
  
  async analyze(yamlContent: string, options: AnalysisOptions = {}): Promise<AnalysisResult> {
    const {
      strictMode = false,
      projectType,
      checkSecurity = true,
      checkPerformance = true,
      checkCompliance = true
    } = options;
    
    // Cargar políticas y estándares
    await this.wikiParser.loadStandards();
    await this.policyEnforcer.loadPolicies();
    
    const violations: Violation[] = [];
    const warnings: Warning[] = [];
    const suggestions: Suggestion[] = [];
    
    // Parsear YAML
    let pipelineDoc: Document | null = null;
    let pipeline: any = null;
    
    try {
      pipelineDoc = parse(yamlContent, { keepSourceTokens: true });
      pipeline = pipelineDoc;
    } catch (error) {
      violations.push({
        type: 'INVALID_YAML',
        severity: 'CRITICAL',
        line: 0,
        message: `YAML inválido: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        rule: 'YAML_SYNTAX'
      });
      
      return this.createResult(violations, warnings, suggestions);
    }
    
    // Verificar estructura básica
    this.checkBasicStructure(pipeline, yamlContent, violations, warnings);
    
    // Verificar stages obligatorios
    this.checkMandatoryStages(pipeline, yamlContent, violations, warnings, projectType);
    
    // Verificar configuraciones de seguridad
    if (checkSecurity) {
      this.checkSecurityConfigurations(pipeline, yamlContent, violations, warnings, suggestions);
    }
    
    // Verificar mejoras de rendimiento
    if (checkPerformance) {
      this.checkPerformanceOptimizations(pipeline, yamlContent, suggestions, projectType);
    }
    
    // Verificar compliance con políticas
    if (checkCompliance) {
      await this.checkPolicyCompliance(pipeline, yamlContent, violations, warnings, suggestions, projectType);
    }
    
    // Aplicar modo estricto si está habilitado
    if (strictMode) {
      this.applyStrictMode(violations, warnings, suggestions);
    }
    
    return this.createResult(violations, warnings, suggestions, strictMode);
  }
  
  private checkBasicStructure(
    pipeline: any,
    yamlContent: string,
    violations: Violation[],
    warnings: Warning[]
  ): void {
    // Verificar que existe la clave 'stages' o 'jobs'
    if (!pipeline.stages && !pipeline.jobs) {
      violations.push({
        type: 'MISSING_STRUCTURE',
        severity: 'CRITICAL',
        line: 1,
        message: 'Pipeline debe contener "stages" o "jobs"',
        rule: 'BASIC_STRUCTURE',
        suggestion: 'Agregue una sección "stages:" con al menos un stage',
        code: `stages:
  - stage: Build
    jobs:
      - job: BuildJob
        steps:
          - script: echo "Building..."`
      });
    }
    
    // Verificar trigger
    if (!pipeline.trigger) {
      warnings.push({
        type: 'MISSING_TRIGGER',
        severity: 'MEDIUM',
        line: 1,
        message: 'Pipeline sin configuración de trigger',
        suggestion: 'Agregue configuración de trigger para especificar cuándo ejecutar el pipeline'
      });
    } else if (pipeline.trigger === true) {
      violations.push({
        type: 'UNSAFE_TRIGGER',
        severity: 'HIGH',
        line: this.findLineNumber(yamlContent, 'trigger:'),
        message: 'Trigger configurado como "true" es inseguro',
        rule: 'TRIGGER_CONFIGURATION',
        suggestion: 'Especifique branches específicos en lugar de trigger: true',
        code: `trigger:
  branches:
    include:
      - main
      - develop`
      });
    }
    
    // Verificar pool
    if (!pipeline.pool && !pipeline.stages) {
      warnings.push({
        type: 'MISSING_POOL',
        severity: 'LOW',
        line: 1,
        message: 'No se especifica pool de agentes',
        suggestion: 'Agregue "pool: vmImage: \'ubuntu-latest\'" para especificar el agente'
      });
    }
  }
  
  private checkMandatoryStages(
    pipeline: any,
    yamlContent: string,
    violations: Violation[],
    warnings: Warning[],
    projectType?: string
  ): void {
    const mandatoryStages = ['Validate', 'Security', 'Build', 'Test'];
    
    if (!pipeline.stages) {
      violations.push({
        type: 'MISSING_STAGES',
        severity: 'CRITICAL',
        line: 1,
        message: 'Pipeline sin definición de stages',
        rule: 'MANDATORY_STAGES',
        suggestion: 'Los pipelines deben usar estructura multi-stage',
        code: this.generateMandatoryStagesTemplate(projectType)
      });
      return;
    }
    
    const existingStages = new Set(
      pipeline.stages?.map((s: any) => s.stage || s) || []
    );
    
    mandatoryStages.forEach(stageName => {
      if (!existingStages.has(stageName)) {
        const severity = stageName === 'Security' ? 'CRITICAL' : 'HIGH';
        violations.push({
          type: 'MISSING_MANDATORY_STAGE',
          severity,
          line: this.findStagesLine(yamlContent),
          message: `Stage obligatorio faltante: ${stageName}`,
          rule: `STAGE_${stageName.toUpperCase()}`,
          suggestion: `Agregue el stage ${stageName} según los estándares corporativos`,
          code: this.generateStageTemplate(stageName, projectType)
        });
      }
    });
  }
  
  private checkSecurityConfigurations(
    pipeline: any,
    yamlContent: string,
    violations: Violation[],
    warnings: Warning[],
    suggestions: Suggestion[]
  ): void {
    const lines = yamlContent.split('\n');
    
    // Buscar passwords hardcodeados
    lines.forEach((line, index) => {
      // Patrones peligrosos
      const dangerousPatterns = [
        /password\s*[:=]\s*["']([^"']+)["']/i,
        /pwd\s*[:=]\s*["']([^"']+)["']/i,
        /api[_-]?key\s*[:=]\s*["']([^"']+)["']/i,
        /token\s*[:=]\s*["']([^"']+)["']/i,
        /secret\s*[:=]\s*["']([^"']+)["']/i,
        /connectionstring\s*[:=]\s*["'][^$\(][^"']+["']/i
      ];
      
      dangerousPatterns.forEach(pattern => {
        const match = line.match(pattern);
        if (match && !line.includes('$(') && !line.includes('${')) {
          violations.push({
            type: 'HARDCODED_SECRET',
            severity: 'CRITICAL',
            line: index + 1,
            column: match.index || 0,
            message: 'Secreto hardcodeado detectado',
            rule: 'NO_SECRETS',
            suggestion: 'Use Azure Key Vault o variables de grupo para secretos',
            code: `# En lugar de:
# ${line.trim()}
# Use:
variables:
  - group: my-variable-group
# O:
- task: AzureKeyVault@2
  inputs:
    azureSubscription: 'ServiceConnection'
    KeyVaultName: 'my-keyvault'`
          });
        }
      });
      
      // Verificar uso de continueOnError en tareas de seguridad
      if (line.includes('continueOnError: true')) {
        const prevLines = lines.slice(Math.max(0, index - 5), index);
        const isSecurityTask = prevLines.some(l => 
          l.includes('Sonar') || 
          l.includes('Snyk') || 
          l.includes('TruffleHog') ||
          l.includes('Security')
        );
        
        if (isSecurityTask) {
          violations.push({
            type: 'SECURITY_BYPASS',
            severity: 'HIGH',
            line: index + 1,
            message: 'Tarea de seguridad configurada para continuar en error',
            rule: 'NO_SECURITY_BYPASS',
            suggestion: 'Las tareas de seguridad deben fallar el build en caso de problemas'
          });
        }
      }
    });
    
    // Verificar si hay análisis de seguridad
    const hasSecurityScanning = yamlContent.includes('TruffleHog') || 
                               yamlContent.includes('Sonar') || 
                               yamlContent.includes('Snyk');
    
    if (!hasSecurityScanning) {
      violations.push({
        type: 'NO_SECURITY_SCANNING',
        severity: 'CRITICAL',
        line: 1,
        message: 'Pipeline sin herramientas de análisis de seguridad',
        rule: 'SECURITY_SCANNING_REQUIRED',
        suggestion: 'Agregue herramientas de seguridad obligatorias (TruffleHog, SonarQube, Snyk)'
      });
    }
  }
  
  private checkPerformanceOptimizations(
    pipeline: any,
    yamlContent: string,
    suggestions: Suggestion[],
    projectType?: string
  ): void {
    // Verificar uso de caché
    const hasCache = yamlContent.includes('Cache@2') || 
                    yamlContent.includes('cache:') ||
                    yamlContent.includes('npm_config_cache');
    
    if (!hasCache && projectType) {
      suggestions.push({
        type: 'PERFORMANCE',
        priority: 'MEDIUM',
        message: 'Pipeline no utiliza caché para dependencias',
        description: 'El uso de caché puede reducir significativamente el tiempo de build',
        code: this.getCacheTemplate(projectType),
        documentation: 'https://docs.microsoft.com/azure/devops/pipelines/caching'
      });
    }
    
    // Verificar paralelización
    if (pipeline.stages && pipeline.stages.length > 3) {
      const hasParallelStages = pipeline.stages.some((stage: any) => 
        !stage.dependsOn || Array.isArray(stage.dependsOn)
      );
      
      if (!hasParallelStages) {
        suggestions.push({
          type: 'PERFORMANCE',
          priority: 'LOW',
          message: 'Considere paralelizar stages independientes',
          description: 'Los stages que no dependen entre sí pueden ejecutarse en paralelo',
          code: `# Ejemplo de stages paralelos:
stages:
  - stage: Test
    dependsOn: Build
  - stage: SecurityScan
    dependsOn: Build  # Ambos dependen de Build, ejecutan en paralelo`
        });
      }
    }
    
    // Verificar uso de artifacts
    if (pipeline.stages && pipeline.stages.length > 1) {
      const hasArtifacts = yamlContent.includes('PublishBuildArtifacts') ||
                          yamlContent.includes('PublishPipelineArtifact');
      
      if (!hasArtifacts) {
        suggestions.push({
          type: 'PERFORMANCE',
          priority: 'MEDIUM',
          message: 'Use artifacts para compartir archivos entre stages',
          description: 'Los artifacts mejoran el rendimiento y la trazabilidad',
          code: `- task: PublishPipelineArtifact@1
  inputs:
    targetPath: '$(Build.ArtifactStagingDirectory)'
    artifactName: 'drop'`
        });
      }
    }
  }
  
  private async checkPolicyCompliance(
    pipeline: any,
    yamlContent: string,
    violations: Violation[],
    warnings: Warning[],
    suggestions: Suggestion[],
    projectType?: string
  ): Promise<void> {
    // Verificar compliance con políticas obligatorias
    const mandatoryPolicies = this.policyEnforcer.getMandatoryPolicies();
    
    mandatoryPolicies.forEach(policy => {
      const hasPolicyImplementation = policy.tools.some(tool => 
        yamlContent.includes(tool.task)
      );
      
      if (!hasPolicyImplementation) {
        violations.push({
          type: 'POLICY_VIOLATION',
          severity: policy.severity,
          line: 1,
          message: `Política obligatoria no implementada: ${policy.name}`,
          rule: policy.id,
          suggestion: `Implemente la política ${policy.id} usando ${policy.tools[0].name}`,
          code: this.getPolicyImplementationTemplate(policy)
        });
      }
    });
    
    // Verificar estructura específica del tipo de proyecto
    if (projectType && (projectType === 'dotnet' || projectType === 'node' || projectType === 'python')) {
      await this.checkProjectSpecificRequirements(
        pipeline,
        yamlContent,
        violations,
        warnings,
        suggestions,
        projectType
      );
    }
  }

  private async checkProjectSpecificRequirements(
    pipeline: any,
    yamlContent: string,
    violations: Violation[],
    warnings: Warning[],
    suggestions: Suggestion[],
    projectType: 'dotnet' | 'node' | 'python'
  ): Promise<void> {
    switch (projectType) {
      case 'node':
        // Verificar npm audit
        if (!yamlContent.includes('npm audit')) {
          warnings.push({
            type: 'MISSING_SECURITY_AUDIT',
            severity: 'MEDIUM',
            line: this.findBuildStepLine(yamlContent),
            message: 'Pipeline Node.js sin npm audit',
            suggestion: 'Agregue "npm audit --audit-level=high" después de npm install'
          });
        }
        
        // Verificar npm ci vs npm install
        if (yamlContent.includes('npm install') && !yamlContent.includes('npm ci')) {
          suggestions.push({
            type: 'PERFORMANCE',
            priority: 'MEDIUM',
            message: 'Use "npm ci" en lugar de "npm install" para builds más rápidos',
            description: 'npm ci es más rápido y más confiable para ambientes de CI/CD',
            code: '- script: npm ci'
          });
        }
        break;
        
      case 'dotnet':
        // Verificar restore separado de build
        if (!yamlContent.includes('restore')) {
          suggestions.push({
            type: 'PERFORMANCE',
            priority: 'LOW',
            message: 'Separe restore de build para mejor caché',
            code: `- task: DotNetCoreCLI@2
  displayName: 'Restore'
  inputs:
    command: 'restore'
    
- task: DotNetCoreCLI@2
  displayName: 'Build'
  inputs:
    command: 'build'
    arguments: '--no-restore'`
          });
        }
        
        // Verificar análisis de vulnerabilidades
        if (!yamlContent.includes('--vulnerable')) {
          warnings.push({
            type: 'MISSING_VULNERABILITY_CHECK',
            severity: 'MEDIUM',
            line: 1,
            message: 'Pipeline .NET sin verificación de paquetes vulnerables',
            suggestion: 'Agregue verificación de paquetes vulnerables'
          });
        }
        break;
        
      case 'python':
        // Verificar safety check
        if (!yamlContent.includes('safety')) {
          warnings.push({
            type: 'MISSING_SAFETY_CHECK',
            severity: 'MEDIUM',
            line: this.findBuildStepLine(yamlContent),
            message: 'Pipeline Python sin safety check',
            suggestion: 'Agregue "safety check" para verificar vulnerabilidades'
          });
        }
        
        // Verificar uso de requirements.txt
        if (!yamlContent.includes('requirements')) {
          warnings.push({
            type: 'MISSING_REQUIREMENTS',
            severity: 'LOW',
            line: 1,
            message: 'No se detecta instalación desde requirements.txt',
            suggestion: 'Use requirements.txt para gestión de dependencias'
          });
        }
        break;
    }
  }
  
  private applyStrictMode(
    violations: Violation[],
    warnings: Warning[],
    suggestions: Suggestion[]
  ): void {
    // En modo estricto, elevar severidades
    warnings.forEach(warning => {
      violations.push({
        type: warning.type,
        severity: 'HIGH',
        line: warning.line,
        message: `[STRICT MODE] ${warning.message}`,
        suggestion: warning.suggestion
      });
    });
    
    // Limpiar warnings (ya convertidos a violations)
    warnings.length = 0;
    
    // Convertir sugerencias de alta prioridad en warnings
    suggestions.forEach(suggestion => {
      if (suggestion.priority === 'HIGH' || suggestion.priority === 'MEDIUM') {
        warnings.push({
          type: suggestion.type,
          severity: 'MEDIUM',
          line: 1,
          message: `[STRICT MODE] ${suggestion.message}`,
          suggestion: suggestion.description
        });
      }
    });
  }
  
  private createResult(
    violations: Violation[],
    warnings: Warning[],
    suggestions: Suggestion[],
    strictMode: boolean = false
  ): AnalysisResult {
    const criticalCount = violations.filter(v => v.severity === 'CRITICAL').length;
    const highCount = violations.filter(v => v.severity === 'HIGH').length;
    const mediumCount = violations.filter(v => v.severity === 'MEDIUM').length +
                        warnings.filter(w => w.severity === 'MEDIUM').length;
    const lowCount = violations.filter(v => v.severity === 'LOW').length +
                    warnings.filter(w => w.severity === 'LOW').length;
    
    const totalIssues = criticalCount + highCount + mediumCount + lowCount;
    
    // Calcular score (100 = perfecto, 0 = crítico)
    let score = 100;
    score -= criticalCount * 25;  // Cada crítico resta 25 puntos
    score -= highCount * 15;       // Cada alto resta 15 puntos
    score -= mediumCount * 5;      // Cada medio resta 5 puntos
    score -= lowCount * 2;         // Cada bajo resta 2 puntos
    
    score = Math.max(0, score);
    
    // En modo estricto, el mínimo aceptable es 95
    if (strictMode && score < 95) {
      score = Math.min(score, 50); // Penalización adicional en modo estricto
    }
    
    return {
      violations,
      warnings,
      suggestions,
      score,
      summary: {
        totalIssues,
        criticalCount,
        highCount,
        mediumCount,
        lowCount
      }
    };
  }
  
  async suggestImprovements(
    yamlContent: string,
    focus: Array<'security' | 'performance' | 'compliance' | 'quality'>
  ): Promise<Suggestion[]> {
    const result = await this.analyze(yamlContent, {
      checkSecurity: focus.includes('security'),
      checkPerformance: focus.includes('performance'),
      checkCompliance: focus.includes('compliance')
    });
    
    // Agregar sugerencias adicionales basadas en el foco
    const additionalSuggestions: Suggestion[] = [];
    
    if (focus.includes('quality')) {
      additionalSuggestions.push({
        type: 'QUALITY',
        priority: 'MEDIUM',
        message: 'Agregue etiquetas descriptivas a todos los jobs y steps',
        description: 'Las etiquetas mejoran la legibilidad y el debugging'
      });
      
      additionalSuggestions.push({
        type: 'QUALITY',
        priority: 'LOW',
        message: 'Use templates YAML para código reutilizable',
        description: 'Los templates reducen duplicación y mejoran mantenibilidad',
        documentation: 'https://docs.microsoft.com/azure/devops/pipelines/yaml-templates'
      });
    }
    
    return [...result.suggestions, ...additionalSuggestions];
  }
  
  // Métodos auxiliares
  private findLineNumber(content: string, search: string): number {
    const lines = content.split('\n');
    const index = lines.findIndex(line => line.includes(search));
    return index >= 0 ? index + 1 : 1;
  }
  
  private findStagesLine(content: string): number {
    return this.findLineNumber(content, 'stages:');
  }
  
  private findBuildStepLine(content: string): number {
    const buildLine = this.findLineNumber(content, 'Build');
    return buildLine > 1 ? buildLine : this.findLineNumber(content, 'build');
  }
  
  private generateMandatoryStagesTemplate(projectType?: string): string {
    return `stages:
  - stage: Validate
    displayName: 'Validación'
    jobs:
      - job: ValidateJob
        steps:
          - script: echo "Validating..."
          
  - stage: Security
    displayName: 'Seguridad'
    dependsOn: Validate
    jobs:
      - job: SecurityScan
        steps:
          - task: TruffleHog@1
          - task: SonarQubePrepare@5
          - task: SnykSecurityScan@1
          
  - stage: Build
    displayName: 'Build'
    dependsOn: Security
    jobs:
      - job: BuildJob
        steps:
          - script: echo "Building..."
          
  - stage: Test
    displayName: 'Test'
    dependsOn: Build
    jobs:
      - job: TestJob
        steps:
          - script: echo "Testing..."`;
  }
  
  private generateStageTemplate(stageName: string, projectType?: string): string {
    switch (stageName) {
      case 'Security':
        return `- stage: Security
  displayName: 'Análisis de Seguridad'
  dependsOn: Validate
  jobs:
    - job: SecurityScan
      steps:
        - task: TruffleHog@1
          displayName: 'Escaneo de secretos'
        - task: SonarQubePrepare@5
          displayName: 'Preparar SonarQube'
        - task: SnykSecurityScan@1
          displayName: 'Escaneo de dependencias'`;
          
      case 'Validate':
        return `- stage: Validate
  displayName: 'Validación'
  jobs:
    - job: ValidateJob
      steps:
        - checkout: self
        - script: echo "Validating code..."`;
        
      case 'Build':
        return `- stage: Build
  displayName: 'Build'
  dependsOn: Security
  jobs:
    - job: BuildJob
      steps:
        - script: echo "Building application..."`;
        
      case 'Test':
        return `- stage: Test
  displayName: 'Test'
  dependsOn: Build
  jobs:
    - job: UnitTests
      steps:
        - script: echo "Running tests..."`;
        
      default:
        return '';
    }
  }
  
  private getCacheTemplate(projectType: string): string {
    switch (projectType) {
      case 'node':
        return `- task: Cache@2
  inputs:
    key: 'npm | "$(Agent.OS)" | package-lock.json'
    restoreKeys: |
      npm | "$(Agent.OS)"
    path: $(npm_config_cache)
  displayName: 'Cache NPM packages'`;
  
      case 'dotnet':
        return `- task: Cache@2
  inputs:
    key: 'nuget | "$(Agent.OS)" | **/packages.lock.json'
    restoreKeys: |
      nuget | "$(Agent.OS)"
    path: $(NUGET_PACKAGES)
  displayName: 'Cache NuGet packages'`;
  
      case 'python':
        return `- task: Cache@2
  inputs:
    key: 'pip | "$(Agent.OS)" | requirements.txt'
    restoreKeys: |
      pip | "$(Agent.OS)"
    path: $(PIP_CACHE_DIR)
  displayName: 'Cache pip packages'`;
  
      default:
        return '';
    }
  }
  
  private getPolicyImplementationTemplate(policy: SecurityPolicy): string {
    const tool = policy.tools[0];
    return `- task: ${tool.task}
  displayName: '${policy.name}'
  inputs:
    # Configuración según política ${policy.id}
    failOnIssues: true
    continueOnError: false`;
  }
}
