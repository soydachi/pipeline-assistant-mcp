import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import { WikiParser } from './wiki-parser.js';
import { createLogger } from './utils/logger.js';

const logger = createLogger('WikiManager');

export interface WikiStandard {
  id: string;
  type: 'mandatory' | 'recommended' | 'forbidden';
  description: string;
  example?: string;
  documentation?: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  tags?: string[];
  category?: string;
  version?: string;
  lastModified?: Date;
  author?: string;
}

export interface WikiRule {
  id: string;
  name: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  type: string;
  pattern?: RegExp;
  check: (content: string) => boolean;
  fix?: string;
  example?: string;
  documentation?: string;
  tags?: string[];
  category?: string;
}

export interface PolicyVersion {
  version: string;
  date: Date;
  author: string;
  changes: string[];
  justification: string;
  standards: WikiStandard[];
  checksum: string;
}

export interface TechnologyTemplate {
  id: string;
  name: string;
  description: string;
  technology: string;
  features: string[];
  template: string;
  metadata?: {
    dockerized?: boolean;
    multiStage?: boolean;
    helmChart?: boolean;
    healthChecks?: boolean;
    monitoring?: boolean;
  };
}

export interface AdoptionMetrics {
  period: {
    start: Date;
    end: Date;
  };
  pipelines: {
    analyzed: number;
    generated: number;
    fixed: number;
  };
  compliance: {
    average: number;
    trend: number;
    distribution: {
      excellent: number;  // >= 90%
      good: number;      // 80-89%
      fair: number;      // 60-79%
      poor: number;      // < 60%
    };
  };
  violations: {
    total: number;
    byType: Map<string, number>;
    bySeverity: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    topViolations: Array<{
      type: string;
      count: number;
      description: string;
    }>;
  };
  improvements: {
    monthOverMonth: number;
    resolvedIssues: number;
    newAdoptions: number;
  };
}

export class WikiManager extends EventEmitter {
  private standards: Map<string, WikiStandard> = new Map();
  private rules: Map<string, WikiRule> = new Map();
  private templates: Map<string, TechnologyTemplate> = new Map();
  private policyHistory: PolicyVersion[] = [];
  private metrics: AdoptionMetrics[] = [];
  private wikiPath: string;
  private watchInterval: NodeJS.Timeout | null = null;
  private lastChecksum: string = '';
  private wikiParser: WikiParser;

  constructor(wikiPath: string) {
    super();
    this.wikiPath = wikiPath;
    this.wikiParser = new WikiParser(wikiPath);
  }

  // ============= Feature 5.1: Parsear markdown de wiki a reglas =============
  
  async parseMarkdownToRules(content: string): Promise<WikiRule[]> {
    const rules: WikiRule[] = [];
    const sections = this.extractSections(content);
    
    // Procesar sección "## Obligatorio"
    if (sections['obligatorio']) {
      rules.push(...this.parseSection(sections['obligatorio'], 'mandatory'));
    }
    
    // Procesar sección "## Recomendado"
    if (sections['recomendado']) {
      rules.push(...this.parseSection(sections['recomendado'], 'recommended'));
    }
    
    // Procesar sección "## Prohibido"
    if (sections['prohibido']) {
      rules.push(...this.parseSection(sections['prohibido'], 'forbidden'));
    }
    
    return rules;
  }

  private extractSections(content: string): Record<string, string> {
    const sections: Record<string, string> = {};
    const sectionRegex = /^##\s+(.+)$/gm;
    const matches = Array.from(content.matchAll(sectionRegex));
    
    for (let i = 0; i < matches.length; i++) {
      const sectionName = matches[i][1].toLowerCase();
      const startIndex = matches[i].index! + matches[i][0].length;
      const endIndex = matches[i + 1]?.index || content.length;
      sections[sectionName] = content.substring(startIndex, endIndex).trim();
    }
    
    return sections;
  }

