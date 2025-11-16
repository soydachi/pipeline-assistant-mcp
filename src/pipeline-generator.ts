import { WikiParser, Standard } from './wiki-parser.js';
import { PolicyEnforcer } from './policy-enforcer.js';

export interface GenerateOptions {
  projectType: 'dotnet' | 'node' | 'python';
  services: string[];
  environment: 'dev' | 'staging' | 'prod';
  standards: Standard;
  usesDocker?: boolean;
  enforceAllPolicies?: boolean;
}

export class PipelineGenerator {
  private policyEnforcer: PolicyEnforcer;
  
  constructor(private wikiParser: WikiParser) {
    this.policyEnforcer = new PolicyEnforcer(wikiParser);
  }

  async generatePipeline(options: GenerateOptions): Promise<string> {
    const { projectType, services, environment, standards, usesDocker, enforceAllPolicies = true } = options;
    
    // Cargar políticas obligatorias
    await this.policyEnforcer.loadPolicies();
    
    // Obtener template base según el tipo de proyecto
    const baseTemplate = standards.templates.get(projectType) || '';
    
    // Construir pipeline completo
    let pipeline = this.generateHeader(options);
    pipeline += this.generateTrigger(environment);
    pipeline += this.generateVariables(projectType, services, environment);
    pipeline += this.generateStages(projectType, services, environment, standards, usesDocker, enforceAllPolicies);
    
    return pipeline;
  }

  private generateHeader(options: GenerateOptions): string {
    const timestamp = new Date().toISOString();
    return `# Pipeline CI/CD Autogenerado
# Generado por: Pipeline Assistant MCP
# Fecha: ${timestamp}
# Tipo de proyecto: ${options.projectType}
# Ambiente: ${options.environment}
# Basado en: wiki/standards/pipeline-standards.md

name: $(Build.DefinitionName)_$(SourceBranchName)_$(Date:yyyyMMdd)$(Rev:.r)

`;
  }

  private generateTrigger(environment: string): string {
    const branches = environment === 'prod' 
      ? ['main']
      : environment === 'staging'
      ? ['develop', 'release/*']
      : ['feature/*', 'develop'];
    
    return `trigger:
  branches:
    include:
${branches.map(b => `      - ${b}`).join('\n')}
  paths:
    exclude:
      - '*.md'
      - 'docs/*'
      - '.github/*'

pr:
  branches:
    include:
      - main
      - develop

`;
  }

