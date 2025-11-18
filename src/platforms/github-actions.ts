/**
 * GitHub Actions Platform Adapter
 * Generates GitHub Actions workflow YAML from abstract pipeline definitions
 */

import * as yaml from 'js-yaml';
import {
  PlatformAdapter,
  PlatformPipeline,
  PlatformStep,
  PlatformScript,
  PlatformTask,
  DockerBuildOptions,
  DockerPushOptions,
  SastOptions,
  DependencyScanOptions,
  PlatformType,
  PlatformJob,
  PlatformVariable,
} from './types.js';

export class GitHubActionsPlatform implements PlatformAdapter {
  readonly platform: PlatformType = 'github-actions';

  generateYaml(pipeline: PlatformPipeline): string {
    const workflow: Record<string, unknown> = {};

    // Name
    if (pipeline.name) {
      workflow.name = pipeline.name;
    }

    // Triggers
    workflow.on = this.convertTrigger(pipeline.trigger);

    // Environment variables (workflow level)
    if (pipeline.variables && pipeline.variables.length > 0) {
      const envVars: Record<string, string> = {};
      pipeline.variables.forEach((v: PlatformVariable) => {
        if (v.name && v.value && !v.group && !v.secret) {
          envVars[v.name] = v.value;
        }
      });
      if (Object.keys(envVars).length > 0) {
        workflow.env = envVars;
      }
    }

    // Jobs
    const jobs: Record<string, unknown> = {};

    if (pipeline.stages && pipeline.stages.length > 0) {
      // Convert stages to jobs (GitHub Actions doesn't have stages)
      pipeline.stages.forEach((stage) => {
        stage.jobs.forEach((job) => {
          const jobId = `${stage.id}_${job.id}`;
          jobs[jobId] = this.convertJob(job, stage.dependsOn, pipeline.pool);
        });
      });
    } else if (pipeline.jobs && pipeline.jobs.length > 0) {
      pipeline.jobs.forEach((job) => {
        jobs[job.id] = this.convertJob(job, undefined, pipeline.pool);
      });
    }

    workflow.jobs = jobs;

    return yaml.dump(workflow, {
      lineWidth: -1,
      noRefs: true,
      quotingType: "'",
      forceQuotes: false,
    });
  }

  private convertTrigger(trigger: PlatformPipeline['trigger']): unknown {
    if (!trigger) {
      return { push: { branches: ['main'] } };
    }

    const on: Record<string, unknown> = {};

    // Push trigger
    if (trigger.branches || trigger.paths) {
      on.push = {};
      if (trigger.branches?.include) {
        (on.push as Record<string, unknown>).branches = trigger.branches.include;
      }
      if (trigger.paths?.include) {
        (on.push as Record<string, unknown>).paths = trigger.paths.include;
      }
      if (trigger.paths?.exclude) {
        (on.push as Record<string, unknown>)['paths-ignore'] = trigger.paths.exclude;
      }
    }

    // PR trigger
    if (trigger.pr) {
      on.pull_request = {
        branches: trigger.pr.branches || ['main'],
      };
      if (trigger.pr.paths) {
        (on.pull_request as Record<string, unknown>).paths = trigger.pr.paths;
      }
    }

    return on;
  }

  private convertJob(
    job: PlatformJob,
    stageDependsOn?: string[],
    defaultPool?: PlatformPipeline['pool']
  ): Record<string, unknown> {
    const ghJob: Record<string, unknown> = {
      name: job.displayName,
      'runs-on': this.convertRunner(job.pool || defaultPool),
    };

    // Dependencies
    const needs = [...(job.dependsOn || []), ...(stageDependsOn || [])];
    if (needs.length > 0) {
      ghJob.needs = needs;
    }

    // Condition
    if (job.condition) {
      ghJob.if = this.convertCondition(job.condition);
    }

    // Services
    if (job.services) {
      ghJob.services = job.services;
    }

    // Environment variables
    if (job.env) {
      ghJob.env = job.env;
    }

    // Steps
    ghJob.steps = [
      { uses: 'actions/checkout@v4' },
      ...job.steps.map(step => this.convertStep(step)),
    ];

    return ghJob;
  }

