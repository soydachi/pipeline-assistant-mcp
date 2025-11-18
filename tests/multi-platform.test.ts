import { describe, it, expect, beforeEach } from 'vitest';
import { WikiParser } from '../src/wiki-parser';
import { MultiPlatformGenerator } from '../src/multi-platform-generator';
import { PlatformFactory, AzureDevOpsPlatform, GitHubActionsPlatform } from '../src/platforms/index';

describe('Multi-Platform Support', () => {
  let wikiParser: WikiParser;
  let generator: MultiPlatformGenerator;

  beforeEach(async () => {
    wikiParser = new WikiParser('./wiki/standards');
    await wikiParser.loadStandards();
    generator = new MultiPlatformGenerator(wikiParser);
  });

  describe('PlatformFactory', () => {
    it('should return Azure DevOps adapter', () => {
      const adapter = PlatformFactory.getAdapter('azure-devops');
      expect(adapter).toBeInstanceOf(AzureDevOpsPlatform);
      expect(adapter.platform).toBe('azure-devops');
    });

    it('should return GitHub Actions adapter', () => {
      const adapter = PlatformFactory.getAdapter('github-actions');
      expect(adapter).toBeInstanceOf(GitHubActionsPlatform);
      expect(adapter.platform).toBe('github-actions');
    });

    it('should throw for unsupported platform', () => {
      expect(() => PlatformFactory.getAdapter('gitlab-ci' as any)).toThrow('coming soon');
    });

    it('should return supported platforms', () => {
      const platforms = PlatformFactory.getSupportedPlatforms();
      expect(platforms).toContain('azure-devops');
      expect(platforms).toContain('github-actions');
    });

    it('should validate platform support', () => {
      expect(PlatformFactory.isSupported('azure-devops')).toBe(true);
      expect(PlatformFactory.isSupported('github-actions')).toBe(true);
      expect(PlatformFactory.isSupported('invalid')).toBe(false);
    });
  });

  describe('Azure DevOps Pipeline Generation', () => {
    it('should generate valid Azure DevOps YAML', async () => {
      const standards = await wikiParser.getStandardsForProject('node');
      const pipeline = await generator.generatePipeline({
        projectType: 'node',
        services: [],
        environment: 'prod',
        standards,
        platform: 'azure-devops',
      });

      // Azure DevOps specific syntax
      expect(pipeline).toContain('Azure Pipelines');
      expect(pipeline).toContain('trigger:');
      expect(pipeline).toContain('vmImage:');
      expect(pipeline).toContain('task:');
      expect(pipeline).toContain('NodeTool@0');
    });

    it('should include security scanning steps', async () => {
      const standards = await wikiParser.getStandardsForProject('dotnet');
      const pipeline = await generator.generatePipeline({
        projectType: 'dotnet',
        services: [],
        environment: 'prod',
        standards,
        platform: 'azure-devops',
        enforceAllPolicies: true,
      });

      expect(pipeline).toContain('trufflesecurity/trufflehog');
      expect(pipeline).toContain('SonarQubePrepare@6');
      expect(pipeline).toContain('SnykSecurityScan@1');
    });

    it('should include Docker scanning when enabled', async () => {
      const standards = await wikiParser.getStandardsForProject('node');
      const pipeline = await generator.generatePipeline({
        projectType: 'node',
        services: [],
        environment: 'prod',
        standards,
        platform: 'azure-devops',
        usesDocker: true,
      });

      expect(pipeline).toContain('aquasec/trivy');
      expect(pipeline).toContain('Docker@2');
    });
  });

  describe('GitHub Actions Pipeline Generation', () => {
    it('should generate valid GitHub Actions YAML', async () => {
      const standards = await wikiParser.getStandardsForProject('node');
      const pipeline = await generator.generatePipeline({
        projectType: 'node',
        services: [],
        environment: 'prod',
        standards,
        platform: 'github-actions',
      });

      // GitHub Actions specific syntax
      expect(pipeline).toContain('GitHub Actions');
      expect(pipeline).toContain('runs-on:');
      expect(pipeline).toContain('uses:');
      expect(pipeline).toContain('actions/checkout@v4');
      expect(pipeline).toContain('actions/setup-node@v4');
    });

    it('should include security scanning steps', async () => {
      const standards = await wikiParser.getStandardsForProject('python');
      const pipeline = await generator.generatePipeline({
        projectType: 'python',
        services: [],
        environment: 'prod',
        standards,
        platform: 'github-actions',
        enforceAllPolicies: true,
      });

      expect(pipeline).toContain('trufflesecurity/trufflehog');
      expect(pipeline).toContain('sonarcloud-github-action');
      expect(pipeline).toContain('snyk/actions');
    });

    it('should include Docker scanning when enabled', async () => {
      const standards = await wikiParser.getStandardsForProject('dotnet');
      const pipeline = await generator.generatePipeline({
        projectType: 'dotnet',
        services: [],
        environment: 'prod',
        standards,
        platform: 'github-actions',
        usesDocker: true,
      });

      expect(pipeline).toContain('trivy-action');
      expect(pipeline).toContain('docker build');
    });

    it('should use correct Python setup action', async () => {
      const standards = await wikiParser.getStandardsForProject('python');
      const pipeline = await generator.generatePipeline({
        projectType: 'python',
        services: [],
        environment: 'staging',
        standards,
        platform: 'github-actions',
      });

      expect(pipeline).toContain('actions/setup-python@v5');
      expect(pipeline).toContain('pip install');
    });
  });

  describe('Cross-Platform Consistency', () => {
    it('should generate similar structure for both platforms', async () => {
      const standards = await wikiParser.getStandardsForProject('node');

      const azurePipeline = await generator.generatePipeline({
        projectType: 'node',
        services: [],
        environment: 'prod',
        standards,
        platform: 'azure-devops',
      });

      const githubPipeline = await generator.generatePipeline({
        projectType: 'node',
        services: [],
        environment: 'prod',
        standards,
        platform: 'github-actions',
      });

      // Both should have validation
      expect(azurePipeline).toContain('Validate');
      expect(githubPipeline).toContain('Validate');

      // Both should have security
      expect(azurePipeline).toContain('Security');
      expect(githubPipeline).toContain('Security');

      // Both should have build
      expect(azurePipeline).toContain('Build');
      expect(githubPipeline).toContain('Build');

      // Both should have test
      expect(azurePipeline).toContain('Test');
      expect(githubPipeline).toContain('Test');
    });

    it('should use TruffleHog for secret scanning on both platforms', async () => {
      const standards = await wikiParser.getStandardsForProject('dotnet');

      const azurePipeline = await generator.generatePipeline({
        projectType: 'dotnet',
        services: [],
        environment: 'prod',
        standards,
        platform: 'azure-devops',
      });

      const githubPipeline = await generator.generatePipeline({
        projectType: 'dotnet',
        services: [],
        environment: 'prod',
        standards,
        platform: 'github-actions',
      });

      // Both use TruffleHog Docker image
      expect(azurePipeline).toContain('trufflesecurity/trufflehog');
      expect(githubPipeline).toContain('trufflesecurity/trufflehog');
    });
  });

  describe('Platform Adapters', () => {
    it('Azure DevOps adapter should generate correct Node setup', () => {
      const adapter = new AzureDevOpsPlatform();
      const task = adapter.getNodeSetupTask('20.x');

      expect(task.id).toBe('NodeTool@0');
      expect(task.inputs?.versionSpec).toBe('20.x');
    });

    it('GitHub Actions adapter should generate correct Node setup', () => {
      const adapter = new GitHubActionsPlatform();
      const task = adapter.getNodeSetupTask('20.x');

      expect(task.id).toBe('actions/setup-node@v4');
      expect(task.inputs?.['node-version']).toBe('20.x');
    });

    it('Azure DevOps adapter should generate correct .NET setup', () => {
      const adapter = new AzureDevOpsPlatform();
      const task = adapter.getDotNetSetupTask('8.x');

      expect(task.id).toBe('UseDotNet@2');
      expect(task.inputs?.version).toBe('8.x');
    });

    it('GitHub Actions adapter should generate correct .NET setup', () => {
      const adapter = new GitHubActionsPlatform();
      const task = adapter.getDotNetSetupTask('8.x');

      expect(task.id).toBe('actions/setup-dotnet@v4');
      expect(task.inputs?.['dotnet-version']).toBe('8.x');
    });

    it('Both adapters should generate secret scanning step', () => {
      const azureAdapter = new AzureDevOpsPlatform();
      const githubAdapter = new GitHubActionsPlatform();

      const azureStep = azureAdapter.getSecretScanningStep();
      const githubStep = githubAdapter.getSecretScanningStep();

      expect('script' in azureStep).toBe(true);
      expect('script' in githubStep).toBe(true);

      if ('script' in azureStep) {
        expect(azureStep.script).toContain('trufflehog');
      }
      if ('script' in githubStep) {
        expect(githubStep.script).toContain('trufflehog');
      }
    });
  });
});