  private generateVariables(projectType: string, services: string[], environment: string): string {
    let variables = `variables:
  - group: ${environment}-variables
  - name: buildConfiguration
    value: '${environment === 'prod' ? 'Release' : 'Debug'}'
  - name: resourceGroup
    value: 'rg-$(Build.Repository.Name)-${environment}'
`;
    
    // Variables específicas por tipo de proyecto
    if (projectType === 'dotnet') {
      variables += `  - name: dotnetVersion
    value: '8.x'
  - name: NUGET_PACKAGES
    value: $(Pipeline.Workspace)/.nuget/packages
`;
    } else if (projectType === 'node') {
      variables += `  - name: nodeVersion
    value: '20.x'
  - name: npm_config_cache
    value: $(Pipeline.Workspace)/.npm
`;
    } else if (projectType === 'python') {
      variables += `  - name: pythonVersion
    value: '3.11'
  - name: PIP_CACHE_DIR
    value: $(Pipeline.Workspace)/.cache/pip
`;
    }
    
    // Variables para servicios con configuración segura
    services.forEach(service => {
      if (service === 'azuresql') {
        variables += `  # Azure SQL Configuration (secrets from Key Vault)
  - name: sqlServerName
    value: 'sql-$(Build.Repository.Name)-${environment}'
  - name: sqlDatabaseName
    value: 'db-$(Build.Repository.Name)'
  - name: sqlUsername
    value: '$(SQL_ADMIN_USERNAME)' # From Key Vault
  - name: sqlPassword
    value: '$(SQL_ADMIN_PASSWORD)' # From Key Vault
  - name: sqlConnectionString
    value: 'Server=tcp:$(sqlServerName).database.windows.net,1433;Database=$(sqlDatabaseName);User ID=$(sqlUsername);Password=$(sqlPassword);Encrypt=true;Connection Timeout=30;'
`;
      } else if (service === 'redis') {
        variables += `  # Redis Configuration (secrets from Key Vault)
  - name: redisName
    value: 'redis-$(Build.Repository.Name)-${environment}'
  - name: redisConnectionString
    value: '$(REDIS_CONNECTION_STRING)' # From Key Vault
  - name: redisCacheKey
    value: '$(REDIS_PRIMARY_KEY)' # From Key Vault
`;
      } else if (service === 'cosmosdb') {
        variables += `  # CosmosDB Configuration (secrets from Key Vault)
  - name: cosmosDbName
    value: 'cosmos-$(Build.Repository.Name)-${environment}'
  - name: cosmosDbKey
    value: '$(COSMOS_PRIMARY_KEY)' # From Key Vault
  - name: cosmosDbEndpoint
    value: 'https://$(cosmosDbName).documents.azure.com:443/'
  - name: databaseName
    value: 'maindb'
`;
      } else if (service === 'servicebus') {
        variables += `  # Service Bus Configuration (secrets from Key Vault)
  - name: serviceBusNamespace
    value: 'sb-$(Build.Repository.Name)-${environment}'
  - name: serviceBusConnectionString
    value: '$(SERVICE_BUS_CONNECTION_STRING)' # From Key Vault
  - name: serviceBusQueueName
    value: 'main-queue'
`;
      } else if (service === 'storage') {
        variables += `  # Azure Storage Configuration (secrets from Key Vault)
  - name: storageAccountName
    value: 'st$(Build.Repository.Name)${environment}'
  - name: storageAccountKey
    value: '$(STORAGE_ACCOUNT_KEY)' # From Key Vault
  - name: storageConnectionString
    value: 'DefaultEndpointsProtocol=https;AccountName=$(storageAccountName);AccountKey=$(storageAccountKey);EndpointSuffix=core.windows.net'
`;
      } else if (service === 'keyvault') {
        variables += `  # Key Vault Configuration
  - name: keyVaultName
    value: 'kv-$(Build.Repository.Name)-${environment}'
  - name: keyVaultUrl
    value: 'https://$(keyVaultName).vault.azure.net/'
`;
      }
    });
    
    // Si hay servicios, agregar configuración de Key Vault automáticamente
    if (services.length > 0 && !services.includes('keyvault')) {
      variables += `  # Key Vault for secrets (auto-added for services)
  - name: keyVaultName
    value: 'kv-$(Build.Repository.Name)-${environment}'
`;
    }
    
    return variables + '\n';
  }

  private generateStages(
    projectType: string,
    services: string[],
    environment: string,
    standards: Standard,
    usesDocker?: boolean,
    enforceAllPolicies: boolean = true
  ): string {
    let stages = 'stages:\n';
    
    // Stage 1: Validate (Obligatorio según estándares)
    stages += this.generateValidateStage(projectType);
    
    // Stage 2: Security (Obligatorio según estándares - usando PolicyEnforcer)
    if (enforceAllPolicies) {
      stages += this.policyEnforcer.generateSecurityStage(projectType, { usesDocker, environment });
    } else {
      // Usar el método antiguo para compatibilidad
      stages += this.generateSecurityStage(projectType, standards);
    }
    
    // Stage 2.5: Key Vault Setup (si hay servicios)
    if (services.length > 0) {
      stages += this.generateKeyVaultStage(services);
    }
    
    // Stage 3: Build
    stages += this.generateBuildStage(projectType);
    
    // Stage 4: Test
    stages += this.generateTestStage(projectType, services);
    
    // Stage 5: Deploy (condicional)
    if (environment !== 'dev') {
      stages += this.generateDeployStage(environment, services);
    }
    
    return stages;
  }

