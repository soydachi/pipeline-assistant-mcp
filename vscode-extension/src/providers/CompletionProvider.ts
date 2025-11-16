import * as vscode from 'vscode';
import { MCPClient } from '../mcp/MCPClient';

export class CompletionProvider implements vscode.CompletionItemProvider {
    private mcpClient: MCPClient;
    private mandatoryTasks: Map<string, vscode.CompletionItem> = new Map();
    private pipelineSnippets: Map<string, vscode.CompletionItem> = new Map();

    constructor(mcpClient: MCPClient) {
        this.mcpClient = mcpClient;
        this.initializeCompletions();
    }

    private initializeCompletions() {
        // Tareas obligatorias de seguridad (aparecen primero)
        this.createMandatoryTask('TruffleHog', 
            'TruffleHog@1 - Escaneo de secretos [OBLIGATORIO]',
            `- task: TruffleHog@1
  displayName: '🔐 Escanear secretos hardcodeados'
  inputs:
    path: '\$(Build.SourcesDirectory)'
    failOnSecrets: true
    depth: 50
    maxSecrets: 0
  continueOnError: false`,
            '🔴 Política SEC-001: Obligatorio para todos los pipelines'
        );

        this.createMandatoryTask('SonarQube',
            'SonarQubePrepare@5 - Análisis SAST [OBLIGATORIO]',
            `- task: SonarQubePrepare@5
  displayName: '📊 Preparar análisis SonarQube'
  inputs:
    SonarQube: 'SonarQubeServiceConnection'
    scannerMode: 'CLI'
    configMode: 'manual'
    cliProjectKey: '\$(Build.Repository.Name)'
    cliProjectName: '\$(Build.Repository.Name)'`,
            '🔴 Política SEC-002: Análisis estático obligatorio'
        );

        this.createMandatoryTask('Snyk',
            'SnykSecurityScan@1 - Escaneo dependencias [OBLIGATORIO]',
            `- task: SnykSecurityScan@1
  displayName: '📦 Escanear vulnerabilidades en dependencias'
  inputs:
    serviceConnectionEndpoint: 'SnykConnection'
    testType: 'app'
    severityThreshold: 'high'
    failOnIssues: true
    monitorOnBuild: true`,
            '🔴 Política SEC-003: Verificación de dependencias obligatoria'
        );

        // Snippets para stages completos
        this.createStageSnippet('Security',
            'stage:security - Stage de seguridad completo',
            `- stage: Security
  displayName: 'Análisis de Seguridad'
  dependsOn: Validate
  condition: succeeded()
  jobs:
    - job: SecurityScan
      displayName: 'Escaneo completo de seguridad'
      pool:
        vmImage: 'ubuntu-latest'
      steps:
        - task: TruffleHog@1
          displayName: '🔐 Escanear secretos'
          inputs:
            path: '\$(Build.SourcesDirectory)'
            failOnSecrets: true
        
        - task: SonarQubePrepare@5
          displayName: '📊 Preparar SonarQube'
          inputs:
            SonarQube: 'SonarQubeServiceConnection'
            scannerMode: 'CLI'
        
        - task: SonarQubeAnalyze@5
          displayName: '📊 Ejecutar análisis'
        
        - task: SonarQubePublish@5
          displayName: '📊 Publicar resultados'
          inputs:
            pollingTimeoutSec: '300'
        
        - task: SnykSecurityScan@1
          displayName: '📦 Escanear dependencias'
          inputs:
            testType: 'app'
            failOnIssues: true`
        );

        this.createStageSnippet('Build',
            'stage:build - Stage de build estándar',
            `- stage: Build
  displayName: 'Compilación'
  dependsOn: Security
  jobs:
    - job: BuildJob
      displayName: 'Build \${1:projectType}'
      pool:
        vmImage: 'ubuntu-latest'
      steps:
        \${2:# Build steps here}`
        );

        // Snippets para configuraciones comunes
        this.createConfigSnippet('cache:npm',
            'Cache para NPM',
            `- task: Cache@2
  displayName: '📦 Cache NPM packages'
  inputs:
    key: 'npm | "\$(Agent.OS)" | package-lock.json'
    restoreKeys: |
      npm | "\$(Agent.OS)"
    path: \$(npm_config_cache)`
        );

        this.createConfigSnippet('cache:nuget',
            'Cache para NuGet',
            `- task: Cache@2
  displayName: '📦 Cache NuGet packages'
  inputs:
    key: 'nuget | "\$(Agent.OS)" | **/packages.lock.json'
    restoreKeys: |
      nuget | "\$(Agent.OS)"
    path: \$(NUGET_PACKAGES)`
        );

        this.createConfigSnippet('keyvault',
            'Azure Key Vault - Obtener secretos',
            `- task: AzureKeyVault@2
  displayName: '🔐 Obtener secretos de Key Vault'
  inputs:
    azureSubscription: '\${1:ServiceConnection}'
    KeyVaultName: '\${2:my-keyvault}'
    SecretsFilter: '*'
    RunAsPreJob: false`
        );

        // Variables seguras
        this.createVariableSnippet('var:secure',
            'Variable segura desde Key Vault',
            `- name: \${1:variableName}
  value: '\$(\${2:SECRET_NAME})' # Desde Key Vault o variable group`
        );

        this.createVariableSnippet('var:group',
            'Variable group',
            `- group: \${1:my-variable-group}`
        );

        // Triggers seguros
        this.createTriggerSnippet('trigger:safe',
            'Trigger seguro con branches específicos',
            `trigger:
  branches:
    include:
      - main
      - develop
    exclude:
      - feature/experimental/*
  paths:
    include:
      - src/*
      - tests/*
    exclude:
      - '*.md'
      - 'docs/*'`
        );

        // Templates de servicios Azure
        this.createServiceSnippet('service:sql',
            'Configuración Azure SQL',
            `# Azure SQL Configuration
- name: sqlServerName
  value: 'sql-\$(Build.Repository.Name)-\${1:env}'
- name: sqlDatabaseName
  value: 'db-\$(Build.Repository.Name)'
- name: sqlConnectionString
  value: '\$(SQL_CONNECTION_STRING)' # Desde Key Vault`
        );

        this.createServiceSnippet('service:redis',
            'Configuración Redis Cache',
            `# Redis Configuration
- name: redisName
  value: 'redis-\$(Build.Repository.Name)-\${1:env}'
- name: redisConnectionString
  value: '\$(REDIS_CONNECTION_STRING)' # Desde Key Vault`
        );
    }

