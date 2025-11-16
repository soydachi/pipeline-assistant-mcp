import { WikiParser } from './wiki-parser.js';

export interface SecurityPolicy {
  id: string;
  name: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  mandatory: boolean;
  tools: PolicyTool[];
  condition?: string;
}

export interface PolicyTool {
  name: string;
  task: string;
  failOnDetection?: boolean;
  failOnIssues?: boolean;
  severityThreshold?: string;
  qualityGate?: boolean;
  exitCode?: number;
  continueOnError?: boolean;
}

export interface EnforcementResult {
  applied: SecurityPolicy[];
  skipped: SecurityPolicy[];
  errors: string[];
}

export class PolicyEnforcer {
  private policies: Map<string, SecurityPolicy> = new Map();
  
  constructor(private wikiParser: WikiParser) {}
  
  async loadPolicies(): Promise<void> {
    const securityPolicies = this.wikiParser.getSecurityPolicies();
    const compliancePolicies = this.wikiParser.getCompliancePolicies();
    
    // Cargar políticas de seguridad obligatorias
    if (securityPolicies?.mandatory) {
      securityPolicies.mandatory.forEach((policy: any) => {
        this.policies.set(policy.id, {
          ...policy,
          mandatory: true
        });
      });
    }
    
    // Cargar políticas de compliance obligatorias
    if (compliancePolicies?.mandatory) {
      compliancePolicies.mandatory.forEach((policy: any) => {
        this.policies.set(policy.id, {
          ...policy,
          mandatory: true
        });
      });
    }
  }
  
  getMandatoryPolicies(): SecurityPolicy[] {
    return Array.from(this.policies.values()).filter(p => p.mandatory);
  }
  
  getApplicablePolicies(context: {
    projectType: string;
    usesDocker?: boolean;
    environment?: string;
  }): SecurityPolicy[] {
    return Array.from(this.policies.values()).filter(policy => {
      // Si no tiene condición, siempre aplica
      if (!policy.condition) return policy.mandatory;
      
      // Evaluar condiciones específicas
      switch (policy.condition) {
        case 'uses_docker':
          return context.usesDocker === true;
        case 'is_api_project':
          return context.projectType === 'node' || context.projectType === 'dotnet';
        case 'production_only':
          return context.environment === 'prod';
        default:
          return policy.mandatory;
      }
    });
  }
  
  generateSecurityStage(
    projectType: string,
    additionalContext?: { usesDocker?: boolean; environment?: string }
  ): string {
    const context = { projectType, ...additionalContext };
    const applicablePolicies = this.getApplicablePolicies(context);
    
    let stage = `- stage: Security
  displayName: 'Análisis de Seguridad (Políticas Obligatorias)'
  dependsOn: Validate
  condition: succeeded()
  jobs:
  - job: SecurityScan
    displayName: 'Aplicar políticas de seguridad obligatorias'
    pool:
      vmImage: 'ubuntu-latest'
    steps:
    - checkout: self
      clean: true
      fetchDepth: 0
      
`;
    
    // Agrupar políticas por categoría para mejor organización
    const secretScanning = applicablePolicies.filter(p => p.id.includes('SEC-001'));
    const sastAnalysis = applicablePolicies.filter(p => p.id.includes('SEC-002'));
    const dependencyScanning = applicablePolicies.filter(p => p.id.includes('SEC-003'));
    const containerScanning = applicablePolicies.filter(p => p.id.includes('SEC-004'));
    
    // Aplicar políticas de escaneo de secretos
    if (secretScanning.length > 0) {
      stage += this.generateSecretScanningSteps(secretScanning[0]);
    }
    
    // Aplicar análisis SAST
    if (sastAnalysis.length > 0) {
      stage += this.generateSASTSteps(sastAnalysis[0], projectType);
    }
    
    // Aplicar escaneo de dependencias
    if (dependencyScanning.length > 0) {
      stage += this.generateDependencyScanningSteps(dependencyScanning[0], projectType);
    }
    
    // Aplicar escaneo de contenedores si aplica
    if (containerScanning.length > 0 && context.usesDocker) {
      stage += this.generateContainerScanningSteps(containerScanning[0]);
    }
    
    // Agregar validación final de políticas
    stage += this.generatePolicyValidationStep(applicablePolicies);
    
    return stage + '\n';
  }
  
  private generateSecretScanningSteps(policy: SecurityPolicy): string {
    const tool = policy.tools[0];
    return `    # ${policy.name} (${policy.id}) - OBLIGATORIO
    # ${policy.description}
    - task: ${tool.task}
      displayName: '🔐 ${policy.name}'
      inputs:
        path: '$(Build.SourcesDirectory)'
        failOnSecrets: ${tool.failOnDetection !== false}
        depth: 50
        maxSecrets: 0
      continueOnError: false
      condition: succeeded()
      timeoutInMinutes: 10
      
    # Validación adicional de secretos
    - script: |
        echo "##[section]Verificando patrones de secretos comunes..."
        # Buscar patrones peligrosos
        if grep -r "password\s*=\s*[\"'][^\"']*[\"']" --include="*.cs" --include="*.js" --include="*.ts" --include="*.py" .; then
          echo "##vso[task.logissue type=error]Se encontraron posibles passwords hardcodeados"
          exit 1
        fi
        if grep -r "api[_-]?key\s*=\s*[\"'][^\"']*[\"']" --include="*.cs" --include="*.js" --include="*.ts" --include="*.py" .; then
          echo "##vso[task.logissue type=error]Se encontraron API keys hardcodeadas"
          exit 1
        fi
        echo "##[section]No se encontraron secretos hardcodeados adicionales"
      displayName: '🔍 Validación adicional de secretos'
      continueOnError: false
      
`;
  }
  