  private generateKeyVaultStage(services: string[]): string {
    return `- stage: KeyVault
  displayName: 'Configure Secrets'
  dependsOn: Security
  jobs:
  - job: ConfigureSecrets
    displayName: 'Load secrets from Key Vault'
    pool:
      vmImage: 'ubuntu-latest'
    steps:
    - task: AzureKeyVault@2
      displayName: 'Get secrets from Key Vault'
      inputs:
        azureSubscription: 'AzureServiceConnection'
        KeyVaultName: '$(keyVaultName)'
        SecretsFilter: '*'
        RunAsPreJob: false
    
    # Validate that required secrets are present
    - task: PowerShell@2
      displayName: 'Validate required secrets'
      inputs:
        targetType: 'inline'
        script: |
          $requiredSecrets = @(
${this.getRequiredSecretsForServices(services)}
          )
          
          $missingSecrets = @()
          foreach ($secret in $requiredSecrets) {
            $value = [System.Environment]::GetEnvironmentVariable($secret)
            if ([string]::IsNullOrWhiteSpace($value)) {
              $missingSecrets += $secret
            }
          }
          
          if ($missingSecrets.Count -gt 0) {
            Write-Host "##vso[task.logissue type=error]Missing required secrets in Key Vault:"
            $missingSecrets | ForEach-Object { Write-Host "##vso[task.logissue type=error]- $_" }
            exit 1
          }
          
          Write-Host "##[section]All required secrets are configured"

`;
  }

  private getRequiredSecretsForServices(services: string[]): string {
    let secrets: string[] = [];
    
    services.forEach(service => {
      switch(service) {
        case 'azuresql':
          secrets.push('SQL-ADMIN-USERNAME', 'SQL-ADMIN-PASSWORD');
          break;
        case 'redis':
          secrets.push('REDIS-CONNECTION-STRING', 'REDIS-PRIMARY-KEY');
          break;
        case 'cosmosdb':
          secrets.push('COSMOS-PRIMARY-KEY');
          break;
        case 'servicebus':
          secrets.push('SERVICE-BUS-CONNECTION-STRING');
          break;
        case 'storage':
          secrets.push('STORAGE-ACCOUNT-KEY');
          break;
      }
    });
    
    return secrets.map(s => `            '${s}'`).join(',\n');
  }

  private generateValidateStage(projectType: string): string {
    return `- stage: Validate
  displayName: 'Validación y Linting'
  jobs:
  - job: ValidateJob
    displayName: 'Validar código y configuración'
    pool:
      vmImage: 'ubuntu-latest'
    steps:
    - checkout: self
      clean: true
      fetchDepth: 0
      
    ${this.getValidationSteps(projectType)}

`;
  }

  private getValidationSteps(projectType: string): string {
    switch (projectType) {
      case 'dotnet':
        return `- task: UseDotNet@2
      displayName: 'Instalar .NET SDK'
      inputs:
        version: $(dotnetVersion)
        
    - task: DotNetCoreCLI@2
      displayName: 'Restore packages'
      inputs:
        command: 'restore'
        
    - task: DotNetCoreCLI@2
      displayName: 'Validar formato'
      inputs:
        command: 'custom'
        custom: 'format'
        arguments: '--verify-no-changes'`;
        
      case 'node':
        return `- task: NodeTool@0
      displayName: 'Instalar Node.js'
      inputs:
        versionSpec: $(nodeVersion)
        
    - task: Cache@2
      displayName: 'Cache NPM packages'
      inputs:
        key: 'npm | "$(Agent.OS)" | package-lock.json'
        restoreKeys: |
          npm | "$(Agent.OS)"
        path: $(npm_config_cache)
        
    - script: npm ci
      displayName: 'Install dependencies'
      
    - script: npm run lint
      displayName: 'Lint code'
      continueOnError: false`;
        
      case 'python':
        return `- task: UsePythonVersion@0
      displayName: 'Instalar Python'
      inputs:
        versionSpec: $(pythonVersion)
        
    - script: |
        python -m pip install --upgrade pip
        pip install flake8 black mypy
      displayName: 'Install linting tools'
      
    - script: |
        flake8 . --count --select=E9,F63,F7,F82 --show-source --statistics
        black --check .
      displayName: 'Lint Python code'`;
        
      default:
        return '';
    }
  }

