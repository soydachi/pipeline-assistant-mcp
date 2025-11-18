/**
 * Template Manager
 *
 * Manages technology-specific pipeline templates
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { createLogger } from '../utils/logger.js';
import type { TechnologyTemplate } from './types.js';

const logger = createLogger('TemplateManager');

export class TemplateManager {
  private templates: Map<string, TechnologyTemplate> = new Map();
  private wikiPath: string;

  constructor(wikiPath: string) {
    this.wikiPath = wikiPath;
  }

  async loadTemplates(): Promise<void> {
    const templatesDir = path.join(this.wikiPath, 'templates');

    if (!fs.existsSync(templatesDir)) {
      fs.mkdirSync(templatesDir, { recursive: true });
      await this.createDefaultTemplates();
    }

    const files = fs.readdirSync(templatesDir);

    for (const file of files) {
      if (file.endsWith('.yml') || file.endsWith('.yaml')) {
        const content = fs.readFileSync(path.join(templatesDir, file), 'utf-8');
        const templateId = path.basename(file, path.extname(file));

        const metadata = this.extractTemplateMetadata(content);

        const template: TechnologyTemplate = {
          id: templateId,
          name: metadata.name || templateId,
          description: metadata.description || '',
          technology: metadata.technology || this.inferTechnology(templateId),
          features: metadata.features || [],
          template: content,
          metadata: {
            dockerized: content.includes('Docker'),
            multiStage: content.includes('stages:'),
            helmChart: content.includes('HelmDeploy'),
            healthChecks: content.includes('health') || content.includes('liveness'),
            monitoring: content.includes('monitoring') || content.includes('metrics'),
          },
        };

        this.templates.set(templateId, template);
      }
    }

    logger.info('Technology templates loaded', { count: this.templates.size });
  }

  private extractTemplateMetadata(content: string): any {
    const metadataMatch = content.match(/^#\s*metadata:\s*\n([\s\S]*?)^(?=[a-z])/m);

    if (metadataMatch) {
      try {
        return yaml.parse(metadataMatch[1]);
      } catch (error) {
        logger.warn('Failed to parse template metadata', {
          error: error instanceof Error ? error.message : error,
        });
      }
    }

    return {};
  }

  private inferTechnology(templateId: string): string {
    if (templateId.includes('dotnet') || templateId.includes('csharp')) return 'dotnet';
    if (templateId.includes('node') || templateId.includes('npm')) return 'node';
    if (templateId.includes('python') || templateId.includes('pip')) return 'python';
    if (templateId.includes('java') || templateId.includes('maven')) return 'java';
    if (templateId.includes('go') || templateId.includes('golang')) return 'go';

    return 'generic';
  }

  getTemplate(templateId: string): TechnologyTemplate | undefined {
    return this.templates.get(templateId);
  }

  getTemplatesByTechnology(technology: string): TechnologyTemplate[] {
    return Array.from(this.templates.values()).filter((t) => t.technology === technology);
  }

  getAllTemplates(): TechnologyTemplate[] {
    return Array.from(this.templates.values());
  }

  async createDefaultTemplates(): Promise<void> {
    const defaultTemplates = [
      { id: 'microservicio-dotnet', content: this.getDotnetTemplate() },
      { id: 'microservicio-node', content: this.getNodeTemplate() },
      { id: 'microservicio-python', content: this.getPythonTemplate() },
    ];

    const templatesDir = path.join(this.wikiPath, 'templates');

    for (const template of defaultTemplates) {
      const filePath = path.join(templatesDir, `${template.id}.yml`);
      fs.writeFileSync(filePath, template.content, 'utf-8');
    }
  }

  private getDotnetTemplate(): string {
    return `# metadata:
#   name: Microservicio .NET
#   description: Pipeline completo para microservicio .NET con Docker
#   technology: dotnet
#   features:
#     - Multi-stage pipeline
#     - Docker build
#     - Security scanning

trigger:
  branches:
    include:
      - main
      - develop

variables:
  - group: microservice-vars

stages:
  - stage: Validate
    jobs:
      - job: Validate
        steps:
          - task: DotNetCoreCLI@2
            inputs:
              command: restore

  - stage: Security
    dependsOn: Validate
    jobs:
      - job: SecurityScan
        steps:
          - task: TruffleHog@1
          - task: SnykSecurityScan@1

  - stage: Build
    dependsOn: Security
    jobs:
      - job: Build
        steps:
          - task: DotNetCoreCLI@2
            inputs:
              command: build
          - task: DotNetCoreCLI@2
            inputs:
              command: test
          - task: Docker@2
            inputs:
              command: buildAndPush

  - stage: Deploy
    dependsOn: Build
    condition: eq(variables['Build.SourceBranch'], 'refs/heads/main')
    jobs:
      - deployment: Deploy
        environment: 'production'
        strategy:
          runOnce:
            deploy:
              steps:
                - task: KubernetesManifest@0
`;
  }

  private getNodeTemplate(): string {
    return `# metadata:
#   name: Microservicio Node.js
#   description: Pipeline para microservicio Node.js
#   technology: node
#   features:
#     - NPM caching
#     - Security scanning
#     - Docker build

trigger:
  branches:
    include:
      - main
      - develop

pool:
  vmImage: 'ubuntu-latest'

variables:
  nodeVersion: '20.x'

stages:
  - stage: Validate
    jobs:
      - job: Validate
        steps:
          - task: NodeTool@0
            inputs:
              versionSpec: '\$(nodeVersion)'
          - task: Cache@2
            inputs:
              key: 'npm | "\$(Agent.OS)" | package-lock.json'
              path: \$(npm_config_cache)
          - script: npm ci

  - stage: Security
    dependsOn: Validate
    jobs:
      - job: SecurityScan
        steps:
          - task: TruffleHog@1
          - script: npm audit --audit-level=high

  - stage: Build
    dependsOn: Security
    jobs:
      - job: Build
        steps:
          - script: npm run build
          - script: npm test
          - task: Docker@2
            inputs:
              command: buildAndPush

  - stage: Deploy
    dependsOn: Build
    condition: eq(variables['Build.SourceBranch'], 'refs/heads/main')
    jobs:
      - deployment: Deploy
        environment: 'production'
`;
  }

  private getPythonTemplate(): string {
    return `# metadata:
#   name: Microservicio Python
#   description: Pipeline para microservicio Python
#   technology: python
#   features:
#     - Poetry
#     - Security scanning
#     - Docker build

trigger:
  branches:
    include:
      - main
      - develop

pool:
  vmImage: 'ubuntu-latest'

variables:
  pythonVersion: '3.11'

stages:
  - stage: Validate
    jobs:
      - job: Validate
        steps:
          - task: UsePythonVersion@0
            inputs:
              versionSpec: '\$(pythonVersion)'
          - script: |
              pip install poetry
              poetry install

  - stage: Security
    dependsOn: Validate
    jobs:
      - job: SecurityScan
        steps:
          - task: TruffleHog@1
          - script: |
              pip install safety
              safety check

  - stage: Build
    dependsOn: Security
    jobs:
      - job: Build
        steps:
          - script: poetry run pytest --cov
          - task: Docker@2
            inputs:
              command: buildAndPush

  - stage: Deploy
    dependsOn: Build
    condition: eq(variables['Build.SourceBranch'], 'refs/heads/main')
    jobs:
      - deployment: Deploy
        environment: 'production'
`;
  }
}
