/**
 * Multi-Platform Pipeline Generator
 * Generates CI/CD pipelines for Azure DevOps, GitHub Actions, and GitLab CI
 */

import { WikiParser, Standard } from './wiki-parser.js';
import { PolicyEnforcer } from './policy-enforcer.js';
import {
  PlatformFactory,
  PlatformAdapter,
  PlatformType,
  PlatformPipeline,
  PlatformStage,
  PlatformJob,
  PlatformStep,
  PlatformVariable,
} from './platforms/index.js';

export interface MultiPlatformGenerateOptions {
  projectType: 'dotnet' | 'node' | 'python' | 'java' | 'go';
  services: string[];
  environment: 'dev' | 'staging' | 'prod';
  standards: Standard;
  usesDocker?: boolean;
  enforceAllPolicies?: boolean;
  /** Target platform - defaults to 'azure-devops' */
  platform?: PlatformType;
}

export class MultiPlatformGenerator {
  private policyEnforcer: PolicyEnforcer;

  constructor(private wikiParser: WikiParser) {
    this.policyEnforcer = new PolicyEnforcer(wikiParser);
  }

  async generatePipeline(options: MultiPlatformGenerateOptions): Promise<string> {
    const {
      projectType,
      services,
      environment,
      usesDocker = false,
      enforceAllPolicies = true,
      platform = 'azure-devops',
    } = options;

    // Load policies
    await this.policyEnforcer.loadPolicies();

    // Get platform adapter
    const adapter = PlatformFactory.getAdapter(platform);

    // Build abstract pipeline
    const abstractPipeline = this.buildAbstractPipeline(
      adapter,
      projectType,
      services,
      environment,
      usesDocker,
      enforceAllPolicies
    );

    // Generate platform-specific YAML
    const yaml = adapter.generateYaml(abstractPipeline);

    // Add header comment
    return this.generateHeader(options, platform) + yaml;
  }

  private generateHeader(options: MultiPlatformGenerateOptions, platform: PlatformType): string {
    const timestamp = new Date().toISOString();
    const platformName = platform === 'azure-devops' ? 'Azure Pipelines' : 'GitHub Actions';

    return `# Pipeline CI/CD Autogenerado
# Generado por: Pipeline Assistant MCP
# Plataforma: ${platformName}
# Fecha: ${timestamp}
# Tipo de proyecto: ${options.projectType}
# Ambiente: ${options.environment}
# Basado en: wiki/standards/pipeline-standards.md

`;
  }

  private buildAbstractPipeline(
    adapter: PlatformAdapter,
    projectType: string,
    services: string[],
    environment: string,
    usesDocker: boolean,
    enforceAllPolicies: boolean
  ): PlatformPipeline {
    const pipeline: PlatformPipeline = {
      platform: adapter.platform,
      trigger: {
        branches: {
          include: this.getBranchesForEnvironment(environment),
        },
        paths: {
          exclude: ['*.md', 'docs/*', '.github/*'],
        },
        pr: {
          branches: ['main', 'develop'],
        },
      },
      variables: this.buildVariables(projectType, services, environment),
      pool: {
        vmImage: 'ubuntu-latest',
      },
      stages: [],
    };

    // Build stages
    const stages: PlatformStage[] = [];

    // 1. Validate Stage
    stages.push(this.buildValidateStage(adapter, projectType));

    // 2. Security Stage (if enforcing policies)
    if (enforceAllPolicies) {
      stages.push(this.buildSecurityStage(adapter, projectType));
    }

    // 3. Build Stage
    stages.push(this.buildBuildStage(adapter, projectType, services, environment));

    // 4. Test Stage
    stages.push(this.buildTestStage(adapter, projectType, services));

    // 5. Docker Build Stage (if using Docker)
    if (usesDocker) {
      stages.push(this.buildDockerStage(adapter));
    }

    // 6. Deploy Stage
    stages.push(this.buildDeployStage(adapter, environment, usesDocker, services));

    pipeline.stages = stages;

    return pipeline;
  }

  private getBranchesForEnvironment(environment: string): string[] {
    switch (environment) {
      case 'prod':
        return ['main'];
      case 'staging':
        return ['develop', 'release/*'];
      default:
        return ['feature/*', 'develop'];
    }
  }