  private parseSection(content: string, type: string): WikiRule[] {
    const rules: WikiRule[] = [];
    const ruleBlocks = content.split(/^###\s+/m).filter(Boolean);
    
    for (const block of ruleBlocks) {
      const lines = block.split('\n');
      const ruleName = lines[0]?.trim();
      
      if (!ruleName) continue;
      
      const rule: WikiRule = {
        id: this.generateId(ruleName),
        name: ruleName,
        description: '',
        severity: this.determineSeverity(type, block),
        type: type,
        check: () => true, // Se implementará con el contenido
        tags: this.extractTags(block),
        category: this.extractCategory(block)
      };
      
      // Extraer descripción
      const descMatch = block.match(/Descripción:\s*(.+)/i);
      if (descMatch) {
        rule.description = descMatch[1].trim();
      }
      
      // Extraer ejemplo de código
      const codeMatch = block.match(/```(?:yaml|yml)\n([\s\S]*?)```/);
      if (codeMatch) {
        rule.example = codeMatch[1].trim();
      }
      
      // Extraer fix sugerido
      const fixMatch = block.match(/Fix:\s*(.+)/i);
      if (fixMatch) {
        rule.fix = fixMatch[1].trim();
      }
      
      // Crear función de verificación basada en patrones
      rule.check = this.createCheckFunction(rule);
      
      rules.push(rule);
    }
    
    return rules;
  }

  private generateId(name: string): string {
    return name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private determineSeverity(type: string, content: string): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
    // Buscar severidad explícita
    const severityMatch = content.match(/Severidad:\s*(CRITICAL|HIGH|MEDIUM|LOW)/i);
    if (severityMatch) {
      return severityMatch[1].toUpperCase() as any;
    }
    
    // Determinar por tipo
    if (type === 'mandatory') {
      return content.includes('seguridad') || content.includes('secreto') ? 'CRITICAL' : 'HIGH';
    } else if (type === 'forbidden') {
      return 'HIGH';
    } else {
      return 'MEDIUM';
    }
  }

  private extractTags(content: string): string[] {
    const tagMatch = content.match(/Tags?:\s*(.+)/i);
    if (tagMatch) {
      return tagMatch[1].split(',').map(t => t.trim());
    }
    return [];
  }

  private extractCategory(content: string): string {
    const categoryMatch = content.match(/Categor[íi]a:\s*(.+)/i);
    if (categoryMatch) {
      return categoryMatch[1].trim();
    }
    
    // Inferir categoría del contenido
    if (content.includes('seguridad') || content.includes('security')) return 'Security';
    if (content.includes('rendimiento') || content.includes('performance')) return 'Performance';
    if (content.includes('calidad') || content.includes('quality')) return 'Quality';
    
    return 'General';
  }

  private createCheckFunction(rule: WikiRule): (content: string) => boolean {
    return (content: string) => {
      // Implementar verificación basada en el tipo de regla
      if (rule.type === 'mandatory') {
        // Verificar presencia de elementos obligatorios
        if (rule.example) {
          const requiredElements = this.extractRequiredElements(rule.example);
          return requiredElements.every(elem => content.includes(elem));
        }
      } else if (rule.type === 'forbidden') {
        // Verificar ausencia de elementos prohibidos
        if (rule.example) {
          const forbiddenElements = this.extractForbiddenElements(rule.example);
          return !forbiddenElements.some(elem => content.includes(elem));
        }
      }
      
      return true;
    };
  }

  private extractRequiredElements(example: string): string[] {
    // Extraer elementos clave del ejemplo
    const elements: string[] = [];
    
    // Buscar tasks
    const taskMatches = example.matchAll(/task:\s*(\S+)/g);
    for (const match of taskMatches) {
      elements.push(match[1]);
    }
    
    // Buscar stages
    const stageMatches = example.matchAll(/stage:\s*(\S+)/g);
    for (const match of stageMatches) {
      elements.push(match[1]);
    }
    
    return elements;
  }

  private extractForbiddenElements(example: string): string[] {
    // Elementos que no deben aparecer
    return [
      'trigger: true',
      'continueOnError: true',
      'password:',
      'apikey:',
      'token:'
    ];
  }

  // ============= Feature 5.2: Actualización automática de estándares =============
  
  async startAutoUpdate(intervalMs: number = 300000): Promise<void> {
    logger.info('Starting wiki auto-update', { intervalMs });
    
    // Cargar inicial
    await this.loadAllStandards();
    
    // Configurar intervalo de verificación
    this.watchInterval = setInterval(async () => {
      await this.checkForUpdates();
    }, intervalMs);
    
    // Configurar file watcher para cambios inmediatos
    this.setupFileWatcher();
    
    this.emit('autoupdate:started', { intervalMs });
  }

  stopAutoUpdate(): void {
    if (this.watchInterval) {
      clearInterval(this.watchInterval);
      this.watchInterval = null;
      this.emit('autoupdate:stopped');
    }
  }

  private setupFileWatcher(): void {
    const watcher = fs.watch(this.wikiPath, { recursive: true }, async (eventType, filename) => {
      if (filename && (filename.endsWith('.md') || filename.endsWith('.yaml') || filename.endsWith('.yml'))) {
        logger.debug('Wiki file changed', { filename });
        
        // Debounce para evitar múltiples recargas
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(async () => {
          await this.checkForUpdates();
        }, 1000);
      }
    });
    
    this.on('shutdown', () => {
      watcher.close();
    });
  }
  
  private debounceTimer: any;

  private async checkForUpdates(): Promise<void> {
    const currentChecksum = await this.calculateChecksum();
    
    if (currentChecksum !== this.lastChecksum) {
      logger.info('Wiki changes detected, reloading standards');
      
      // Guardar versión anterior
      if (this.standards.size > 0) {
        await this.saveCurrentVersion('Wiki content updated');
      }
      
      // Recargar estándares
      const previousCount = this.standards.size;
      await this.loadAllStandards();
      const newCount = this.standards.size;
      
      // Actualizar checksum
      this.lastChecksum = currentChecksum;
      
      // Notificar a clientes conectados
      this.emit('standards:updated', {
        previousChecksum: this.lastChecksum,
        newChecksum: currentChecksum,
        previousCount,
        newCount,
        timestamp: new Date(),
        changes: this.detectChanges()
      });
      
      logger.info('Standards reloaded', { newCount, previousCount });
    }
  }

  private async calculateChecksum(): Promise<string> {
    const files = await this.getAllWikiFiles();
    const hash = crypto.createHash('sha256');
    
    for (const file of files.sort()) {
      if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf-8');
        hash.update(file);
        hash.update(content);
      }
    }
    
    return hash.digest('hex');
  }

