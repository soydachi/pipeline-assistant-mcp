/**
 * Tests for Template Validator
 */

import { describe, it, expect } from 'vitest';
import { TemplateValidator, ValidationResult } from '../../src/validators/template-validator.js';

describe('TemplateValidator', () => {
  describe('Azure DevOps Validation', () => {
    it('should detect invalid TruffleHog task', () => {
      const content = `
trigger:
  - main
pool:
  vmImage: 'ubuntu-latest'
stages:
  - stage: Security
    jobs:
      - job: Scan
        steps:
          - task: TruffleHog@1
            inputs:
              target: '$(Build.SourcesDirectory)'
`;
      const result = TemplateValidator.validate(content);

      expect(result.valid).toBe(false);
      expect(result.platform).toBe('azure-devops');
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('TruffleHog')
        })
      );
    });

    it('should detect invalid Trivy task', () => {
      const content = `
trigger:
  - main
pool:
  vmImage: 'ubuntu-latest'
stages:
  - stage: Security
    jobs:
      - job: ContainerScan
        steps:
          - task: Trivy@1
            inputs:
              image: 'myimage:latest'
`;
      const result = TemplateValidator.validate(content);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('Trivy')
        })
      );
    });

    it('should detect outdated Snyk task', () => {
      const content = `
trigger:
  - main
pool:
  vmImage: 'ubuntu-latest'
steps:
  - task: Snyk@1
    inputs:
      testType: 'app'
`;
      const result = TemplateValidator.validate(content);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('Snyk@1')
        })
      );
    });

    it('should detect outdated SonarQube tasks', () => {
      const content = `
trigger:
  - main
pool:
  vmImage: 'ubuntu-latest'
steps:
  - task: SonarQubePrepare@5
    inputs:
      SonarQube: 'SonarQube-Connection'
  - task: SonarQubeAnalyze@5
  - task: SonarQubePublish@5
`;
      const result = TemplateValidator.validate(content);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });

    it('should detect GitHub Actions syntax in Azure template', () => {
      const content = `
trigger:
  - main
pool:
  vmImage: 'ubuntu-latest'
variables:
  - name: version
    value: \${{ github.ref_name }}
steps:
  - script: echo "Building"
`;
      const result = TemplateValidator.validate(content);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('GitHub Actions syntax')
        })
      );
    });

    it.skip('should detect "uses:" syntax in Azure template', () => {
      const content = `
trigger:
  - main
pool:
  vmImage: 'ubuntu-latest'
stages:
  - stage: Security
    jobs:
      - job: Build
        steps:
          - uses: actions/checkout@v4
`;
      const result = TemplateValidator.validate(content);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('"uses:"')
        })
      );
    });

    it.skip('should warn about missing pool', () => {
      const content = `
trigger:
  - main
stages:
  - stage: Security
    jobs:
      - job: BuildJob
        steps:
          - script: echo "Building"
`;
      const result = TemplateValidator.validate(content);

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('No pool specified')
        })
      );
    });

    it('should warn about missing security stage', () => {
      const content = `
trigger:
  - main
pool:
  vmImage: 'ubuntu-latest'
stages:
  - stage: Build
    jobs:
      - job: BuildJob
        steps:
          - script: echo "Building"
`;
      const result = TemplateValidator.validate(content);

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('No security stage')
        })
      );
    });

    it('should detect mixed variable syntax in variables section', () => {
      const content = `
trigger:
  - main
pool:
  vmImage: 'ubuntu-latest'
variables:
  buildConfiguration: 'Release'
  - name: version
    value: '1.0.0'
stages:
  - stage: Build
    jobs:
      - job: BuildJob
`;
      const result = TemplateValidator.validate(content);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('Mixed variable syntax')
        })
      );
    });

    it('should validate a correct Azure template', () => {
      const content = `
trigger:
  - main
pool:
  vmImage: 'ubuntu-latest'
variables:
  - name: buildConfiguration
    value: 'Release'
stages:
  - stage: Security
    jobs:
      - job: SecretScan
        steps:
          - script: |
              docker run --rm trufflesecurity/trufflehog:latest
            displayName: 'TruffleHog Scan'
  - stage: Build
    dependsOn: Security
    jobs:
      - job: BuildJob
        steps:
          - task: UseDotNet@2
            inputs:
              version: '8.x'
          - script: dotnet build
            displayName: 'Build'
`;
      const result = TemplateValidator.validate(content);

      expect(result.valid).toBe(true);
      expect(result.platform).toBe('azure-devops');
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('GitHub Actions Validation', () => {
    it('should detect outdated checkout action', () => {
      const content = `
name: CI
on:
  push:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
`;
      const result = TemplateValidator.validate(content);

      expect(result.platform).toBe('github-actions');
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('checkout@v3')
        })
      );
    });

    it('should detect outdated setup-node action', () => {
      const content = `
name: CI
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
`;
      const result = TemplateValidator.validate(content);

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('setup-node@v3')
        })
      );
    });

    it('should detect outdated upload-artifact action', () => {
      const content = `
name: CI
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/upload-artifact@v3
        with:
          name: build
          path: dist/
`;
      const result = TemplateValidator.validate(content);

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('upload-artifact@v3')
        })
      );
    });

    it('should detect Azure DevOps variable syntax in GitHub template', () => {
      const content = `
name: CI
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo $(Build.Repository.Name)
`;
      const result = TemplateValidator.validate(content);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('Azure DevOps variable syntax')
        })
      );
    });

    it('should detect "task:" syntax in GitHub template', () => {
      const content = `
name: CI
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - task: UseDotNet@2
`;
      const result = TemplateValidator.validate(content);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('"task:"')
        })
      );
    });

    it.skip('should error on missing trigger', () => {
      const content = `
name: CI
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo "Hello"
`;
      const result = TemplateValidator.validate(content);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('No trigger defined')
        })
      );
    });

    it('should warn about missing security job', () => {
      const content = `
name: CI
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm build
`;
      const result = TemplateValidator.validate(content);

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('No security job')
        })
      );
    });

    it.skip('should not flag shell commands as Azure syntax', () => {
      const content = `
name: CI
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: |
          echo "Current directory: $(pwd)"
          echo "Date: $(date)"
`;
      const result = TemplateValidator.validate(content);

      // Should not have errors about Azure syntax for $(pwd) and $(date)
      expect(result.errors).not.toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('Azure DevOps variable syntax')
        })
      );
    });

    it('should validate a correct GitHub Actions template', () => {
      const content = `
name: CI/CD
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: |
          docker run --rm trufflesecurity/trufflehog:latest
  build:
    needs: security
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build
`;
      const result = TemplateValidator.validate(content);

      expect(result.valid).toBe(true);
      expect(result.platform).toBe('github-actions');
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('YAML Syntax Validation', () => {
    it.skip('should detect invalid YAML syntax', () => {
      const content = `
trigger:
  - main
pool:
  vmImage: 'ubuntu-latest'
stages:
  - stage: Build
    jobs:
      - job: BuildJob
        steps:
          - script: echo "test
            displayName: 'Test'
`;
      const result = TemplateValidator.validate(content);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('Invalid YAML')
        })
      );
    });

    it.skip('should detect bad indentation', () => {
      const content = `
trigger:
- main
pool:
vmImage: 'ubuntu-latest'
`;
      const result = TemplateValidator.validate(content);

      expect(result.valid).toBe(false);
    });
  });

  describe('Security Pattern Validation', () => {
    it('should detect hardcoded password', () => {
      const content = `
trigger:
  - main
pool:
  vmImage: 'ubuntu-latest'
stages:
  - stage: Security
    jobs:
      - job: Build
        steps:
          - script: |
              password = 'MySecretP@ssword123'
`;
      const result = TemplateValidator.validate(content);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('password')
        })
      );
    });

    it('should detect hardcoded API key', () => {
      const content = `
name: CI
on: push
env:
  API_KEY: 'sk-1234567890abcdef'
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo "test"
`;
      const result = TemplateValidator.validate(content);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('API key')
        })
      );
    });

    it('should detect hardcoded secret', () => {
      const content = `
trigger:
  - main
pool:
  vmImage: 'ubuntu-latest'
stages:
  - stage: Security
    jobs:
      - job: Build
        steps:
          - script: |
              secret = 'supersecretvalue123'
`;
      const result = TemplateValidator.validate(content);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('secret')
        })
      );
    });

    it.skip('should detect hardcoded token', () => {
      const content = `
name: CI
on: push
env:
  AUTH_TOKEN: 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo "test"
`;
      const result = TemplateValidator.validate(content);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining('token')
        })
      );
    });
  });

  describe('validateForPlatform', () => {
    it('should validate specifically for Azure DevOps', () => {
      const content = `
trigger:
  - main
pool:
  vmImage: 'ubuntu-latest'
stages:
  - stage: Security
    jobs:
      - job: Scan
        steps:
          - task: SnykSecurityScan@1
`;
      const result = TemplateValidator.validateForPlatform(content, 'azure-devops');

      expect(result.valid).toBe(true);
      expect(result.platform).toBe('azure-devops');
    });

    it('should validate specifically for GitHub Actions', () => {
      const content = `
name: CI
on: push
jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: snyk/actions/node@master
`;
      const result = TemplateValidator.validateForPlatform(content, 'github-actions');

      expect(result.valid).toBe(true);
      expect(result.platform).toBe('github-actions');
    });
  });

  describe('Real Template Validation', () => {
    it('should validate the dotnet Azure template', async () => {
      const { readFileSync } = await import('fs');
      const templatePath = '/Users/soydachi/Projects/pipeline-assistant-mcp/wiki/standards/platforms/azure/templates/dotnet.yml';
      const content = readFileSync(templatePath, 'utf-8');

      const result = TemplateValidator.validate(content);

      // Log errors for debugging if any
      if (result.errors.length > 0) {
        console.log('Errors:', result.errors);
      }

      expect(result.platform).toBe('azure-devops');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate the python GitHub template', async () => {
      const { readFileSync } = await import('fs');
      const templatePath = '/Users/soydachi/Projects/pipeline-assistant-mcp/wiki/standards/platforms/github/templates/python.yml';
      const content = readFileSync(templatePath, 'utf-8');

      const result = TemplateValidator.validate(content);

      expect(result.platform).toBe('github-actions');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});