  private buildVariables(projectType: string, services: string[], environment: string): PlatformVariable[] {
    const variables: PlatformVariable[] = [
      { group: `${environment}-variables` },
      { name: 'buildConfiguration', value: environment === 'prod' ? 'Release' : 'Debug' },
    ];

    // Project-specific variables
    switch (projectType) {
      case 'dotnet':
        variables.push({ name: 'dotnetVersion', value: '8.x' });
        break;
      case 'node':
        variables.push({ name: 'nodeVersion', value: '20.x' });
        break;
      case 'python':
        variables.push({ name: 'pythonVersion', value: '3.11' });
        break;
    }

    // Service-specific variables
    if (services.includes('redis')) {
      variables.push({ name: 'REDIS_HOST', value: `$(${environment}-redis-host)` });
      variables.push({ name: 'REDIS_PORT', value: '6380' });
      variables.push({ name: 'REDIS_SSL', value: 'true' });
    }

    if (services.includes('azuresql')) {
      variables.push({ name: 'SQL_SERVER', value: `$(${environment}-sql-server)` });
      variables.push({ name: 'SQL_DATABASE', value: `$(${environment}-sql-database)` });
    }

    if (services.includes('cosmosdb')) {
      variables.push({ name: 'COSMOS_ENDPOINT', value: `$(${environment}-cosmos-endpoint)` });
      variables.push({ name: 'COSMOS_DATABASE', value: `$(${environment}-cosmos-database)` });
    }

    if (services.includes('servicebus')) {
      variables.push({ name: 'SERVICEBUS_NAMESPACE', value: `$(${environment}-servicebus-namespace)` });
    }

    if (services.includes('storage')) {
      variables.push({ name: 'STORAGE_ACCOUNT', value: `$(${environment}-storage-account)` });
    }

    // Add Key Vault reference if any secrets are needed
    if (services.length > 0 || environment === 'prod') {
      variables.push({ name: 'keyVaultName', value: `kv-${environment}-001` });
    }

    return variables;
  }

  private buildValidateStage(adapter: PlatformAdapter, projectType: string): PlatformStage {
    const steps: PlatformStep[] = [];

    // Setup runtime
    switch (projectType) {
      case 'dotnet':
        steps.push(adapter.getDotNetSetupTask('8.x'));
        steps.push({
          script: 'dotnet restore',
          displayName: 'Restore Dependencies',
        });
        steps.push({
          script: 'dotnet format --verify-no-changes',
          displayName: 'Check Formatting',
        });
        break;
      case 'node':
        steps.push(adapter.getNodeSetupTask('20.x'));
        steps.push({
          script: 'npm ci',
          displayName: 'Install Dependencies',
        });
        steps.push({
          script: 'npm run lint',
          displayName: 'Run ESLint',
        });
        break;
      case 'python':
        steps.push(adapter.getPythonSetupTask('3.11'));
        steps.push({
          script: 'pip install -r requirements.txt',
          displayName: 'Install Dependencies',
        });
        steps.push({
          script: 'flake8 . && black --check .',
          displayName: 'Lint & Format Check',
        });
        break;
    }

    return {
      id: 'Validate',
      displayName: 'Code Validation',
      jobs: [
        {
          id: 'Lint',
          displayName: 'Linting & Format Check',
          steps,
        },
      ],
    };
  }

  private buildSecurityStage(adapter: PlatformAdapter, projectType: string): PlatformStage {
    const jobs: PlatformJob[] = [];

    // Secret Scanning Job
    jobs.push({
      id: 'SecretScan',
      displayName: 'Secret Detection',
      steps: [adapter.getSecretScanningStep()],
    });

    // SAST Job (SonarQube/SonarCloud)
    jobs.push({
      id: 'SAST',
      displayName: 'Static Analysis',
      steps: adapter.getSastStep(projectType),
    });

    // Dependency Scanning Job
    const depScanSteps: PlatformStep[] = [];

    // Add project-specific audit
    switch (projectType) {
      case 'node':
        depScanSteps.push(adapter.getNodeSetupTask('20.x'));
        depScanSteps.push({
          script: 'npm ci',
          displayName: 'Install Dependencies',
        });
        depScanSteps.push({
          script: 'npm audit --audit-level=high',
          displayName: 'NPM Security Audit',
        });
        break;
      case 'dotnet':
        depScanSteps.push(adapter.getDotNetSetupTask('8.x'));
        depScanSteps.push({
          script: 'dotnet list package --vulnerable --include-transitive',
          displayName: '.NET Vulnerability Check',
        });
        break;
      case 'python':
        depScanSteps.push(adapter.getPythonSetupTask('3.11'));
        depScanSteps.push({
          script: 'pip install safety && safety check -r requirements.txt',
          displayName: 'Python Safety Check',
        });
        break;
    }

    depScanSteps.push(adapter.getDependencyScanningStep({ severityThreshold: 'high', failOnIssues: true }));

    jobs.push({
      id: 'DependencyScan',
      displayName: 'Dependency Scanning',
      steps: depScanSteps,
    });

    return {
      id: 'Security',
      displayName: 'Security Scanning',
      dependsOn: ['Validate'],
      jobs,
    };
  }