  private async getAllWikiFiles(): Promise<string[]> {
    const files: string[] = [];
    
    const walk = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          walk(fullPath);
        } else if (entry.isFile() && (
          entry.name.endsWith('.md') || 
          entry.name.endsWith('.yaml') || 
          entry.name.endsWith('.yml')
        )) {
          files.push(fullPath);
        }
      }
    };
    
    walk(this.wikiPath);
    return files;
  }

  // ============= Feature 5.3: Templates específicos por tecnología =============
  
  async loadTechnologyTemplates(): Promise<void> {
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
        
        // Parsear metadata del template
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
            monitoring: content.includes('monitoring') || content.includes('metrics')
          }
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
          error: error instanceof Error ? error.message : error
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
    return Array.from(this.templates.values())
      .filter(t => t.technology === technology);
  }

  async createDefaultTemplates(): Promise<void> {
    const defaultTemplates = [
      {
        id: 'microservicio-dotnet',
        content: this.getMicroserviceDotnetTemplate()
      },
      {
        id: 'microservicio-node',
        content: this.getMicroserviceNodeTemplate()
      },
      {
        id: 'microservicio-python',
        content: this.getMicroservicePythonTemplate()
      }
    ];
    
    const templatesDir = path.join(this.wikiPath, 'templates');
    
    for (const template of defaultTemplates) {
      const filePath = path.join(templatesDir, `${template.id}.yml`);
      fs.writeFileSync(filePath, template.content, 'utf-8');
    }
  }

  private getMicroserviceDotnetTemplate(): string {
    return `# metadata:
#   name: Microservicio .NET
#   description: Pipeline completo para microservicio .NET con Docker y Helm
#   technology: dotnet
#   features:
#     - Multi-stage pipeline
#     - Docker build and push to ACR
#     - Helm deployment
#     - Health checks
#     - Security scanning

trigger:
  branches:
    include:
      - main
      - develop
  paths:
    exclude:
      - '*.md'
      - 'docs/*'

variables:
  - group: microservice-vars
  - name: dockerRegistry
    value: '$(ACR_NAME).azurecr.io'
  - name: dockerImageName
    value: '$(Build.Repository.Name)'
  - name: helmChartPath
    value: 'charts/$(Build.Repository.Name)'

stages:
  - stage: Validate
    displayName: 'Validación'
    jobs:
      - job: Validate
        steps:
          - checkout: self
          - task: DotNetCoreCLI@2
            displayName: 'Restore packages'
            inputs:
              command: restore

  - stage: Security
    displayName: 'Análisis de Seguridad'
    dependsOn: Validate
    jobs:
      - job: SecurityScan
        steps:
          - task: TruffleHog@1
            displayName: 'Escanear secretos'
          - task: SnykSecurityScan@1
            displayName: 'Escanear dependencias'
          - task: SonarQubePrepare@5
            displayName: 'Preparar SonarQube'

  - stage: Build
    displayName: 'Build y Test'
    dependsOn: Security
    jobs:
      - job: Build
        steps:
          - task: DotNetCoreCLI@2
            displayName: 'Build'
            inputs:
              command: build
              arguments: '--configuration Release'
          
          - task: DotNetCoreCLI@2
            displayName: 'Test'
            inputs:
              command: test
              arguments: '--collect:"XPlat Code Coverage"'
          
          - task: Docker@2
            displayName: 'Build Docker image'
            inputs:
              containerRegistry: '$(dockerRegistry)'
              repository: '$(dockerImageName)'
              command: build
              Dockerfile: '**/Dockerfile'
              tags: |
                $(Build.BuildId)
                latest

  - stage: Deploy_Dev
    displayName: 'Deploy to Dev'
    dependsOn: Build
    condition: and(succeeded(), eq(variables['Build.SourceBranch'], 'refs/heads/develop'))
    jobs:
      - deployment: DeployDev
        environment: 'dev'
        strategy:
          runOnce:
            deploy:
              steps:
                - task: HelmDeploy@0
                  displayName: 'Helm upgrade'
                  inputs:
                    connectionType: 'Kubernetes Service Connection'
                    kubernetesServiceConnection: 'k8s-dev'
                    namespace: 'microservices-dev'
                    command: upgrade
                    chartType: FilePath
                    chartPath: '$(helmChartPath)'
                    releaseName: '$(Build.Repository.Name)'
                    overrideValues: |
                      image.repository=$(dockerRegistry)/$(dockerImageName)
                      image.tag=$(Build.BuildId)
                      
                - task: KubernetesManifest@0
                  displayName: 'Check deployment health'
                  inputs:
                    action: 'get'
                    kubernetesServiceConnection: 'k8s-dev'
                    namespace: 'microservices-dev'
                    arguments: 'deployment/$(Build.Repository.Name) -o json'

  - stage: Deploy_Staging
    displayName: 'Deploy to Staging'
    dependsOn: Deploy_Dev
    condition: and(succeeded(), eq(variables['Build.SourceBranch'], 'refs/heads/main'))
    jobs:
      - deployment: DeployStaging
        environment: 'staging'
        strategy:
          runOnce:
            deploy:
              steps:
                - task: HelmDeploy@0
                  displayName: 'Helm upgrade'
                  inputs:
                    connectionType: 'Kubernetes Service Connection'
                    kubernetesServiceConnection: 'k8s-staging'
                    namespace: 'microservices-staging'
                    command: upgrade
                    chartType: FilePath
                    chartPath: '$(helmChartPath)'
                    releaseName: '$(Build.Repository.Name)'

  - stage: Deploy_Prod
    displayName: 'Deploy to Production'
    dependsOn: Deploy_Staging
    condition: and(succeeded(), eq(variables['Build.SourceBranch'], 'refs/heads/main'))
    jobs:
      - deployment: DeployProd
        environment: 'production'
        strategy:
          runOnce:
            deploy:
              steps:
                - task: ManualValidation@0
                  displayName: 'Aprobación manual'
                  
                - task: HelmDeploy@0
                  displayName: 'Helm upgrade'
                  inputs:
                    connectionType: 'Kubernetes Service Connection'
                    kubernetesServiceConnection: 'k8s-prod'
                    namespace: 'microservices-prod'
                    command: upgrade
                    chartType: FilePath
                    chartPath: '$(helmChartPath)'
                    releaseName: '$(Build.Repository.Name)'
`;
  }

  private getMicroserviceNodeTemplate(): string {
    return `# metadata:
#   name: Microservicio Node.js
#   description: Pipeline para microservicio Node.js con Docker y Kubernetes
#   technology: node
#   features:
#     - Multi-stage pipeline
#     - Docker containerization
#     - NPM caching
#     - Security scanning
#     - Health checks

trigger:
  branches:
    include:
      - main
      - develop

pool:
  vmImage: 'ubuntu-latest'

variables:
  - group: node-service-vars
  - name: nodeVersion
    value: '20.x'

stages:
  - stage: Validate
    jobs:
      - job: Validate
        steps:
          - task: NodeTool@0
            inputs:
              versionSpec: '$(nodeVersion)'
          
          - task: Cache@2
            inputs:
              key: 'npm | "$(Agent.OS)" | package-lock.json'
              path: $(npm_config_cache)
          
          - script: npm ci

  - stage: Security
    dependsOn: Validate
    jobs:
      - job: SecurityScan
        steps:
          - task: TruffleHog@1
          - script: npm audit --audit-level=high
          - task: SnykSecurityScan@1

  - stage: Build
    dependsOn: Security
    jobs:
      - job: Build
        steps:
          - script: npm run build
          - script: npm test
          - script: npm run test:coverage
          
          - task: Docker@2
            inputs:
              containerRegistry: 'ACR'
              repository: '$(Build.Repository.Name)'
              command: buildAndPush
              Dockerfile: '**/Dockerfile'
              tags: |
                $(Build.BuildId)
                latest

  - stage: Deploy
    dependsOn: Build
    condition: and(succeeded(), eq(variables['Build.SourceBranch'], 'refs/heads/main'))
    jobs:
      - deployment: Deploy
        environment: 'production'
        strategy:
          runOnce:
            deploy:
              steps:
                - task: KubernetesManifest@0
                  inputs:
                    action: deploy
                    manifests: |
                      k8s/deployment.yaml
                      k8s/service.yaml
`;
  }

  private getMicroservicePythonTemplate(): string {
    return `# metadata:
#   name: Microservicio Python
#   description: Pipeline para microservicio Python con FastAPI
#   technology: python
#   features:
#     - Poetry dependency management
#     - Docker multi-stage build
#     - Security scanning with Safety
#     - Unit and integration tests

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
              versionSpec: '$(pythonVersion)'
          
          - script: |
              python -m pip install --upgrade pip
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
          - task: SnykSecurityScan@1

  - stage: Build
    dependsOn: Security
    jobs:
      - job: Build
        steps:
          - script: |
              poetry run pytest tests/ --cov=app --cov-report=xml
          - script: |
              poetry run black --check .
              poetry run flake8 .
              poetry run mypy .
          
          - task: Docker@2
            inputs:
              containerRegistry: 'ACR'
              repository: '$(Build.Repository.Name)'
              command: buildAndPush
              Dockerfile: '**/Dockerfile'

  - stage: Deploy
    dependsOn: Build
    jobs:
      - deployment: Deploy
        environment: 'production'
        strategy:
          runOnce:
            deploy:
              steps:
                - task: KubernetesManifest@0
                  inputs:
                    action: deploy
`;
  }

  // ============= Feature 5.4: Versionado de políticas =============
  
  private async saveCurrentVersion(justification: string): Promise<void> {
    const version: PolicyVersion = {
      version: this.generateVersion(),
      date: new Date(),
      author: process.env.USER || process.env.USERNAME || 'system',
      changes: this.detectChanges(),
      justification,
      standards: Array.from(this.standards.values()),
      checksum: this.lastChecksum
    };
    
    this.policyHistory.push(version);
    
    // Mantener solo las últimas 50 versiones en memoria
    if (this.policyHistory.length > 50) {
      this.policyHistory = this.policyHistory.slice(-50);
    }
    
    // Guardar en archivo
    await this.savePolicyHistory();
    
    this.emit('version:saved', version);
  }

  private generateVersion(): string {
    const date = new Date();
    const major = date.getFullYear();
    const minor = date.getMonth() + 1;
    const patch = date.getDate();
    const build = `${date.getHours()}${date.getMinutes()}${date.getSeconds()}`;
    
    return `${major}.${minor}.${patch}.${build}`;
  }

  private detectChanges(): string[] {
    const changes: string[] = [];
    
    if (this.policyHistory.length === 0) {
      changes.push('Initial version');
      return changes;
    }
    
    const previousVersion = this.policyHistory[this.policyHistory.length - 1];
    const previousStandards = new Map(
      previousVersion.standards.map(s => [s.id, s])
    );
    
    // Detectar adiciones
    this.standards.forEach((standard, id) => {
      if (!previousStandards.has(id)) {
        changes.push(`Added: ${standard.id} - ${standard.description}`);
      }
    });
    
    // Detectar eliminaciones
    previousStandards.forEach((standard, id) => {
      if (!this.standards.has(id)) {
        changes.push(`Removed: ${standard.id} - ${standard.description}`);
      }
    });
    
    // Detectar modificaciones
    this.standards.forEach((standard, id) => {
      const previous = previousStandards.get(id);
      if (previous && this.hasChanged(previous, standard)) {
        changes.push(`Modified: ${standard.id} - ${this.getChangeSummary(previous, standard)}`);
      }
    });
    
    return changes;
  }

  private hasChanged(prev: WikiStandard, curr: WikiStandard): boolean {
    return JSON.stringify(prev) !== JSON.stringify(curr);
  }

  private getChangeSummary(prev: WikiStandard, curr: WikiStandard): string {
    const changes: string[] = [];
    
    if (prev.severity !== curr.severity) {
      changes.push(`severity: ${prev.severity} → ${curr.severity}`);
    }
    if (prev.type !== curr.type) {
      changes.push(`type: ${prev.type} → ${curr.type}`);
    }
    if (prev.description !== curr.description) {
      changes.push('description updated');
    }
    if (prev.example !== curr.example) {
      changes.push('example updated');
    }
    
    return changes.join(', ') || 'content updated';
  }

  private async savePolicyHistory(): Promise<void> {
    const historyFile = path.join(this.wikiPath, '.policy-history.json');
    
    try {
      await fs.promises.writeFile(
        historyFile,
        JSON.stringify(this.policyHistory, null, 2),
        'utf-8'
      );
    } catch (error) {
      logger.error('Error saving policy history', { error: error instanceof Error ? error.message : error });
    }
  }

  async loadPolicyHistory(): Promise<void> {
    const historyFile = path.join(this.wikiPath, '.policy-history.json');
    
    if (fs.existsSync(historyFile)) {
      try {
        const content = await fs.promises.readFile(historyFile, 'utf-8');
        this.policyHistory = JSON.parse(content);
        logger.info('Policy history loaded', { count: this.policyHistory.length });
      } catch (error) {
        logger.error('Error loading policy history', { error: error instanceof Error ? error.message : error });
      }
    }
  }

  getPolicyHistory(limit: number = 10): PolicyVersion[] {
    return this.policyHistory.slice(-limit);
  }

  getPolicyVersion(version: string): PolicyVersion | undefined {
    return this.policyHistory.find(v => v.version === version);
  }

  async rollbackToVersion(version: string): Promise<boolean> {
    const targetVersion = this.getPolicyVersion(version);
    
    if (!targetVersion) {
      logger.error('Version not found', { version });
      return false;
    }
    
    // Guardar versión actual antes de rollback
    await this.saveCurrentVersion(`Rollback to version ${version}`);
    
    // Restaurar standards de la versión target
    this.standards.clear();
    targetVersion.standards.forEach(std => {
      this.standards.set(std.id, std);
    });
    
    // Recargar rules basadas en los standards
    await this.rebuildRules();
    
    this.emit('version:rollback', {
      from: this.policyHistory[this.policyHistory.length - 1].version,
      to: version
    });
    
    return true;
  }

  private async rebuildRules(): Promise<void> {
    this.rules.clear();
    
    this.standards.forEach(standard => {
      const rule: WikiRule = {
        id: standard.id,
        name: standard.description,
        description: standard.description,
        severity: standard.severity || 'MEDIUM',
        type: standard.type,
        check: () => true,
        example: standard.example,
        documentation: standard.documentation,
        tags: standard.tags,
        category: standard.category
      };
      
      this.rules.set(rule.id, rule);
    });
  }

  // ============= Feature 5.5: Exportar métricas de adopción =============
  
  async recordMetrics(analysisResults: any[]): Promise<void> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Buscar o crear métricas del mes actual
    let currentMetrics = this.metrics.find(m => 
      m.period.start.getMonth() === now.getMonth() &&
      m.period.start.getFullYear() === now.getFullYear()
    );
    
    if (!currentMetrics) {
      currentMetrics = this.createEmptyMetrics(startOfMonth, now);
      this.metrics.push(currentMetrics);
    }
    
    // Actualizar métricas con los resultados del análisis
    analysisResults.forEach(result => {
      currentMetrics!.pipelines.analyzed++;
      
      // Actualizar compliance
      const scores = result.score || 0;
      currentMetrics!.compliance.average = 
        (currentMetrics!.compliance.average * (currentMetrics!.pipelines.analyzed - 1) + scores) / 
        currentMetrics!.pipelines.analyzed;
      
      // Categorizar por distribución
      if (scores >= 90) currentMetrics!.compliance.distribution.excellent++;
      else if (scores >= 80) currentMetrics!.compliance.distribution.good++;
      else if (scores >= 60) currentMetrics!.compliance.distribution.fair++;
      else currentMetrics!.compliance.distribution.poor++;
      
      // Contar violaciones
      if (result.violations) {
        result.violations.forEach((v: any) => {
          currentMetrics!.violations.total++;
          
          // Por tipo
          const count = currentMetrics!.violations.byType.get(v.type) || 0;
          currentMetrics!.violations.byType.set(v.type, count + 1);
          
          // Por severidad
          switch (v.severity) {
            case 'CRITICAL':
              currentMetrics!.violations.bySeverity.critical++;
              break;
            case 'HIGH':
              currentMetrics!.violations.bySeverity.high++;
              break;
            case 'MEDIUM':
              currentMetrics!.violations.bySeverity.medium++;
              break;
            case 'LOW':
              currentMetrics!.violations.bySeverity.low++;
              break;
          }
        });
      }
    });
    
    // Actualizar top violaciones
    this.updateTopViolations(currentMetrics);
    
    // Calcular tendencias
    this.calculateTrends(currentMetrics);
    
    // Guardar métricas
    await this.saveMetrics();
  }

  private createEmptyMetrics(start: Date, end: Date): AdoptionMetrics {
    return {
      period: { start, end },
      pipelines: {
        analyzed: 0,
        generated: 0,
        fixed: 0
      },
      compliance: {
        average: 0,
        trend: 0,
        distribution: {
          excellent: 0,
          good: 0,
          fair: 0,
          poor: 0
        }
      },
      violations: {
        total: 0,
        byType: new Map(),
        bySeverity: {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0
        },
        topViolations: []
      },
      improvements: {
        monthOverMonth: 0,
        resolvedIssues: 0,
        newAdoptions: 0
      }
    };
  }

  private updateTopViolations(metrics: AdoptionMetrics): void {
    const violations = Array.from(metrics.violations.byType.entries())
      .map(([type, count]) => ({
        type,
        count,
        description: this.getViolationDescription(type)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    metrics.violations.topViolations = violations;
  }

  private getViolationDescription(type: string): string {
    const descriptions: Record<string, string> = {
      'MISSING_STAGE': 'Stage obligatorio faltante',
      'HARDCODED_SECRET': 'Secreto hardcodeado en código',
      'NO_SECURITY_SCAN': 'Sin análisis de seguridad',
      'UNSAFE_TRIGGER': 'Configuración de trigger insegura',
      'MISSING_CACHE': 'No usa caché para dependencias',
      'NO_TESTS': 'Sin ejecución de tests',
      'SECURITY_BYPASS': 'Bypass de verificación de seguridad'
    };
    
    return descriptions[type] || type;
  }

  private calculateTrends(currentMetrics: AdoptionMetrics): void {
    if (this.metrics.length < 2) return;
    
    const previousMetrics = this.metrics[this.metrics.length - 2];
    
    // Tendencia de compliance
    currentMetrics.compliance.trend = 
      currentMetrics.compliance.average - previousMetrics.compliance.average;
    
    // Mejoras mes a mes
    currentMetrics.improvements.monthOverMonth = 
      ((currentMetrics.compliance.average - previousMetrics.compliance.average) / 
       previousMetrics.compliance.average) * 100;
    
    // Issues resueltos (aproximación)
    const prevTotal = previousMetrics.violations.total;
    const currTotal = currentMetrics.violations.total;
    const analyzed = currentMetrics.pipelines.analyzed;
    
    if (analyzed > 0) {
      const avgViolationsPerPipeline = currTotal / analyzed;
      const expectedViolations = avgViolationsPerPipeline * previousMetrics.pipelines.analyzed;
      currentMetrics.improvements.resolvedIssues = Math.max(0, prevTotal - expectedViolations);
    }
  }

  private async saveMetrics(): Promise<void> {
    const metricsFile = path.join(this.wikiPath, '.adoption-metrics.json');
    
    try {
      // Convertir Maps a objetos para serialización
      const metricsToSave = this.metrics.map(m => ({
        ...m,
        violations: {
          ...m.violations,
          byType: Array.from(m.violations.byType.entries())
        }
      }));
      
      await fs.promises.writeFile(
        metricsFile,
        JSON.stringify(metricsToSave, null, 2),
        'utf-8'
      );
    } catch (error) {
      logger.error('Error saving metrics', { error: error instanceof Error ? error.message : error });
    }
  }

  async loadMetrics(): Promise<void> {
    const metricsFile = path.join(this.wikiPath, '.adoption-metrics.json');
    
    if (fs.existsSync(metricsFile)) {
      try {
        const content = await fs.promises.readFile(metricsFile, 'utf-8');
        const loaded = JSON.parse(content);
        
        // Reconstruir Maps desde arrays
        this.metrics = loaded.map((m: any) => ({
          ...m,
          period: {
            start: new Date(m.period.start),
            end: new Date(m.period.end)
          },
          violations: {
            ...m.violations,
            byType: new Map(m.violations.byType)
          }
        }));
        
        logger.info('Metrics loaded', { periods: this.metrics.length });
      } catch (error) {
        logger.error('Error loading metrics', { error: error instanceof Error ? error.message : error });
      }
    }
  }

  async generateMetricsReport(format: 'json' | 'html' | 'markdown' = 'markdown'): Promise<string> {
    const latestMetrics = this.metrics[this.metrics.length - 1];
    
    if (!latestMetrics) {
      return 'No metrics available';
    }
    
    switch (format) {
      case 'json':
        return JSON.stringify(latestMetrics, null, 2);
        
      case 'html':
        return this.generateHtmlReport(latestMetrics);
        
      case 'markdown':
      default:
        return this.generateMarkdownReport(latestMetrics);
    }
  }

  private generateMarkdownReport(metrics: AdoptionMetrics): string {
    const period = `${metrics.period.start.toLocaleDateString()} - ${metrics.period.end.toLocaleDateString()}`;
    
    let report = `# 📊 Métricas de Adopción - Pipeline Assistant\n\n`;
    report += `**Período**: ${period}\n\n`;
    
    report += `## 📈 Resumen Ejecutivo\n\n`;
    report += `| Métrica | Valor |\n`;
    report += `|---------|-------|\n`;
    report += `| Pipelines Analizados | ${metrics.pipelines.analyzed} |\n`;
    report += `| Compliance Promedio | ${metrics.compliance.average.toFixed(1)}% |\n`;
    report += `| Total de Violaciones | ${metrics.violations.total} |\n`;
    report += `| Tendencia vs Mes Anterior | ${metrics.compliance.trend >= 0 ? '📈' : '📉'} ${metrics.compliance.trend.toFixed(1)}% |\n\n`;
    
    report += `## 🎯 Distribución de Compliance\n\n`;
    report += `| Categoría | Cantidad | Porcentaje |\n`;
    report += `|-----------|----------|------------|\n`;
    
    const total = metrics.pipelines.analyzed || 1;
    report += `| Excelente (≥90%) | ${metrics.compliance.distribution.excellent} | ${((metrics.compliance.distribution.excellent / total) * 100).toFixed(1)}% |\n`;
    report += `| Bueno (80-89%) | ${metrics.compliance.distribution.good} | ${((metrics.compliance.distribution.good / total) * 100).toFixed(1)}% |\n`;
    report += `| Regular (60-79%) | ${metrics.compliance.distribution.fair} | ${((metrics.compliance.distribution.fair / total) * 100).toFixed(1)}% |\n`;
    report += `| Pobre (<60%) | ${metrics.compliance.distribution.poor} | ${((metrics.compliance.distribution.poor / total) * 100).toFixed(1)}% |\n\n`;
    
    report += `## ❌ Top 10 Violaciones Más Comunes\n\n`;
    report += `| # | Tipo | Ocurrencias | Descripción |\n`;
    report += `|---|------|-------------|-------------|\n`;
    
    metrics.violations.topViolations.forEach((v, i) => {
      report += `| ${i + 1} | ${v.type} | ${v.count} | ${v.description} |\n`;
    });
    
    report += `\n## 📊 Violaciones por Severidad\n\n`;
    report += `| Severidad | Cantidad |\n`;
    report += `|-----------|----------|\n`;
    report += `| 🔴 Crítica | ${metrics.violations.bySeverity.critical} |\n`;
    report += `| 🟠 Alta | ${metrics.violations.bySeverity.high} |\n`;
    report += `| 🟡 Media | ${metrics.violations.bySeverity.medium} |\n`;
    report += `| 🟢 Baja | ${metrics.violations.bySeverity.low} |\n\n`;
    
    report += `## 📈 Mejoras\n\n`;
    report += `- **Mejora mes a mes**: ${metrics.improvements.monthOverMonth.toFixed(1)}%\n`;
    report += `- **Issues resueltos**: ${metrics.improvements.resolvedIssues}\n`;
    report += `- **Nuevas adopciones**: ${metrics.improvements.newAdoptions}\n\n`;
    
    report += `---\n`;
    report += `*Reporte generado el ${new Date().toLocaleString()}*\n`;
    
    return report;
  }

  private generateHtmlReport(metrics: AdoptionMetrics): string {
    // Implementación HTML del reporte
    return `<!DOCTYPE html>
<html>
<head>
  <title>Métricas de Adopción - Pipeline Assistant</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    h1 { color: #007ACC; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
    th { background-color: #007ACC; color: white; }
    .metric-card { background: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 8px; }
    .trend-up { color: green; }
    .trend-down { color: red; }
  </style>
</head>
<body>
  <h1>📊 Métricas de Adopción - Pipeline Assistant</h1>
  
  <div class="metric-card">
    <h2>Resumen del Período</h2>
    <p><strong>Pipelines Analizados:</strong> ${metrics.pipelines.analyzed}</p>
    <p><strong>Compliance Promedio:</strong> ${metrics.compliance.average.toFixed(1)}%</p>
    <p><strong>Total de Violaciones:</strong> ${metrics.violations.total}</p>
  </div>
  
  <!-- Más contenido HTML... -->
</body>
</html>`;
  }

  getMetrics(limit: number = 12): AdoptionMetrics[] {
    return this.metrics.slice(-limit);
  }

  getCurrentMonthMetrics(): AdoptionMetrics | undefined {
    const now = new Date();
    return this.metrics.find(m => 
      m.period.start.getMonth() === now.getMonth() &&
      m.period.start.getFullYear() === now.getFullYear()
    );
  }

  // ============= Métodos principales de carga =============
  
  async loadAllStandards(): Promise<void> {
    logger.info('Loading all standards from wiki');
    
    // Cargar historial de políticas
    await this.loadPolicyHistory();
    
    // Cargar métricas
    await this.loadMetrics();
    
    // Cargar estándares desde markdown
    await this.loadMarkdownStandards();
    
    // Cargar templates de tecnología
    await this.loadTechnologyTemplates();
    
    // Calcular checksum inicial
    this.lastChecksum = await this.calculateChecksum();
    
    logger.info('Wiki loaded', {
      standards: this.standards.size,
      rules: this.rules.size,
      templates: this.templates.size
    });
    
    this.emit('wiki:loaded', {
      standards: this.standards.size,
      rules: this.rules.size,
      templates: this.templates.size,
      checksum: this.lastChecksum
    });
  }

  private async loadMarkdownStandards(): Promise<void> {
    // v2.0: Load policies from security/policies.yaml
    const policiesFile = path.join(this.wikiPath, 'security', 'policies.yaml');

    if (fs.existsSync(policiesFile)) {
      const content = await fs.promises.readFile(policiesFile, 'utf-8');
      const parsed = yaml.parse(content) as any;

      if (parsed?.policies && Array.isArray(parsed.policies)) {
        parsed.policies.forEach((policy: any) => {
          const standard: WikiStandard = {
            id: policy.id,
            type: policy.level === 'mandatory' ? 'mandatory' : 'recommended',
            description: policy.description || '',
            example: policy.azure?.script || policy.github?.script || '',
            documentation: policy.rationale || '',
            severity: policy.severity || 'MEDIUM',
            tags: [policy.category, policy.stage].filter(Boolean),
            category: policy.category || 'security',
            version: this.generateVersion(),
            lastModified: new Date(),
            author: 'wiki'
          };

          this.standards.set(standard.id, standard);

          // Also create a rule for compatibility
          const rule: WikiRule = {
            id: policy.id,
            name: policy.name || policy.id,
            type: policy.level === 'mandatory' ? 'mandatory' : 'recommended',
            description: policy.description || '',
            example: standard.example,
            severity: policy.severity || 'MEDIUM',
            tags: standard.tags,
            category: policy.category || 'security',
            documentation: standard.documentation,
            check: () => true // Placeholder check function
          };

          this.rules.set(rule.id, rule);
        });
      }
    }

    // Also try to load from README.md for backward compatibility
    const standardsFile = path.join(this.wikiPath, 'README.md');

    if (fs.existsSync(standardsFile)) {
      const content = await fs.promises.readFile(standardsFile, 'utf-8');
      const rules = await this.parseMarkdownToRules(content);

      rules.forEach(rule => {
        // Only add if not already loaded from YAML
        if (!this.standards.has(rule.id)) {
          const standard: WikiStandard = {
            id: rule.id,
            type: rule.type as any,
            description: rule.description,
            example: rule.example,
            documentation: rule.documentation,
            severity: rule.severity,
            tags: rule.tags,
            category: rule.category,
            version: this.generateVersion(),
            lastModified: new Date(),
            author: 'wiki'
          };

          this.standards.set(standard.id, standard);
          this.rules.set(rule.id, rule);
        }
      });
    }
  }

  // Getters públicos
  getStandards(): WikiStandard[] {
    return Array.from(this.standards.values());
  }

  getRules(): WikiRule[] {
    return Array.from(this.rules.values());
  }

  getTemplates(): TechnologyTemplate[] {
    return Array.from(this.templates.values());
  }

  getStandard(id: string): WikiStandard | undefined {
    return this.standards.get(id);
  }

  getRule(id: string): WikiRule | undefined {
    return this.rules.get(id);
  }
}