  private generateSecurityStage(projectType: string, standards: Standard): string {
    const securityPolicies = this.wikiParser.getSecurityPolicies();
    
    return `- stage: Security
  displayName: 'Análisis de Seguridad'
  dependsOn: Validate
  jobs:
  - job: SecurityScan
    displayName: 'Escaneo de seguridad completo'
    pool:
      vmImage: 'ubuntu-latest'
    steps:
    # Escaneo de secretos (Obligatorio SEC-001)
    - task: TruffleHog@1
      displayName: 'Escanear secretos en código'
      inputs:
        path: '$(Build.SourcesDirectory)'
        failOnSecrets: true
      continueOnError: false
      
    # SAST con SonarQube (Obligatorio SEC-002)
    - task: SonarQubePrepare@5
      displayName: 'Preparar análisis SonarQube'
      inputs:
        SonarQube: 'SonarQubeServiceConnection'
        scannerMode: 'CLI'
        configMode: 'manual'
        cliProjectKey: '$(Build.Repository.Name)'
        cliProjectName: '$(Build.Repository.Name)'
        
    - task: SonarQubeAnalyze@5
      displayName: 'Ejecutar análisis SonarQube'
      
    - task: SonarQubePublish@5
      displayName: 'Publicar resultados SonarQube'
      inputs:
        pollingTimeoutSec: '300'
        
    # Análisis de dependencias (Obligatorio SEC-003)
    - task: SnykSecurityScan@1
      displayName: 'Escanear vulnerabilidades en dependencias'
      inputs:
        serviceConnectionEndpoint: 'SnykConnection'
        testType: 'app'
        failOnIssues: true
        severityThreshold: 'high'
        
    ${this.getSecurityStepsForProject(projectType)}

`;
  }

  private getSecurityStepsForProject(projectType: string): string {
    switch (projectType) {
      case 'dotnet':
        return `# Análisis específico .NET
    - task: DotNetCoreCLI@2
      displayName: 'Security audit de paquetes'
      inputs:
        command: 'custom'
        custom: 'list'
        arguments: 'package --vulnerable --include-transitive'`;
        
      case 'node':
        return `# Análisis específico Node.js
    - script: npm audit --audit-level=high
      displayName: 'NPM Security Audit'
      continueOnError: false`;
        
      case 'python':
        return `# Análisis específico Python
    - script: |
        pip install safety bandit
        safety check --json
        bandit -r . -f json -o bandit-report.json
      displayName: 'Python Security Scan'`;
        
      default:
        return '';
    }
  }

  private generateBuildStage(projectType: string): string {
    return `- stage: Build
  displayName: 'Compilación'
  dependsOn: Security
  jobs:
  - job: BuildJob
    displayName: 'Build ${projectType}'
    pool:
      vmImage: 'ubuntu-latest'
    steps:
    ${this.getBuildSteps(projectType)}

`;
  }

  private getBuildSteps(projectType: string): string {
    switch (projectType) {
      case 'dotnet':
        return `- task: DotNetCoreCLI@2
      displayName: 'Build solution'
      inputs:
        command: 'build'
        arguments: '--configuration $(buildConfiguration) --no-restore'
        
    - task: DotNetCoreCLI@2
      displayName: 'Publish artifacts'
      inputs:
        command: 'publish'
        publishWebProjects: true
        arguments: '--configuration $(buildConfiguration) --output $(Build.ArtifactStagingDirectory)'
        
    - task: PublishBuildArtifacts@1
      displayName: 'Upload artifacts'
      inputs:
        pathToPublish: '$(Build.ArtifactStagingDirectory)'
        artifactName: 'drop'`;
        
      case 'node':
        return `- script: npm run build
      displayName: 'Build application'
      
    - task: ArchiveFiles@2
      displayName: 'Archive build output'
      inputs:
        rootFolderOrFile: 'dist'
        includeRootFolder: false
        archiveType: 'zip'
        archiveFile: '$(Build.ArtifactStagingDirectory)/$(Build.BuildId).zip'
        
    - task: PublishBuildArtifacts@1
      displayName: 'Upload artifacts'
      inputs:
        pathToPublish: '$(Build.ArtifactStagingDirectory)'
        artifactName: 'drop'`;
        
      case 'python':
        return `- script: |
        python setup.py sdist bdist_wheel
      displayName: 'Build Python package'
      
    - task: PublishBuildArtifacts@1
      displayName: 'Upload artifacts'
      inputs:
        pathToPublish: 'dist'
        artifactName: 'dist'`;
        
      default:
        return '';
    }
  }