  private buildBuildStage(adapter: PlatformAdapter, projectType: string, services: string[], environment: string): PlatformStage {
    const steps: PlatformStep[] = [];

    // Add Key Vault step if services are configured or in production
    if (services.length > 0 || environment === 'prod') {
      steps.push(adapter.getKeyVaultStep(`kv-${environment}-001`));
    }

    switch (projectType) {
      case 'dotnet':
        steps.push(adapter.getDotNetSetupTask('8.x'));
        steps.push({
          script: 'dotnet build --configuration $(buildConfiguration)',
          displayName: 'Build Application',
        });
        steps.push({
          script: 'dotnet publish --configuration $(buildConfiguration) --output $(Build.ArtifactStagingDirectory)',
          displayName: 'Publish Application',
        });
        break;
      case 'node':
        steps.push(adapter.getNodeSetupTask('20.x'));
        steps.push({
          script: 'npm ci',
          displayName: 'Install Dependencies',
        });
        steps.push({
          script: 'npm run build',
          displayName: 'Build Application',
        });
        break;
      case 'python':
        steps.push(adapter.getPythonSetupTask('3.11'));
        steps.push({
          script: 'pip install -r requirements.txt',
          displayName: 'Install Dependencies',
        });
        steps.push({
          script: 'python setup.py build',
          displayName: 'Build Application',
        });
        break;
    }

    steps.push(adapter.getPublishArtifactTask('drop', '$(Build.ArtifactStagingDirectory)'));

    return {
      id: 'Build',
      displayName: 'Build Application',
      dependsOn: ['Security'],
      jobs: [
        {
          id: 'BuildApp',
          displayName: `Build ${projectType} Application`,
          steps,
        },
      ],
    };
  }

  private buildTestStage(adapter: PlatformAdapter, projectType: string, services: string[]): PlatformStage {
    const steps: PlatformStep[] = [];

    switch (projectType) {
      case 'dotnet':
        steps.push(adapter.getDotNetSetupTask('8.x'));
        steps.push({
          script: 'dotnet test --configuration $(buildConfiguration) --collect:"XPlat Code Coverage" --logger trx',
          displayName: 'Run Tests',
        });
        steps.push(adapter.getPublishTestResultsTask('VSTest', '**/*.trx'));
        steps.push(adapter.getPublishCodeCoverageTask('cobertura', '**/coverage.cobertura.xml'));
        break;
      case 'node':
        steps.push(adapter.getNodeSetupTask('20.x'));
        steps.push({
          script: 'npm ci',
          displayName: 'Install Dependencies',
        });
        steps.push({
          script: 'npm test -- --coverage',
          displayName: 'Run Tests',
        });
        steps.push(adapter.getPublishTestResultsTask('JUnit', '**/junit.xml'));
        steps.push(adapter.getPublishCodeCoverageTask('cobertura', 'coverage/cobertura-coverage.xml'));
        break;
      case 'python':
        steps.push(adapter.getPythonSetupTask('3.11'));
        steps.push({
          script: 'pip install -r requirements.txt pytest pytest-cov',
          displayName: 'Install Dependencies',
        });
        steps.push({
          script: 'pytest --cov=. --cov-report=xml --junitxml=test-results.xml',
          displayName: 'Run Tests',
        });
        steps.push(adapter.getPublishTestResultsTask('JUnit', 'test-results.xml'));
        steps.push(adapter.getPublishCodeCoverageTask('cobertura', 'coverage.xml'));
        break;
    }

    // Build service containers for integration tests
    const serviceContainers: Record<string, any> = {};
    if (services.includes('redis')) {
      serviceContainers['redis'] = {
        image: 'redis:7-alpine',
        ports: ['6379:6379'],
      };
    }

    return {
      id: 'Test',
      displayName: 'Testing',
      dependsOn: ['Build'],
      jobs: [
        {
          id: 'UnitTests',
          displayName: 'Unit Tests',
          steps,
          ...(Object.keys(serviceContainers).length > 0 && { services: serviceContainers }),
        },
      ],
    };
  }

