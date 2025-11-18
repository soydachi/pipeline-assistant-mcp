/**
 * Tests for Azure DevOps Pipeline Generator
 */

import { describe, it, expect } from 'vitest';
import { AzureDevOpsPlatform } from '../../src/platforms/azure-devops.js';
import { PlatformPipeline } from '../../src/platforms/types.js';

describe('AzureDevOpsPlatform', () => {
  const platform = new AzureDevOpsPlatform();

  describe('generateYaml', () => {
    it('should generate valid Azure DevOps YAML', () => {
      const pipeline: PlatformPipeline = {
        name: 'Test Pipeline',
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
          { name: 'buildConfiguration', value: 'Release' }
        ],
        stages: [
          {
            id: 'Build',
            displayName: 'Build Stage',
            jobs: [
              {
                id: 'BuildJob',
                displayName: 'Build Application',
                steps: [
                  {
                    id: 'UseDotNet@2',
                    displayName: 'Install .NET',
                    inputs: {
                      version: '8.x'
                    }
                  },
                  {
                    script: 'dotnet build',
                    displayName: 'Build'
                  }
                ]
              }
            ]
          }
        ]
      };

      const yaml = platform.generateYaml(pipeline);

      expect(yaml).toContain('trigger:');
      expect(yaml).toContain('main');
      expect(yaml).toContain('develop');
      expect(yaml).toContain('pool:');
      expect(yaml).toContain('vmImage: ubuntu-latest');
      expect(yaml).toContain('variables:');
      expect(yaml).toContain('buildConfiguration');
      expect(yaml).toContain('stages:');
      expect(yaml).toContain('stage: Build');
      expect(yaml).toContain('task: UseDotNet@2');
    });

    it('should generate with variable groups', () => {
      const pipeline: PlatformPipeline = {
        name: 'Test Pipeline',
        trigger: { branches: { include: ['main'] } },
        pool: { vmImage: 'ubuntu-latest' },
        variables: [
          { name: 'version', value: '1.0.0' },
          { group: 'common-variables' },
          { group: 'security-secrets' }
        ],
        stages: []
      };

      const yaml = platform.generateYaml(pipeline);

      expect(yaml).toContain('group: common-variables');
      expect(yaml).toContain('group: security-secrets');
    });

    it('should generate multi-stage pipeline with dependencies', () => {
      const pipeline: PlatformPipeline = {
        name: 'Multi-Stage Pipeline',
        trigger: { branches: { include: ['main'] } },
        pool: { vmImage: 'ubuntu-latest' },
        variables: [],
        stages: [
          {
            id: 'Build',
            displayName: 'Build',
            jobs: [
              {
                id: 'BuildJob',
                displayName: 'Build',
                steps: [{ script: 'echo build', displayName: 'Build' }]
              }
            ]
          },
          {
            id: 'Test',
            displayName: 'Test',
            dependsOn: ['Build'],
            jobs: [
              {
                id: 'TestJob',
                displayName: 'Test',
                steps: [{ script: 'echo test', displayName: 'Test' }]
              }
            ]
          },
          {
            id: 'Deploy',
            displayName: 'Deploy',
            dependsOn: ['Test'],
            condition: "eq(variables['Build.SourceBranch'], 'refs/heads/main')",
            jobs: [
              {
                id: 'DeployJob',
                displayName: 'Deploy',
                steps: [{ script: 'echo deploy', displayName: 'Deploy' }]
              }
            ]
          }
        ]
      };

      const yaml = platform.generateYaml(pipeline);

      expect(yaml).toContain('stage: Build');
      expect(yaml).toContain('stage: Test');
      expect(yaml).toContain('dependsOn:');
      expect(yaml).toContain('Build');
      expect(yaml).toContain('stage: Deploy');
      expect(yaml).toContain('condition:');
    });

    it('should generate with path triggers', () => {
      const pipeline: PlatformPipeline = {
        name: 'Path Trigger Pipeline',
        trigger: {
          branches: { include: ['main'] },
          paths: {
            include: ['src/**'],
            exclude: ['docs/**', '*.md']
          }
        },
        pool: { vmImage: 'ubuntu-latest' },
        variables: [],
        stages: []
      };

      const yaml = platform.generateYaml(pipeline);

      expect(yaml).toContain('paths:');
      expect(yaml).toContain('include:');
      expect(yaml).toContain('src/**');
      expect(yaml).toContain('exclude:');
      expect(yaml).toContain('docs/**');
    });

    it('should handle PR triggers', () => {
      const pipeline: PlatformPipeline = {
        name: 'PR Pipeline',
        trigger: {
          branches: { include: ['main'] },
          pr: {
            branches: ['main', 'develop']
          }
        },
        pool: { vmImage: 'ubuntu-latest' },
        variables: [],
        stages: []
      };

      const yaml = platform.generateYaml(pipeline);

      expect(yaml).toContain('pr:');
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
    it('should return SonarQube@6 tasks', () => {
      const steps = platform.getSastStep('dotnet');

      expect(steps.length).toBeGreaterThanOrEqual(3);
      const taskIds = steps.map(s => (s as any).id).filter(Boolean);
      expect(taskIds).toContain('SonarQubePrepare@6');
      expect(taskIds).toContain('SonarQubeAnalyze@6');
      expect(taskIds).toContain('SonarQubePublish@6');
    });
  });

  describe('getDotNetSetupTask', () => {
    it('should return UseDotNet@2 task', () => {
      const task = platform.getDotNetSetupTask('8.x');

      expect(task.id).toBe('UseDotNet@2');
      expect(task.inputs?.version).toBe('8.x');
    });
  });

  describe('getNodeSetupTask', () => {
    it('should return NodeTool@0 task', () => {
      const task = platform.getNodeSetupTask('20.x');

      expect(task.id).toBe('NodeTool@0');
      expect(task.inputs?.versionSpec).toBe('20.x');
    });
  });

  describe('getPythonSetupTask', () => {
    it('should return UsePythonVersion@0 task', () => {
      const task = platform.getPythonSetupTask('3.11');

      expect(task.id).toBe('UsePythonVersion@0');
      expect(task.inputs?.versionSpec).toBe('3.11');
    });
  });

  describe('getDockerBuildTask', () => {
    it('should return Docker@2 task for build', () => {
      const task = platform.getDockerBuildTask({
        repository: 'myimage',
        dockerfile: 'Dockerfile',
        tags: ['latest']
      });

      expect(task.id).toBe('Docker@2');
      expect(task.inputs?.command).toBe('build');
      expect(task.inputs?.repository).toBe('myimage');
    });
  });

  describe('getPublishArtifactTask', () => {
    it('should return PublishBuildArtifacts@1 task', () => {
      const task = platform.getPublishArtifactTask('drop', '$(Build.ArtifactStagingDirectory)');

      expect(task.id).toBe('PublishBuildArtifacts@1');
      expect(task.inputs?.ArtifactName).toBe('drop');
    });
  });

  describe('getCacheTask', () => {
    it('should return Cache@2 task', () => {
      const task = platform.getCacheTask('npm | $(Agent.OS)', '~/.npm');

      expect(task.id).toBe('Cache@2');
      expect(task.inputs?.key).toContain('npm');
      expect(task.inputs?.path).toBe('~/.npm');
    });
  });

  describe('getDependencyScanningStep', () => {
    it('should return SnykSecurityScan@1 task', () => {
      const task = platform.getDependencyScanningStep();

      expect(task.id).toBe('SnykSecurityScan@1');
      expect(task.inputs?.testType).toBe('app');
    });
  });

  describe('getContainerScanningStep', () => {
    it('should return Trivy docker script', () => {
      const step = platform.getContainerScanningStep('myimage:latest');

      expect(step.script).toContain('aquasec/trivy');
      expect(step.script).toContain('myimage:latest');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty stages', () => {
      const pipeline: PlatformPipeline = {
        name: 'Empty Pipeline',
        trigger: { branches: { include: ['main'] } },
        pool: { vmImage: 'ubuntu-latest' },
        variables: [],
        stages: []
      };

      const yaml = platform.generateYaml(pipeline);

      expect(yaml).toContain('trigger:');
      expect(yaml).toContain('pool:');
    });

    it('should handle jobs without displayName', () => {
      const pipeline: PlatformPipeline = {
        name: 'Test Pipeline',
        trigger: { branches: { include: ['main'] } },
        pool: { vmImage: 'ubuntu-latest' },
        variables: [],
        stages: [
          {
            id: 'Build',
            displayName: 'Build',
            jobs: [
              {
                id: 'BuildJob',
                displayName: 'Build',
                steps: [{ script: 'echo test', displayName: 'Test' }]
              }
            ]
          }
        ]
      };

      const yaml = platform.generateYaml(pipeline);

      expect(yaml).toContain('job: BuildJob');
    });

    it('should handle task with no inputs', () => {
      const pipeline: PlatformPipeline = {
        name: 'Test Pipeline',
        trigger: { branches: { include: ['main'] } },
        pool: { vmImage: 'ubuntu-latest' },
        variables: [],
        stages: [
          {
            id: 'Build',
            displayName: 'Build',
            jobs: [
              {
                id: 'Job',
                displayName: 'Job',
                steps: [
                  {
                    id: 'SonarQubeAnalyze@6',
                    displayName: 'Analyze'
                  }
                ]
              }
            ]
          }
        ]
      };

      const yaml = platform.generateYaml(pipeline);

      expect(yaml).toContain('task: SonarQubeAnalyze@6');
      expect(yaml).toContain('displayName: Analyze');
    });
  });
});