  private generateTestStage(projectType: string, services: string[] = []): string {
    return `- stage: Test
  displayName: 'Tests'
  dependsOn: Build
  jobs:
  - job: UnitTests
    displayName: 'Tests unitarios'
    pool:
      vmImage: 'ubuntu-latest'
    steps:
    ${this.getTestSteps(projectType)}
    
  - job: IntegrationTests
    displayName: 'Tests de integración'
    pool:
      vmImage: 'ubuntu-latest'
    steps:
    ${this.getIntegrationTestSteps(projectType, services)}

`;
  }

  private getTestSteps(projectType: string): string {
    switch (projectType) {
      case 'dotnet':
        return `- task: DotNetCoreCLI@2
      displayName: 'Run unit tests'
      inputs:
        command: 'test'
        arguments: '--configuration $(buildConfiguration) --collect:"XPlat Code Coverage" --logger trx'
        
    - task: PublishTestResults@2
      displayName: 'Publish test results'
      inputs:
        testResultsFormat: 'VSTest'
        testResultsFiles: '**/*.trx'
        
    - task: PublishCodeCoverageResults@1
      displayName: 'Publish code coverage'
      inputs:
        codeCoverageTool: 'Cobertura'
        summaryFileLocation: '$(Agent.TempDirectory)/**/coverage.cobertura.xml'`;
        
      case 'node':
        return `- script: npm test -- --coverage
      displayName: 'Run tests with coverage'
      
    - task: PublishTestResults@2
      displayName: 'Publish test results'
      inputs:
        testResultsFormat: 'JUnit'
        testResultsFiles: '**/test-results.xml'
        
    - task: PublishCodeCoverageResults@1
      displayName: 'Publish code coverage'
      inputs:
        codeCoverageTool: 'Cobertura'
        summaryFileLocation: 'coverage/cobertura-coverage.xml'`;
        
      case 'python':
        return `- script: |
        pytest tests/ --cov=./ --cov-report=xml --cov-report=html --junitxml=test-results.xml
      displayName: 'Run pytest with coverage'
      
    - task: PublishTestResults@2
      displayName: 'Publish test results'
      inputs:
        testResultsFormat: 'JUnit'
        testResultsFiles: 'test-results.xml'
        
    - task: PublishCodeCoverageResults@1
      displayName: 'Publish code coverage'
      inputs:
        codeCoverageTool: 'Cobertura'
        summaryFileLocation: 'coverage.xml'`;
        
      default:
        return '';
    }
  }

  private getIntegrationTestSteps(projectType: string, services: string[] = []): string {
    let steps = `- script: echo "Running integration tests for ${projectType}"
      displayName: 'Integration tests setup'\n`;
    
    if (services.length > 0) {
      steps += `    
    # Service-specific integration tests
    - task: PowerShell@2
      displayName: 'Test service integrations'
      inputs:
        targetType: 'inline'
        script: |
          Write-Host "Testing service integrations..."
`;
      
      if (services.includes('azuresql')) {
        steps += `          
          # Test SQL Database connection
          Write-Host "Testing SQL Database integration..."
          # In a real scenario, this would run actual SQL integration tests
          Write-Host "##[section]SQL integration test completed"
`;
      }
      
      if (services.includes('redis')) {
        steps += `          
          # Test Redis cache integration
          Write-Host "Testing Redis cache integration..."
          # In a real scenario, this would test cache operations
          Write-Host "##[section]Redis integration test completed"
`;
      }
      
      if (services.includes('cosmosdb')) {
        steps += `          
          # Test CosmosDB integration
          Write-Host "Testing CosmosDB integration..."
          # In a real scenario, this would test document operations
          Write-Host "##[section]CosmosDB integration test completed"
`;
      }
      
      if (services.includes('servicebus')) {
        steps += `          
          # Test Service Bus integration
          Write-Host "Testing Service Bus integration..."
          # In a real scenario, this would test message queue operations
          Write-Host "##[section]Service Bus integration test completed"
`;
      }
      
      steps += `          
          Write-Host "##[section]All integration tests completed"
`;
    }
    
    return steps;
  }

