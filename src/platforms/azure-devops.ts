/**
 * Azure DevOps Platform Adapter
 * Generates Azure Pipelines YAML from abstract pipeline definitions
 */

import * as yaml from 'js-yaml';
import {
  PlatformAdapter,
  PlatformPipeline,
  PlatformStep,
  PlatformScript,
  PlatformTask,
  PlatformJob,
  DockerBuildOptions,
  DockerPushOptions,
  SastOptions,
  DependencyScanOptions,
  PlatformType,
  PlatformVariable,
} from './types.js';

export class AzureDevOpsPlatform implements PlatformAdapter {
  readonly platform: PlatformType = 'azure-devops';

  generateYaml(pipeline: PlatformPipeline): string {
    const azurePipeline: Record<string, unknown> = {};

    // Trigger
    if (pipeline.trigger) {
      azurePipeline.trigger = this.convertTrigger(pipeline.trigger);
    }

    // PR trigger
    if (pipeline.trigger?.pr) {
      azurePipeline.pr = pipeline.trigger.pr.branches || ['main'];
    }

    // Pool
    if (pipeline.pool) {
      azurePipeline.pool = {
        vmImage: pipeline.pool.vmImage || 'ubuntu-latest',
      };
    }

    // Variables
    if (pipeline.variables && pipeline.variables.length > 0) {
      azurePipeline.variables = pipeline.variables.map((v: PlatformVariable) => {
        if (v.group) {
          return { group: v.group };
        }
        return { name: v.name, value: v.value };
      });
    }

    // Stages
    if (pipeline.stages && pipeline.stages.length > 0) {
      azurePipeline.stages = pipeline.stages.map((stage) => ({
        stage: stage.id,
        displayName: stage.displayName,
        dependsOn: stage.dependsOn,
        condition: stage.condition,
        jobs: stage.jobs.map((job) => this.convertJob(job)),
      }));
    } else if (pipeline.jobs && pipeline.jobs.length > 0) {
      // Single-stage pipeline
      azurePipeline.jobs = pipeline.jobs.map((job) => this.convertJob(job));
    }

    return yaml.dump(azurePipeline, {
      lineWidth: -1,
      noRefs: true,
      quotingType: "'",
      forceQuotes: false,
    });
  }

  private convertTrigger(trigger: PlatformPipeline['trigger']): unknown {
    if (!trigger) return 'none';

    return {
      branches: trigger.branches,
      paths: trigger.paths,
    };
  }

  private convertJob(job: PlatformJob): Record<string, unknown> {
    const azureJob: Record<string, unknown> = {
      job: job.id,
      displayName: job.displayName,
    };

    if (job.dependsOn) {
      azureJob.dependsOn = job.dependsOn;
    }

    if (job.condition) {
      azureJob.condition = job.condition;
    }

    if (job.pool) {
      azureJob.pool = {
        vmImage: job.pool.vmImage || 'ubuntu-latest',
      };
    }

    if (job.services) {
      azureJob.services = job.services;
    }

    azureJob.steps = job.steps.map((step: PlatformStep) => this.convertStep(step));

    return azureJob;
  }

  private convertStep(step: PlatformStep): Record<string, unknown> {
    if ('script' in step) {
      const scriptStep = step as PlatformScript;
      const result: Record<string, unknown> = {
        script: scriptStep.script,
        displayName: scriptStep.displayName,
      };
      if (scriptStep.workingDirectory) {
        result.workingDirectory = scriptStep.workingDirectory;
      }
      if (scriptStep.env) {
        result.env = scriptStep.env;
      }
      if (scriptStep.continueOnError !== undefined) {
        result.continueOnError = scriptStep.continueOnError;
      }
      if (scriptStep.condition) {
        result.condition = scriptStep.condition;
      }
      return result;
    }

    const taskStep = step as PlatformTask;
    const result: Record<string, unknown> = {
      task: taskStep.id,
      displayName: taskStep.displayName,
    };
    if (taskStep.inputs) {
      result.inputs = taskStep.inputs;
    }
    if (taskStep.env) {
      result.env = taskStep.env;
    }
    if (taskStep.continueOnError !== undefined) {
      result.continueOnError = taskStep.continueOnError;
    }
    if (taskStep.condition) {
      result.condition = taskStep.condition;
    }
    return result;
  }

  getNodeSetupTask(version: string): PlatformTask {
    return {
      id: 'NodeTool@0',
      displayName: 'Install Node.js',
      inputs: {
        versionSpec: version,
      },
    };
  }

  getDotNetSetupTask(version: string): PlatformTask {
    return {
      id: 'UseDotNet@2',
      displayName: 'Install .NET SDK',
      inputs: {
        packageType: 'sdk',
        version: version,
      },
    };
  }

  getPythonSetupTask(version: string): PlatformTask {
    return {
      id: 'UsePythonVersion@0',
      displayName: 'Install Python',
      inputs: {
        versionSpec: version,
        addToPath: true,
      },
    };
  }