  private convertRunner(pool?: { vmImage?: string; name?: string }): string {
    if (!pool) return 'ubuntu-latest';

    const vmImage = pool.vmImage?.toLowerCase() || '';

    if (vmImage.includes('ubuntu')) return 'ubuntu-latest';
    if (vmImage.includes('windows')) return 'windows-latest';
    if (vmImage.includes('macos')) return 'macos-latest';

    return pool.vmImage || 'ubuntu-latest';
  }

  private convertCondition(condition: string): string {
    // Convert Azure DevOps conditions to GitHub Actions
    return condition
      .replace(/eq\(variables\['Build\.SourceBranch'\], 'refs\/heads\/main'\)/g, "github.ref == 'refs/heads/main'")
      .replace(/eq\(variables\['Build\.SourceBranch'\], 'refs\/heads\/develop'\)/g, "github.ref == 'refs/heads/develop'")
      .replace(/succeeded\(\)/g, "success()")
      .replace(/failed\(\)/g, "failure()")
      .replace(/always\(\)/g, "always()");
  }

  private convertStep(step: PlatformStep): Record<string, unknown> {
    if ('script' in step) {
      const scriptStep = step as PlatformScript;
      const result: Record<string, unknown> = {
        name: scriptStep.displayName,
        run: scriptStep.script,
      };
      if (scriptStep.workingDirectory) {
        result['working-directory'] = scriptStep.workingDirectory;
      }
      if (scriptStep.env) {
        result.env = scriptStep.env;
      }
      if (scriptStep.continueOnError) {
        result['continue-on-error'] = scriptStep.continueOnError;
      }
      if (scriptStep.condition) {
        result.if = this.convertCondition(scriptStep.condition);
      }
      return result;
    }

    const taskStep = step as PlatformTask;
    const result: Record<string, unknown> = {
      name: taskStep.displayName,
      uses: taskStep.id,
    };
    if (taskStep.inputs && Object.keys(taskStep.inputs).length > 0) {
      result.with = taskStep.inputs;
    }
    if (taskStep.env) {
      result.env = taskStep.env;
    }
    if (taskStep.continueOnError) {
      result['continue-on-error'] = taskStep.continueOnError;
    }
    if (taskStep.condition) {
      result.if = this.convertCondition(taskStep.condition);
    }
    return result;
  }

  getDockerBuildTask(options: DockerBuildOptions): PlatformScript {
    const tags = options.tags.map((t: string) => `-t ${options.repository}:${t}`).join(' ');
    const buildArgs = options.buildArgs
      ? Object.entries(options.buildArgs).map(([k, v]) => `--build-arg ${k}=${v}`).join(' ')
      : '';

    return {
      script: `docker build ${tags} ${buildArgs} -f ${options.dockerfile} ${options.context || '.'}`,
      displayName: 'Build Docker Image',
    };
  }

  getNodeSetupTask(version: string): PlatformTask {
    return {
      id: 'actions/setup-node@v4',
      displayName: 'Setup Node.js',
      inputs: {
        'node-version': version,
        cache: 'npm',
      },
    };
  }

  getDotNetSetupTask(version: string): PlatformTask {
    return {
      id: 'actions/setup-dotnet@v4',
      displayName: 'Setup .NET SDK',
      inputs: {
        'dotnet-version': version,
      },
    };
  }

  getPythonSetupTask(version: string): PlatformTask {
    return {
      id: 'actions/setup-python@v5',
      displayName: 'Setup Python',
      inputs: {
        'python-version': version,
        cache: 'pip',
      },
    };
  }

  getCacheTask(key: string, path: string, restoreKeys?: string[]): PlatformTask {
    return {
      id: 'actions/cache@v4',
      displayName: 'Cache dependencies',
      inputs: {
        key: key,
        path: path,
        'restore-keys': restoreKeys?.join('\n') || '',
      },
    };
  }