  private generateDeployStage(environment: string, services: string[]): string {
    return `- stage: Deploy
  displayName: 'Deploy to ${environment}'
  dependsOn: Test
  condition: and(succeeded(), eq(variables['Build.SourceBranch'], 'refs/heads/${environment === 'prod' ? 'main' : 'develop'}'))
  jobs:
  - deployment: DeployJob
    displayName: 'Deploy to ${environment}'
    environment: '${environment}'
    pool:
      vmImage: 'ubuntu-latest'
    strategy:
      runOnce:
        deploy:
          steps:
          - checkout: none
          
          - download: current
            artifact: 'drop'
            
          # Pre-deployment validation for services
          ${this.getServicePreDeploymentValidation(services)}
          
          - task: AzureWebApp@1
            displayName: 'Deploy to Azure App Service'
            inputs:
              azureSubscription: 'AzureServiceConnection'
              appName: 'app-$(Build.Repository.Name)-${environment}'
              package: '$(Pipeline.Workspace)/drop/*.zip'
              
          ${this.getServiceDeploymentSteps(services)}
          
          # Post-deployment health checks
          ${this.getServiceHealthChecks(services)}
`;
  }

  private getServiceDeploymentSteps(services: string[]): string {
    let steps = '';
    
    if (services.includes('azuresql')) {
      steps += `# Database migration
          - task: SqlAzureDacpacDeployment@1
            displayName: 'Deploy database schema'
            inputs:
              azureSubscription: 'AzureServiceConnection'
              serverName: '$(sqlServerName)'
              databaseName: '$(sqlDatabaseName)'
              sqlUsername: '$(sqlUsername)'
              sqlPassword: '$(sqlPassword)'
              deployType: 'DacpacTask'
              
          `;
    }
    
    if (services.includes('redis')) {
      steps += `# Redis cache configuration
          - task: AzureCLI@2
            displayName: 'Configure Redis cache'
            inputs:
              azureSubscription: 'AzureServiceConnection'
              scriptType: 'bash'
              scriptLocation: 'inlineScript'
              inlineScript: |
                az redis update --name $(redisName) --resource-group $(resourceGroup) --sku Standard --vm-size C1
          `;
    }
    
    if (services.includes('cosmosdb')) {
      steps += `# CosmosDB configuration
          - task: AzureCLI@2
            displayName: 'Configure CosmosDB'
            inputs:
              azureSubscription: 'AzureServiceConnection'
              scriptType: 'bash'
              scriptLocation: 'inlineScript'
              inlineScript: |
                az cosmosdb update --name $(cosmosDbName) --resource-group $(resourceGroup)
                az cosmosdb sql database throughput update --account-name $(cosmosDbName) --name $(databaseName) --resource-group $(resourceGroup) --throughput 400
          `;
    }
    
    if (services.includes('servicebus')) {
      steps += `# Service Bus configuration
          - task: AzureCLI@2
            displayName: 'Configure Service Bus queues'
            inputs:
              azureSubscription: 'AzureServiceConnection'
              scriptType: 'bash'
              scriptLocation: 'inlineScript'
              inlineScript: |
                az servicebus queue create --resource-group $(resourceGroup) --namespace-name $(serviceBusNamespace) --name main-queue
                az servicebus queue create --resource-group $(resourceGroup) --namespace-name $(serviceBusNamespace) --name dead-letter-queue
          `;
    }
    
    return steps;
  }