  getCacheTask(key: string, path: string, restoreKeys?: string[]): PlatformTask {
    return {
      id: 'Cache@2',
      displayName: 'Cache dependencies',
      inputs: {
        key: key,
        path: path,
        restoreKeys: restoreKeys?.join('\n') || '',
      },
    };
  }

  getDockerBuildTask(options: DockerBuildOptions): PlatformTask {
    return {
      id: 'Docker@2',
      displayName: 'Build Docker Image',
      inputs: {
        command: 'build',
        repository: options.repository,
        dockerfile: options.dockerfile,
        tags: options.tags.join('\n'),
        ...(options.buildArgs && { arguments: Object.entries(options.buildArgs).map(([k, v]) => `--build-arg ${k}=${v}`).join(' ') }),
      },
    };
  }

  getDockerPushTask(options: DockerPushOptions): PlatformTask {
    return {
      id: 'Docker@2',
      displayName: 'Push Docker Image',
      inputs: {
        command: 'push',
        repository: options.repository,
        containerRegistry: options.serviceConnection || 'ACR-ServiceConnection',
        tags: options.tags.join('\n'),
      },
    };
  }

  getSecretScanningStep(): PlatformScript {
    return {
      script: `docker run --rm -v "$(Build.SourcesDirectory):/src" \\
  trufflesecurity/trufflehog:latest \\
  filesystem /src \\
  --fail \\
  --no-update`,
      displayName: 'TruffleHog Secret Scan',
      continueOnError: false,
    };
  }

  getSastStep(projectType: string, options?: SastOptions): PlatformStep[] {
    const steps: PlatformStep[] = [];

    // SonarQube Prepare
    const extraProperties = this.getSonarQubeProperties(projectType);
    steps.push({
      id: 'SonarQubePrepare@6',
      displayName: 'Prepare SonarQube Analysis',
      inputs: {
        SonarQube: options?.serviceConnection || 'SonarQube-Connection',
        scannerMode: 'CLI',
        configMode: 'manual',
        cliProjectKey: options?.projectKey || '$(Build.Repository.Name)',
        cliSources: '.',
        extraProperties: Object.entries(extraProperties)
          .map(([k, v]) => `${k}=${v}`)
          .join('\n'),
      },
    } as PlatformTask);

    // SonarQube Analyze
    steps.push({
      id: 'SonarQubeAnalyze@6',
      displayName: 'Run SonarQube Analysis',
    } as PlatformTask);

    // SonarQube Publish
    steps.push({
      id: 'SonarQubePublish@6',
      displayName: 'Publish SonarQube Results',
      inputs: {
        pollingTimeoutSec: '300',
      },
    } as PlatformTask);

    return steps;
  }

  private getSonarQubeProperties(projectType: string): Record<string, string> {
    switch (projectType) {
      case 'dotnet':
        return {
          'sonar.cs.opencover.reportsPaths': '$(Build.SourcesDirectory)/**/coverage.opencover.xml',
          'sonar.cs.vstest.reportsPaths': '$(Build.SourcesDirectory)/**/*.trx',
        };
      case 'node':
        return {
          'sonar.javascript.lcov.reportPaths': 'coverage/lcov.info',
          'sonar.typescript.lcov.reportPaths': 'coverage/lcov.info',
        };
      case 'python':
        return {
          'sonar.python.coverage.reportPaths': 'coverage.xml',
          'sonar.python.xunit.reportPath': 'test-results.xml',
        };
      default:
        return {};
    }
  }

  getDependencyScanningStep(options?: DependencyScanOptions): PlatformTask {
    return {
      id: 'SnykSecurityScan@1',
      displayName: 'Snyk Security Scan',
      inputs: {
        serviceConnectionEndpoint: options?.serviceConnection || 'Snyk-Connection',
        testType: 'app',
        severityThreshold: options?.severityThreshold || 'high',
        failOnIssues: options?.failOnIssues !== false,
      },
    };
  }

  getContainerScanningStep(image: string): PlatformScript {
    return {
      script: `docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \\
  aquasec/trivy:latest image \\
  --exit-code 1 \\
  --severity CRITICAL,HIGH \\
  ${image}`,
      displayName: 'Trivy Container Scan',
      continueOnError: false,
    };
  }

  getPublishArtifactTask(name: string, path: string): PlatformTask {
    return {
      id: 'PublishBuildArtifacts@1',
      displayName: `Publish Artifact: ${name}`,
      inputs: {
        PathtoPublish: path,
        ArtifactName: name,
        publishLocation: 'Container',
      },
    };
  }

  getPublishTestResultsTask(format: string, files: string): PlatformTask {
    return {
      id: 'PublishTestResults@2',
      displayName: 'Publish Test Results',
      inputs: {
        testResultsFormat: format,
        testResultsFiles: files,
        failTaskOnFailedTests: true,
      },
    };
  }

  getPublishCodeCoverageTask(format: string, summaryFile: string): PlatformTask {
    return {
      id: 'PublishCodeCoverageResults@2',
      displayName: 'Publish Code Coverage',
      inputs: {
        summaryFileLocation: summaryFile,
      },
    };
  }
}