  getDockerPushTask(options: DockerPushOptions): PlatformStep[] {
    const steps: PlatformStep[] = [];

    // Login to registry
    if (options.registry) {
      steps.push({
        id: 'docker/login-action@v3',
        displayName: 'Login to Container Registry',
        inputs: {
          registry: options.registry,
          username: '${{ secrets.REGISTRY_USERNAME }}',
          password: '${{ secrets.REGISTRY_PASSWORD }}',
        },
      } as PlatformTask);
    }

    // Push each tag
    options.tags.forEach((tag: string) => {
      steps.push({
        script: `docker push ${options.repository}:${tag}`,
        displayName: `Push ${tag}`,
      } as PlatformScript);
    });

    return steps;
  }

  getSecretScanningStep(): PlatformScript {
    return {
      script: `docker run --rm -v "$PWD:/src" \\
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

    // SonarCloud for GitHub Actions (SonarQube's cloud offering)
    steps.push({
      id: 'SonarSource/sonarcloud-github-action@master',
      displayName: 'SonarCloud Scan',
      inputs: {
        args: this.getSonarCloudArgs(projectType, options),
      },
      env: {
        GITHUB_TOKEN: '${{ secrets.GITHUB_TOKEN }}',
        SONAR_TOKEN: '${{ secrets.SONAR_TOKEN }}',
      },
    } as PlatformTask);

    return steps;
  }

  private getSonarCloudArgs(projectType: string, options?: SastOptions): string {
    const args: string[] = [
      `-Dsonar.organization=${options?.organization || '${{ vars.SONAR_ORG }}'}`,
      `-Dsonar.projectKey=${options?.projectKey || '${{ github.repository_owner }}_${{ github.event.repository.name }}'}`,
    ];

    switch (projectType) {
      case 'dotnet':
        args.push('-Dsonar.cs.opencover.reportsPaths=**/coverage.opencover.xml');
        args.push('-Dsonar.cs.vstest.reportsPaths=**/*.trx');
        break;
      case 'node':
        args.push('-Dsonar.javascript.lcov.reportPaths=coverage/lcov.info');
        break;
      case 'python':
        args.push('-Dsonar.python.coverage.reportPaths=coverage.xml');
        break;
    }

    return args.join('\n');
  }

  getDependencyScanningStep(options?: DependencyScanOptions): PlatformTask {
    return {
      id: 'snyk/actions/node@master',
      displayName: 'Snyk Security Scan',
      inputs: {
        args: `--severity-threshold=${options?.severityThreshold || 'high'}`,
      },
      env: {
        SNYK_TOKEN: '${{ secrets.SNYK_TOKEN }}',
      },
      continueOnError: options?.failOnIssues === false,
    };
  }

  getContainerScanningStep(image: string): PlatformTask {
    return {
      id: 'aquasecurity/trivy-action@master',
      displayName: 'Trivy Container Scan',
      inputs: {
        'image-ref': image,
        format: 'table',
        'exit-code': '1',
        'ignore-unfixed': true,
        'vuln-type': 'os,library',
        severity: 'CRITICAL,HIGH',
      },
    };
  }

  getPublishArtifactTask(name: string, path: string): PlatformTask {
    return {
      id: 'actions/upload-artifact@v4',
      displayName: `Upload Artifact: ${name}`,
      inputs: {
        name: name,
        path: path,
      },
    };
  }

  getPublishTestResultsTask(format: string, files: string): PlatformTask {
    return {
      id: 'dorny/test-reporter@v1',
      displayName: 'Publish Test Results',
      inputs: {
        name: 'Test Results',
        path: files,
        reporter: this.getTestReporter(format),
      },
    };
  }

  private getTestReporter(format: string): string {
    switch (format.toLowerCase()) {
      case 'junit':
        return 'java-junit';
      case 'nunit':
        return 'dotnet-nunit';
      case 'xunit':
        return 'dotnet-xunit';
      case 'trx':
        return 'dotnet-trx';
      default:
        return 'java-junit';
    }
  }

  getPublishCodeCoverageTask(format: string, summaryFile: string): PlatformTask {
    return {
      id: 'codecov/codecov-action@v4',
      displayName: 'Upload Coverage to Codecov',
      inputs: {
        files: summaryFile,
        fail_ci_if_error: true,
      },
      env: {
        CODECOV_TOKEN: '${{ secrets.CODECOV_TOKEN }}',
      },
    };
  }
}