    async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): Promise<vscode.CompletionItem[] | vscode.CompletionList | null | undefined> {
        const lineText = document.lineAt(position).text;
        const linePrefix = lineText.substring(0, position.character);
        
        const completions: vscode.CompletionItem[] = [];

        // Detectar contexto
        const isTask = linePrefix.match(/^\s*-?\s*task:\s*/);
        const isStage = linePrefix.match(/^\s*-?\s*stage:\s*/);
        const isVariable = linePrefix.match(/^\s*(variables:|.*name:)\s*/);
        const isTrigger = linePrefix.match(/^trigger:\s*/);
        const isStep = linePrefix.match(/^\s*-?\s*(script|bash|powershell):\s*/);
        const isEmptyLine = linePrefix.trim() === '' || linePrefix.trim() === '-';

        if (isTask) {
            // Mostrar tareas obligatorias primero
            this.mandatoryTasks.forEach(item => {
                item.sortText = '0' + item.label; // Prioridad alta
                completions.push(item);
            });

            // Agregar otras tareas comunes
            completions.push(...this.getCommonTasks());
        } else if (isStage) {
            // Sugerir nombres de stages
            completions.push(...this.getStageNames());
        } else if (isVariable) {
            // Sugerir variables seguras
            this.createVariableCompletions().forEach(item => completions.push(item));
        } else if (isTrigger) {
            // Sugerir configuraciones de trigger seguras
            completions.push(this.pipelineSnippets.get('trigger:safe')!);
        } else if (isEmptyLine) {
            // Contexto general - sugerir snippets
            this.pipelineSnippets.forEach(item => {
                completions.push(item);
            });
        }

        // Agregar sugerencias basadas en el proyecto
        const projectSpecificItems = await this.getProjectSpecificCompletions(document);
        completions.push(...projectSpecificItems);

        return new vscode.CompletionList(completions, false);
    }

    private createMandatoryTask(key: string, label: string, insertText: string, documentation: string) {
        const item = new vscode.CompletionItem(label, vscode.CompletionItemKind.Snippet);
        item.insertText = new vscode.SnippetString(insertText);
        item.documentation = new vscode.MarkdownString(documentation);
        item.detail = 'Tarea de seguridad obligatoria';
        item.sortText = '0' + label; // Alta prioridad
        this.mandatoryTasks.set(key, item);
    }

    private createStageSnippet(key: string, label: string, insertText: string) {
        const item = new vscode.CompletionItem(label, vscode.CompletionItemKind.Snippet);
        item.insertText = new vscode.SnippetString(insertText);
        item.documentation = 'Stage completo con configuración estándar';
        item.sortText = '1' + label;
        this.pipelineSnippets.set(key, item);
    }

    private createConfigSnippet(key: string, label: string, insertText: string) {
        const item = new vscode.CompletionItem(label, vscode.CompletionItemKind.Snippet);
        item.insertText = new vscode.SnippetString(insertText);
        item.documentation = 'Configuración recomendada';
        item.sortText = '2' + label;
        this.pipelineSnippets.set(key, item);
    }

    private createVariableSnippet(key: string, label: string, insertText: string) {
        const item = new vscode.CompletionItem(label, vscode.CompletionItemKind.Variable);
        item.insertText = new vscode.SnippetString(insertText);
        item.documentation = 'Variable segura';
        item.sortText = '2' + label;
        this.pipelineSnippets.set(key, item);
    }

    private createTriggerSnippet(key: string, label: string, insertText: string) {
        const item = new vscode.CompletionItem(label, vscode.CompletionItemKind.Property);
        item.insertText = new vscode.SnippetString(insertText);
        item.documentation = 'Configuración de trigger recomendada';
        this.pipelineSnippets.set(key, item);
    }

    private createServiceSnippet(key: string, label: string, insertText: string) {
        const item = new vscode.CompletionItem(label, vscode.CompletionItemKind.Module);
        item.insertText = new vscode.SnippetString(insertText);
        item.documentation = 'Configuración de servicio Azure';
        this.pipelineSnippets.set(key, item);
    }

    private getCommonTasks(): vscode.CompletionItem[] {
        const tasks = [
            this.createTaskItem('DotNetCoreCLI@2', 'Build .NET project'),
            this.createTaskItem('NodeTool@0', 'Setup Node.js'),
            this.createTaskItem('UsePythonVersion@0', 'Setup Python'),
            this.createTaskItem('Docker@2', 'Docker operations'),
            this.createTaskItem('AzureWebApp@1', 'Deploy to Azure App Service'),
            this.createTaskItem('PublishTestResults@2', 'Publish test results'),
            this.createTaskItem('PublishCodeCoverageResults@1', 'Publish code coverage'),
        ];
        return tasks;
    }

    private createTaskItem(taskName: string, description: string): vscode.CompletionItem {
        const item = new vscode.CompletionItem(taskName, vscode.CompletionItemKind.Function);
        item.detail = description;
        item.sortText = '3' + taskName; // Prioridad normal
        return item;
    }

    private getStageNames(): vscode.CompletionItem[] {
        const stages = ['Validate', 'Security', 'Build', 'Test', 'Deploy', 'Package', 'Release'];
        return stages.map(name => {
            const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Enum);
            item.detail = `Stage: ${name}`;
            
            // Los stages obligatorios tienen mayor prioridad
            if (['Validate', 'Security', 'Build', 'Test'].includes(name)) {
                item.sortText = '0' + name;
                item.documentation = '⚠️ Stage obligatorio según políticas corporativas';
            } else {
                item.sortText = '1' + name;
            }
            
            return item;
        });
    }

    private createVariableCompletions(): vscode.CompletionItem[] {
        const variables = [
            { name: 'buildConfiguration', value: 'Release', desc: 'Configuración de build' },
            { name: 'vmImage', value: 'ubuntu-latest', desc: 'Imagen del agente' },
            { name: 'artifactName', value: 'drop', desc: 'Nombre del artifact' },
        ];

        return variables.map(v => {
            const item = new vscode.CompletionItem(v.name, vscode.CompletionItemKind.Variable);
            item.insertText = new vscode.SnippetString(`- name: ${v.name}\n  value: '${v.value}'`);
            item.detail = v.desc;
            item.sortText = '3' + v.name;
            return item;
        });
    }

    private async getProjectSpecificCompletions(document: vscode.TextDocument): Promise<vscode.CompletionItem[]> {
        const completions: vscode.CompletionItem[] = [];
        const text = document.getText();

        // Detectar tipo de proyecto
        if (text.includes('NodeTool') || text.includes('npm')) {
            // Node.js específico
            const npmAudit = new vscode.CompletionItem(
                'npm audit - Auditoría de seguridad',
                vscode.CompletionItemKind.Snippet
            );
            npmAudit.insertText = new vscode.SnippetString(
                `- script: npm audit --audit-level=high\n  displayName: '🔒 Security audit'\n  continueOnError: false`
            );
            npmAudit.documentation = '⚠️ Recomendado para proyectos Node.js';
            npmAudit.sortText = '1npm';
            completions.push(npmAudit);

            const npmCi = new vscode.CompletionItem(
                'npm ci - Instalación rápida',
                vscode.CompletionItemKind.Snippet
            );
            npmCi.insertText = new vscode.SnippetString(`- script: npm ci`);
            npmCi.documentation = '⚡ Más rápido que npm install para CI/CD';
            completions.push(npmCi);
        }

        if (text.includes('DotNetCoreCLI') || text.includes('dotnet')) {
            // .NET específico
            const vulnerableCheck = new vscode.CompletionItem(
                'Check vulnerable packages',
                vscode.CompletionItemKind.Snippet
            );
            vulnerableCheck.insertText = new vscode.SnippetString(
                `- task: DotNetCoreCLI@2\n  displayName: '🔒 Check vulnerable packages'\n  inputs:\n    command: 'custom'\n    custom: 'list'\n    arguments: 'package --vulnerable --include-transitive'`
            );
            completions.push(vulnerableCheck);
        }

        if (text.includes('Python') || text.includes('pip')) {
            // Python específico
            const safetyCheck = new vscode.CompletionItem(
                'safety check - Python security',
                vscode.CompletionItemKind.Snippet
            );
            safetyCheck.insertText = new vscode.SnippetString(
                `- script: |\n    pip install safety\n    safety check --json\n  displayName: '🔒 Python safety check'`
            );
            completions.push(safetyCheck);
        }

        return completions;
    }

    resolveCompletionItem?(
        item: vscode.CompletionItem,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.CompletionItem> {
        // Agregar documentación adicional si es necesario
        if (!item.documentation) {
            item.documentation = new vscode.MarkdownString(
                `### ${item.label}\n\nEsta es una tarea recomendada según los estándares corporativos.`
            );
        }
        return item;
    }
}