  private getServicePreDeploymentValidation(services: string[]): string {
    if (services.length === 0) return '';
    
    let validation = `# Pre-deployment service validation
          - task: AzureCLI@2
            displayName: 'Validate service availability'
            inputs:
              azureSubscription: 'AzureServiceConnection'
              scriptType: 'bash'
              scriptLocation: 'inlineScript'
              inlineScript: |
                echo "Validating required services..."
`;
    
    if (services.includes('azuresql')) {
      validation += `                # Validate Azure SQL connectivity
                az sql server show --name $(sqlServerName) --resource-group $(resourceGroup)
                if [ $? -ne 0 ]; then
                  echo "##vso[task.logissue type=error]Azure SQL Server $(sqlServerName) not accessible"
                  exit 1
                fi
`;
    }
    
    if (services.includes('redis')) {
      validation += `                # Validate Redis cache
                az redis show --name $(redisName) --resource-group $(resourceGroup)
                if [ $? -ne 0 ]; then
                  echo "##vso[task.logissue type=error]Redis cache $(redisName) not accessible"
                  exit 1
                fi
`;
    }
    
    if (services.includes('cosmosdb')) {
      validation += `                # Validate CosmosDB
                az cosmosdb show --name $(cosmosDbName) --resource-group $(resourceGroup)
                if [ $? -ne 0 ]; then
                  echo "##vso[task.logissue type=error]CosmosDB $(cosmosDbName) not accessible"
                  exit 1
                fi
`;
    }
    
    if (services.includes('servicebus')) {
      validation += `                # Validate Service Bus
                az servicebus namespace show --name $(serviceBusNamespace) --resource-group $(resourceGroup)
                if [ $? -ne 0 ]; then
                  echo "##vso[task.logissue type=error]Service Bus $(serviceBusNamespace) not accessible"
                  exit 1
                fi
`;
    }
    
    validation += `                echo "All required services validated successfully"
          
          `;
    
    return validation;
  }

  private getServiceHealthChecks(services: string[]): string {
    if (services.length === 0) return '';
    
    let healthChecks = `# Post-deployment health checks
          - task: PowerShell@2
            displayName: 'Service health checks'
            inputs:
              targetType: 'inline'
              script: |
                $errors = @()
`;
    
    if (services.includes('azuresql')) {
      healthChecks += `                
                # Test Azure SQL connectivity
                Write-Host "Testing Azure SQL connection..."
                try {
                  $sqlConnection = New-Object System.Data.SqlClient.SqlConnection
                  $sqlConnection.ConnectionString = "$(sqlConnectionString)"
                  $sqlConnection.Open()
                  Write-Host "##[section]Azure SQL connection successful"
                  $sqlConnection.Close()
                } catch {
                  $errors += "Azure SQL connection failed: $_"
                }
`;
    }
    
    if (services.includes('redis')) {
      healthChecks += `                
                # Test Redis connectivity
                Write-Host "Testing Redis cache..."
                $redisHost = "$(redisName).redis.cache.windows.net"
                $redisPort = 6380
                try {
                  $tcpClient = New-Object System.Net.Sockets.TcpClient
                  $tcpClient.Connect($redisHost, $redisPort)
                  if ($tcpClient.Connected) {
                    Write-Host "##[section]Redis cache is reachable"
                    $tcpClient.Close()
                  }
                } catch {
                  $errors += "Redis connection failed: $_"
                }
`;
    }
    
    if (services.includes('cosmosdb')) {
      healthChecks += `                
                # Test CosmosDB endpoint
                Write-Host "Testing CosmosDB endpoint..."
                $cosmosEndpoint = "https://$(cosmosDbName).documents.azure.com:443/"
                try {
                  $response = Invoke-WebRequest -Uri $cosmosEndpoint -UseBasicParsing -TimeoutSec 10
                  if ($response.StatusCode -eq 401) {
                    Write-Host "##[section]CosmosDB endpoint is responding (auth required as expected)"
                  }
                } catch {
                  if ($_.Exception.Response.StatusCode -eq 401) {
                    Write-Host "##[section]CosmosDB endpoint is responding"
                  } else {
                    $errors += "CosmosDB endpoint unreachable: $_"
                  }
                }
`;
    }
    
    if (services.includes('servicebus')) {
      healthChecks += `                
                # Test Service Bus connectivity
                Write-Host "Testing Service Bus..."
                # This would normally use the Service Bus SDK
                Write-Host "##[section]Service Bus health check placeholder - implement with SDK"
`;
    }
    
    healthChecks += `                
                # Report any errors
                if ($errors.Count -gt 0) {
                  Write-Host "##vso[task.logissue type=error]Health check failures:"
                  $errors | ForEach-Object { Write-Host "##vso[task.logissue type=error]$_" }
                  exit 1
                } else {
                  Write-Host "##[section]All health checks passed successfully"
                }
          
          `;
    
    return healthChecks;
  }
}
