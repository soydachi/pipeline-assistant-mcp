/**
 * Tests for GitHub Actions Generator
 */

import { describe, it, expect } from 'vitest';
import { GitHubActionsPlatform } from '../../src/platforms/github-actions.js';
import { PlatformPipeline } from '../../src/platforms/types.js';

describe('GitHubActionsPlatform', () => {
  const platform = new GitHubActionsPlatform();

  describe('generateYaml', () => {
    it('should generate valid GitHub Actions YAML', () => {
      const pipeline: PlatformPipeline = {
        name: 'CI/CD',
        trigger: {
          branches: { include: ['main', 'develop'] },
          paths: {
            exclude: ['*.md', 'docs/**']
          }
        },
        pool: {
          vmImage: 'ubuntu-latest'
        },
        variables: [
          { name: 'NODE_VERSION', value: '20' }
        ],
        stages: [
          {
            id: 'build',
            displayName: 'Build',
            jobs: [
              {
                id: 'build',
                displayName: 'Build Application',
                steps: [
                  {
                    id: 'actions/setup-node@v4',
                    displayName: 'Setup Node.js',
                    inputs: {
                      'node-version': '${{ env.NODE_VERSION }}'
                    }
                  },
                  {
                    script: 'npm ci',
                    displayName: 'Install dependencies'
                  },
                  {
                    script: 'npm run build',
                    displayName: 'Build'
                  }
                ]
              }
            ]
          }
        ]
      };

      const yaml = platform.generateYaml(pipeline);

      expect(yaml).toContain('name: CI/CD');
      expect(yaml).toContain('on:');
      expect(yaml).toContain('push:');
      expect(yaml).toContain('main');
      expect(yaml).toContain('env:');
      expect(yaml).toContain('NODE_VERSION');
      expect(yaml).toContain('jobs:');
      expect(yaml).toContain('runs-on: ubuntu-latest');
      expect(yaml).toContain('uses: actions/checkout@v4');
      expect(yaml).toContain('uses: actions/setup-node@v4');
    });

    it('should generate with pull_request trigger', () => {
      const pipeline: PlatformPipeline = {
        name: 'CI',
        trigger: {
          branches: { include: ['main'] },
          pr: { branches: ['main', 'develop'] }
        },
        pool: { vmImage: 'ubuntu-latest' },
        variables: [],
        stages: [
          {
            id: 'build',
            displayName: 'Build',
            jobs: [
              {
                id: 'build',
                displayName: 'Build',
                steps: [{ script: 'echo test', displayName: 'Test' }]
              }
            ]
          }
        ]
      };

      const yaml = platform.generateYaml(pipeline);

      expect(yaml).toContain('push:');
      expect(yaml).toContain('pull_request:');
    });

    it('should generate with job dependencies', () => {
      const pipeline: PlatformPipeline = {
        name: 'CI',
        trigger: { branches: { include: ['main'] } },
        pool: { vmImage: 'ubuntu-latest' },
        variables: [],
        jobs: [
          {
            id: 'build',
            displayName: 'Build',
            steps: [{ script: 'npm build', displayName: 'Build' }]
          },
          {
            id: 'test',
            displayName: 'Test',
            dependsOn: ['build'],
            steps: [{ script: 'npm test', displayName: 'Test' }]
          },
          {
            id: 'deploy',
            displayName: 'Deploy',
            dependsOn: ['test'],
            condition: "github.ref == 'refs/heads/main'",
            steps: [{ script: 'deploy.sh', displayName: 'Deploy' }]
          }
        ]
      };

      const yaml = platform.generateYaml(pipeline);

      expect(yaml).toContain('build:');
      expect(yaml).toContain('test:');
      expect(yaml).toContain('needs:');
      expect(yaml).toContain('deploy:');
      expect(yaml).toContain('if:');
    });

    it('should generate with environment', () => {
      const pipeline: PlatformPipeline = {
        name: 'Deploy',
        trigger: { branches: { include: ['main'] } },
        pool: { vmImage: 'ubuntu-latest' },
        variables: [],
        jobs: [
          {
            id: 'deploy-prod',
            displayName: 'Deploy to Production',
            steps: [
              { script: 'echo "Deploying to production"', displayName: 'Deploy' }
            ]
          }
        ]
      };

      const yaml = platform.generateYaml(pipeline);

      expect(yaml).toContain('jobs:');
      expect(yaml).toContain('deploy-prod:');
    });

    it('should generate with services', () => {
      const pipeline: PlatformPipeline = {
        name: 'Test',
        trigger: { branches: { include: ['main'] } },
        pool: { vmImage: 'ubuntu-latest' },
        variables: [],
        jobs: [
          {
            id: 'integration',
            displayName: 'Integration Tests',
            services: {
              postgres: {
                image: 'postgres:15',
                ports: ['5432:5432'],
                env: {
                  POSTGRES_PASSWORD: 'test'
                }
              }
            },
            steps: [
              { script: 'npm run test:integration', displayName: 'Run Integration Tests' }
            ]
          }
        ]
      };

      const yaml = platform.generateYaml(pipeline);

      expect(yaml).toContain('services:');
      expect(yaml).toContain('postgres:');
    });

    it('should generate with path-ignore', () => {
      const pipeline: PlatformPipeline = {
        name: 'CI',
        trigger: {
          branches: { include: ['main'] },
          paths: {
            exclude: ['*.md', 'docs/**', '.gitignore']
          }
        },
        pool: { vmImage: 'ubuntu-latest' },
        variables: [],
        stages: []
      };

      const yaml = platform.generateYaml(pipeline);

      expect(yaml).toContain('paths-ignore:');
      expect(yaml).toContain('*.md');
      expect(yaml).toContain('docs/**');
    });
  });

  describe('getSecretScanningStep', () => {
    it('should return TruffleHog docker script', () => {
      const step = platform.getSecretScanningStep();

      expect(step.script).toContain('trufflesecurity/trufflehog');
      expect(step.displayName).toContain('TruffleHog');
    });
  });

  describe('getSastStep', () => {
    it('should return SonarCloud action', () => {
      const steps = platform.getSastStep('nodejs');

      expect(steps.length).toBeGreaterThanOrEqual(1);
      const action = steps[0] as any;
      expect(action.id).toBe('SonarSource/sonarcloud-github-action@master');
      expect(action.env?.SONAR_TOKEN).toBe('${{ secrets.SONAR_TOKEN }}');
    });
  });

  describe('getNodeSetupTask', () => {
    it('should return setup-node@v4', () => {
      const task = platform.getNodeSetupTask('20');

      expect(task.id).toBe('actions/setup-node@v4');
      expect(task.inputs?.['node-version']).toBe('20');
    });

    it('should include cache configuration', () => {
      const task = platform.getNodeSetupTask('20');

      expect(task.inputs?.cache).toBe('npm');
    });
  });

  describe('getPythonSetupTask', () => {
    it('should return setup-python@v5', () => {
      const task = platform.getPythonSetupTask('3.11');

      expect(task.id).toBe('actions/setup-python@v5');
      expect(task.inputs?.['python-version']).toBe('3.11');
    });
  });

  describe('getDotNetSetupTask', () => {
    it('should return setup-dotnet@v4', () => {
      const task = platform.getDotNetSetupTask('8.x');

      expect(task.id).toBe('actions/setup-dotnet@v4');
      expect(task.inputs?.['dotnet-version']).toBe('8.x');
    });
  });

  describe('getDockerBuildTask', () => {
    it('should return docker build script', () => {
      const task = platform.getDockerBuildTask({
        repository: 'myimage',
        dockerfile: 'Dockerfile',
        tags: ['latest']
      });

      expect(task.script).toContain('docker build');
      expect(task.script).toContain('myimage');
    });
  });

  describe('getPublishArtifactTask', () => {
    it('should return upload-artifact@v4', () => {
      const task = platform.getPublishArtifactTask('dist', 'dist/');

      expect(task.id).toBe('actions/upload-artifact@v4');
      expect(task.inputs?.name).toBe('dist');
      expect(task.inputs?.path).toBe('dist/');
    });
  });

  describe('getContainerScanningStep', () => {
    it('should return aquasecurity/trivy-action', () => {
      const task = platform.getContainerScanningStep('myimage:latest');

      expect(task.id).toBe('aquasecurity/trivy-action@master');
      expect(task.inputs?.['image-ref']).toBe('myimage:latest');
      expect(task.inputs?.['exit-code']).toBe('1');
    });
  });

  describe('getPublishCodeCoverageTask', () => {
    it('should return codecov-action@v4', () => {
      const task = platform.getPublishCodeCoverageTask('xml', 'coverage.xml');

      expect(task.id).toBe('codecov/codecov-action@v4');
      expect(task.inputs?.files).toBe('coverage.xml');
    });
  });

  describe('getDependencyScanningStep', () => {
    it('should return Snyk action', () => {
      const task = platform.getDependencyScanningStep();

      expect(task.id).toContain('snyk/actions');
      expect(task.env?.SNYK_TOKEN).toBe('${{ secrets.SNYK_TOKEN }}');
    });
  });

  describe('getCacheTask', () => {
    it('should return cache@v4', () => {
      const task = platform.getCacheTask('npm-cache', '~/.npm');

      expect(task.id).toBe('actions/cache@v4');
      expect(task.inputs?.key).toBe('npm-cache');
      expect(task.inputs?.path).toBe('~/.npm');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty jobs', () => {
      const pipeline: PlatformPipeline = {
        name: 'Empty',
        trigger: { branches: { include: ['main'] } },
        pool: { vmImage: 'ubuntu-latest' },
        variables: [],
        stages: [
          {
            id: 'empty',
            displayName: 'Empty',
            jobs: []
          }
        ]
      };

      const yaml = platform.generateYaml(pipeline);

      expect(yaml).toContain('name: Empty');
      expect(yaml).toContain('jobs:');
    });

    it('should handle steps with only run command', () => {
      const pipeline: PlatformPipeline = {
        name: 'Simple',
        trigger: { branches: { include: ['main'] } },
        pool: { vmImage: 'ubuntu-latest' },
        variables: [],
        jobs: [
          {
            id: 'build',
            displayName: 'Build',
            steps: [
              { script: 'echo "Hello"', displayName: 'Echo' },
              { script: 'npm ci', displayName: 'Install' },
              { script: 'npm run build', displayName: 'Build' }
            ]
          }
        ]
      };

      const yaml = platform.generateYaml(pipeline);

      expect(yaml).toContain('run: echo "Hello"');
      expect(yaml).toContain('run: npm ci');
      expect(yaml).toContain('run: npm run build');
    });

    it('should handle working-directory', () => {
      const pipeline: PlatformPipeline = {
        name: 'Monorepo',
        trigger: { branches: { include: ['main'] } },
        pool: { vmImage: 'ubuntu-latest' },
        variables: [],
        jobs: [
          {
            id: 'frontend',
            displayName: 'Frontend',
            steps: [
              {
                script: 'npm ci',
                displayName: 'Install',
                workingDirectory: 'packages/frontend'
              }
            ]
          }
        ]
      };

      const yaml = platform.generateYaml(pipeline);

      expect(yaml).toContain('working-directory: packages/frontend');
    });

    it('should handle environment variables in steps', () => {
      const pipeline: PlatformPipeline = {
        name: 'Env Test',
        trigger: { branches: { include: ['main'] } },
        pool: { vmImage: 'ubuntu-latest' },
        variables: [],
        jobs: [
          {
            id: 'build',
            displayName: 'Build',
            steps: [
              {
                script: 'npm test',
                displayName: 'Test',
                env: {
                  CI: 'true',
                  NODE_ENV: 'test'
                }
              }
            ]
          }
        ]
      };

      const yaml = platform.generateYaml(pipeline);

      expect(yaml).toContain('env:');
    });

    it('should handle continue-on-error', () => {
      const pipeline: PlatformPipeline = {
        name: 'Continue Test',
        trigger: { branches: { include: ['main'] } },
        pool: { vmImage: 'ubuntu-latest' },
        variables: [],
        jobs: [
          {
            id: 'lint',
            displayName: 'Lint',
            steps: [
              {
                script: 'npm run lint',
                displayName: 'Lint',
                continueOnError: true
              }
            ]
          }
        ]
      };

      const yaml = platform.generateYaml(pipeline);

      expect(yaml).toContain('continue-on-error: true');
    });
  });
});