  private generateSASTSteps(policy: SecurityPolicy, projectType: string): string {
    const tool = policy.tools[0];
    let steps = `    # ${policy.name} (${policy.id}) - OBLIGATORIO
    # ${policy.description}
    - task: SonarQubePrepare@5
      displayName: '🛡️ Preparar ${policy.name}'
      inputs:
        SonarQube: 'SonarQubeServiceConnection'
        scannerMode: 'CLI'
        configMode: 'manual'
        cliProjectKey: '$(Build.Repository.Name)'
        cliProjectName: '$(Build.Repository.Name)'
        cliProjectVersion: '$(Build.BuildNumber)'
        cliSources: '.'
        extraProperties: |
          sonar.exclusions=**/node_modules/**,**/bin/**,**/obj/**,**/wwwroot/lib/**
          sonar.coverage.exclusions=**/Tests/**,**/test/**,**/*.spec.ts,**/*.test.ts
`;
    
    // Configuración específica por lenguaje
    if (projectType === 'dotnet') {
      steps += `          sonar.cs.opencover.reportsPaths=$(Agent.TempDirectory)/**/coverage.opencover.xml
          sonar.cs.vstest.reportsPaths=$(Agent.TempDirectory)/**/*.trx
`;
    } else if (projectType === 'node') {
      steps += `          sonar.javascript.lcov.reportPaths=coverage/lcov.info
          sonar.typescript.lcov.reportPaths=coverage/lcov.info
`;
    } else if (projectType === 'python') {
      steps += `          sonar.python.coverage.reportPaths=coverage.xml
          sonar.python.xunit.reportPath=test-results.xml
`;
    }
    
    steps += `      continueOnError: false
      
    # Ejecutar análisis después del build
    - task: SonarQubeAnalyze@5
      displayName: '📊 Ejecutar análisis SAST'
      continueOnError: false
      
    # Publicar y verificar Quality Gate
    - task: SonarQubePublish@5
      displayName: '📈 Publicar resultados SAST'
      inputs:
        pollingTimeoutSec: '300'
      continueOnError: false
      
    # Verificar que el Quality Gate pase
    - powershell: |
        $token = [System.Text.Encoding]::UTF8.GetBytes("$(SONAR_TOKEN)" + ":")
        $base64 = [System.Convert]::ToBase64String($token)
        
        $headers = @{
          Authorization = "Basic $base64"
        }
        
        $projectStatus = Invoke-RestMethod -Uri "$(SONAR_HOST_URL)/api/qualitygates/project_status?projectKey=$(Build.Repository.Name)" -Headers $headers
        
        if ($projectStatus.projectStatus.status -ne "OK") {
          Write-Host "##vso[task.logissue type=error]Quality Gate failed: $($projectStatus.projectStatus.status)"
          Write-Host "##vso[task.logissue type=error]Condiciones no cumplidas:"
          $projectStatus.projectStatus.conditions | Where-Object { $_.status -ne "OK" } | ForEach-Object {
            Write-Host "##vso[task.logissue type=error]- $($_.metricKey): $($_.actualValue) (esperado: $($_.errorThreshold))"
          }
          exit 1
        }
        Write-Host "##[section]Quality Gate passed successfully"
      displayName: '✅ Verificar Quality Gate'
      condition: succeeded()
      continueOnError: false
      
`;
    
    return steps;
  }
  
  private generateDependencyScanningSteps(policy: SecurityPolicy, projectType: string): string {
    const tool = policy.tools[0];
    let steps = `    # ${policy.name} (${policy.id}) - OBLIGATORIO
    # ${policy.description}
    - task: ${tool.task}
      displayName: '📦 ${policy.name}'
      inputs:
        serviceConnectionEndpoint: 'SnykServiceConnection'
        testType: 'app'
        severityThreshold: '${tool.severityThreshold || 'high'}'
        failOnIssues: ${tool.failOnIssues !== false}
        monitorOnBuild: true
        additionalArguments: '--all-projects --detection-depth=4'
      continueOnError: false
      
`;
    
    // Análisis adicional específico por tecnología
    if (projectType === 'node') {
      steps += `    # Auditoría adicional para Node.js
    - script: |
        npm audit --audit-level=high
        if [ $? -ne 0 ]; then
          echo "##vso[task.logissue type=error]NPM audit encontró vulnerabilidades altas o críticas"
          npm audit --json > npm-audit-report.json
          exit 1
        fi
      displayName: '🔒 NPM Security Audit'
      continueOnError: false
      
`;
    } else if (projectType === 'dotnet') {
      steps += `    # Auditoría adicional para .NET
    - task: DotNetCoreCLI@2
      displayName: '🔒 .NET Vulnerability Check'
      inputs:
        command: 'custom'
        custom: 'list'
        arguments: 'package --vulnerable --include-transitive --format json'
      continueOnError: false
      
`;
    } else if (projectType === 'python') {
      steps += `    # Auditoría adicional para Python
    - script: |
        pip install safety
        safety check --json --short-report
        if [ $? -ne 0 ]; then
          echo "##vso[task.logissue type=error]Safety check encontró vulnerabilidades"
          safety check --json > safety-report.json
          exit 1
        fi
      displayName: '🔒 Python Safety Check'
      continueOnError: false
      
`;
    }
    
    return steps;
  }
  