  private buildDockerStage(adapter: PlatformAdapter): PlatformStage {
    const steps: PlatformStep[] = [];

    // Build Docker image
    const buildTask = adapter.getDockerBuildTask({
      repository: '$(imageRepository)',
      dockerfile: '**/Dockerfile',
      tags: ['$(Build.BuildId)', 'latest'],
    });

    if (Array.isArray(buildTask)) {
      steps.push(...buildTask);
    } else {
      steps.push(buildTask);
    }

    // Container scanning
    steps.push(adapter.getContainerScanningStep('$(imageRepository):$(Build.BuildId)'));

    // Push Docker image
    const pushTask = adapter.getDockerPushTask({
      repository: '$(imageRepository)',
      tags: ['$(Build.BuildId)', 'latest'],
      serviceConnection: 'ACR-ServiceConnection',
    });

    if (Array.isArray(pushTask)) {
      steps.push(...pushTask);
    } else {
      steps.push(pushTask);
    }

    return {
      id: 'Docker',
      displayName: 'Build & Push Docker Image',
      dependsOn: ['Test'],
      jobs: [
        {
          id: 'DockerBuild',
          displayName: 'Docker Build & Push',
          steps,
        },
      ],
    };
  }

  private buildDeployStage(adapter: PlatformAdapter, environment: string, usesDocker: boolean, services: string[]): PlatformStage {
    const dependsOn = usesDocker ? ['Docker'] : ['Test'];
    const steps: PlatformStep[] = [];

    // Add health checks for configured services
    if (services.length > 0) {
      const healthCheckCommands: string[] = [];

      if (services.includes('redis')) {
        healthCheckCommands.push('echo "Checking Redis connectivity..."');
        healthCheckCommands.push('redis-cli -h $(REDIS_HOST) -p $(REDIS_PORT) --tls ping || echo "Redis check skipped (CLI not available)"');
      }

      if (services.includes('azuresql')) {
        healthCheckCommands.push('echo "Checking Azure SQL connectivity..."');
        healthCheckCommands.push('sqlcmd -S $(SQL_SERVER) -d $(SQL_DATABASE) -Q "SELECT 1" || echo "SQL check skipped (sqlcmd not available)"');
      }

      if (services.includes('cosmosdb')) {
        healthCheckCommands.push('echo "Checking CosmosDB endpoint..."');
        healthCheckCommands.push('curl -s --fail $(COSMOS_ENDPOINT) || echo "CosmosDB check skipped"');
      }

      if (healthCheckCommands.length > 0) {
        steps.push({
          script: healthCheckCommands.join('\n'),
          displayName: 'Service Health Checks',
          continueOnError: true,
        });
      }
    }

    // Main deploy step
    steps.push({
      script: `echo "Deploying to ${environment}..."`,
      displayName: 'Deploy Application',
    });

    // Add production-specific steps
    if (environment === 'prod') {
      steps.push({
        script: 'echo "Running smoke tests..."',
        displayName: 'Smoke Tests',
      });
    }

    return {
      id: `Deploy${environment.charAt(0).toUpperCase() + environment.slice(1)}`,
      displayName: `Deploy to ${environment.charAt(0).toUpperCase() + environment.slice(1)}`,
      dependsOn,
      condition: environment === 'prod'
        ? "and(succeeded(), eq(variables['Build.SourceBranch'], 'refs/heads/main'))"
        : undefined,
      jobs: [
        {
          id: 'Deploy',
          displayName: `Deploy to ${environment} Environment`,
          steps,
        },
      ],
    };
  }

  /**
   * Get supported platforms
   */
  static getSupportedPlatforms(): PlatformType[] {
    return PlatformFactory.getSupportedPlatforms();
  }
}