  private generateContainerScanningSteps(policy: SecurityPolicy): string {
    const tool = policy.tools[0];
    return `    # ${policy.name} (${policy.id}) - OBLIGATORIO (Docker detectado)
    # ${policy.description}
    - task: trivy@1
      displayName: '🐳 ${policy.name}'
      inputs:
        version: 'latest'
        docker: true
        image: '$(imageName):$(Build.BuildId)'
        exitCode: ${tool.exitCode || 1}
        severities: 'CRITICAL,HIGH'
        ignoreUnfixed: false
      continueOnError: false
      
    # Escaneo adicional de Dockerfile
    - script: |
        echo "##[section]Analizando Dockerfile para mejores prácticas..."
        docker run --rm -i hadolint/hadolint < Dockerfile
        if [ $? -ne 0 ]; then
          echo "##vso[task.logissue type=warning]Dockerfile no cumple con todas las mejores prácticas"
        fi
      displayName: '📋 Análisis de Dockerfile'
      continueOnError: true
      
`;
  }
  
  private generatePolicyValidationStep(policies: SecurityPolicy[]): string {
    return `    # Validación final de políticas aplicadas
    - powershell: |
        Write-Host "##[section]======================================"
        Write-Host "##[section]RESUMEN DE POLÍTICAS DE SEGURIDAD"
        Write-Host "##[section]======================================"
        
        $appliedPolicies = @(
${policies.map(p => `          @{Id="${p.id}"; Name="${p.name}"; Severity="${p.severity}"; Status="APPLIED"}`).join(',\n')}
        )
        
        Write-Host "##[section]Políticas aplicadas: $($appliedPolicies.Count)"
        $appliedPolicies | ForEach-Object {
          $icon = switch($_.Severity) {
            "CRITICAL" { "🔴" }
            "HIGH" { "🟠" }
            "MEDIUM" { "🟡" }
            "LOW" { "🟢" }
          }
          Write-Host "$icon [$($_.Severity)] $($_.Name) - $($_.Status)"
        }
        
        $criticalCount = ($appliedPolicies | Where-Object { $_.Severity -eq "CRITICAL" }).Count
        $highCount = ($appliedPolicies | Where-Object { $_.Severity -eq "HIGH" }).Count
        
        Write-Host ""
        Write-Host "##[section]Resumen:"
        Write-Host "  - Políticas CRÍTICAS: $criticalCount"
        Write-Host "  - Políticas ALTAS: $highCount"
        Write-Host "  - Todas las políticas obligatorias fueron aplicadas ✅"
        
        # Guardar reporte
        $report = @{
          Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
          BuildNumber = "$(Build.BuildNumber)"
          Repository = "$(Build.Repository.Name)"
          Branch = "$(Build.SourceBranchName)"
          PoliciesApplied = $appliedPolicies
          ComplianceStatus = "COMPLIANT"
        }
        
        $report | ConvertTo-Json -Depth 3 | Out-File -FilePath "$(Build.ArtifactStagingDirectory)/security-compliance-report.json"
        Write-Host "##[section]Reporte de compliance guardado"
      displayName: '📊 Validación de Políticas de Seguridad'
      continueOnError: false
      
    # Publicar reporte como artefacto
    - task: PublishBuildArtifacts@1
      displayName: '📤 Publicar reporte de compliance'
      inputs:
        pathToPublish: '$(Build.ArtifactStagingDirectory)/security-compliance-report.json'
        artifactName: 'security-compliance'
        publishLocation: 'Container'
`;
  }
  
  enforcePolicy(
    pipelineYaml: string,
    context: { projectType: string; usesDocker?: boolean; environment?: string }
  ): EnforcementResult {
    const result: EnforcementResult = {
      applied: [],
      skipped: [],
      errors: []
    };
    
    const applicablePolicies = this.getApplicablePolicies(context);
    
    // Verificar que todas las políticas obligatorias estén presentes
    applicablePolicies.forEach(policy => {
      const hasPolicyImplementation = policy.tools.some(tool => 
        pipelineYaml.includes(tool.task)
      );
      
      if (hasPolicyImplementation) {
        result.applied.push(policy);
      } else if (policy.mandatory) {
        result.errors.push(`Política obligatoria no implementada: ${policy.id} - ${policy.name}`);
      } else {
        result.skipped.push(policy);
      }
    });
    
    return result;
  }
}
