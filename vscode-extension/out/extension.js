"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const MCPClient_1 = require("./mcp/MCPClient");
const DiagnosticProvider_1 = require("./providers/DiagnosticProvider");
const CodeActionProvider_1 = require("./providers/CodeActionProvider");
const CompletionProvider_1 = require("./providers/CompletionProvider");
const WikiWebviewProvider_1 = require("./providers/WikiWebviewProvider");
const HoverProvider_1 = require("./providers/HoverProvider");
let mcpClient;
let diagnosticProvider;
let diagnosticCollection;
async function activate(context) {
    console.log('Pipeline Assistant MCP extension is activating...');
    // Inicializar colección de diagnósticos
    diagnosticCollection = vscode.languages.createDiagnosticCollection('pipelineAssistant');
    context.subscriptions.push(diagnosticCollection);
    // Inicializar cliente MCP
    mcpClient = new MCPClient_1.MCPClient(context);
    await mcpClient.connect();
    // Inicializar proveedores
    diagnosticProvider = new DiagnosticProvider_1.DiagnosticProvider(mcpClient, diagnosticCollection);
    const codeActionProvider = new CodeActionProvider_1.CodeActionProvider(mcpClient);
    const completionProvider = new CompletionProvider_1.CompletionProvider(mcpClient);
    const wikiProvider = new WikiWebviewProvider_1.WikiWebviewProvider(context.extensionUri);
    const hoverProvider = new HoverProvider_1.HoverProvider(mcpClient);
    // Registrar comandos
    registerCommands(context);
    // Registrar proveedores de lenguaje
    registerLanguageProviders(context, codeActionProvider, completionProvider, hoverProvider);
    // Registrar webview provider para wiki
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(WikiWebviewProvider_1.WikiWebviewProvider.viewType, wikiProvider));
    // Auto-análisis al guardar
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(async (document) => {
        if (shouldAnalyzeDocument(document)) {
            await analyzeDocument(document);
        }
    }));
    // Análisis inicial del documento activo
    if (vscode.window.activeTextEditor) {
        const document = vscode.window.activeTextEditor.document;
        if (shouldAnalyzeDocument(document)) {
            await analyzeDocument(document);
        }
    }
    // Status bar item
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = '$(shield) Pipeline Assistant';
    statusBarItem.tooltip = 'Pipeline Assistant está activo';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);
    console.log('Pipeline Assistant MCP extension activated successfully');
}
function registerCommands(context) {
    // Comando: Generar Pipeline
    context.subscriptions.push(vscode.commands.registerCommand('pipelineAssistant.generate', async () => {
        try {
            // Solicitar tipo de proyecto
            const projectType = await vscode.window.showQuickPick(['dotnet', 'node', 'python'], {
                placeHolder: 'Selecciona el tipo de proyecto',
                title: 'Pipeline Assistant - Generar Pipeline'
            });
            if (!projectType)
                return;
            // Solicitar servicios
            const servicesOptions = [
                { label: 'Azure SQL', value: 'azuresql' },
                { label: 'Redis Cache', value: 'redis' },
                { label: 'CosmosDB', value: 'cosmosdb' },
                { label: 'Service Bus', value: 'servicebus' },
                { label: 'Storage Account', value: 'storage' },
                { label: 'Key Vault', value: 'keyvault' }
            ];
            const selectedServices = await vscode.window.showQuickPick(servicesOptions, {
                placeHolder: 'Selecciona servicios adicionales (opcional)',
                title: 'Servicios Azure',
                canPickMany: true
            });
            const services = selectedServices?.map(s => s.value) || [];
            // Solicitar ambiente
            const environment = await vscode.window.showQuickPick(['dev', 'staging', 'prod'], {
                placeHolder: 'Selecciona el ambiente',
                title: 'Ambiente Target'
            });
            if (!environment)
                return;
            // ¿Usa Docker?
            const usesDocker = await vscode.window.showQuickPick(['Sí', 'No'], {
                placeHolder: '¿El proyecto usa Docker/contenedores?',
                title: 'Configuración Docker'
            }) === 'Sí';
            // Mostrar progreso
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Generando pipeline...',
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0, message: 'Conectando con MCP server...' });
                // Generar pipeline
                const pipeline = await mcpClient.generatePipeline({
                    projectType,
                    services,
                    environment
                });
                progress.report({ increment: 50, message: 'Pipeline generado, creando archivo...' });
                // Crear archivo
                const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                if (!workspaceFolder) {
                    throw new Error('No hay carpeta de trabajo abierta');
                }
                const pipelineUri = vscode.Uri.joinPath(workspaceFolder.uri, 'azure-pipelines.yml');
                await vscode.workspace.fs.writeFile(pipelineUri, Buffer.from(pipeline, 'utf8'));
                progress.report({ increment: 100, message: 'Pipeline creado exitosamente' });
                // Abrir archivo
                const document = await vscode.workspace.openTextDocument(pipelineUri);
                await vscode.window.showTextDocument(document);
                // Mostrar notificación
                vscode.window.showInformationMessage(`✅ Pipeline generado exitosamente para proyecto ${projectType}`, 'Ver Wiki').then(selection => {
                    if (selection === 'Ver Wiki') {
                        vscode.commands.executeCommand('pipelineAssistant.openWiki');
                    }
                });
            });
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error generando pipeline: ${error instanceof Error ? error.message : 'Error desconocido'}`);
        }
    }));
    // Comando: Analizar Pipeline
    context.subscriptions.push(vscode.commands.registerCommand('pipelineAssistant.analyze', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No hay archivo abierto');
            return;
        }
        if (!isYamlFile(editor.document)) {
            vscode.window.showErrorMessage('El archivo actual no es un YAML');
            return;
        }
        await analyzeDocument(editor.document);
        // Mostrar panel de problemas
        vscode.commands.executeCommand('workbench.actions.view.problems');
        vscode.window.showInformationMessage('Análisis completado. Revisa el panel de Problemas.');
    }));
    // Comando: Sugerir Mejoras
    context.subscriptions.push(vscode.commands.registerCommand('pipelineAssistant.suggestImprovements', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || !isYamlFile(editor.document)) {
            vscode.window.showErrorMessage('Abre un archivo YAML de pipeline');
            return;
        }
        const focus = await vscode.window.showQuickPick([
            { label: '🛡️ Seguridad', value: 'security' },
            { label: '⚡ Rendimiento', value: 'performance' },
            { label: '✅ Compliance', value: 'compliance' },
            { label: '📈 Calidad', value: 'quality' }
        ], {
            placeHolder: 'Selecciona áreas de mejora',
            canPickMany: true,
            title: 'Pipeline Assistant - Áreas de Enfoque'
        });
        if (!focus || focus.length === 0)
            return;
        const focusAreas = focus.map(f => f.value);
        const suggestions = await mcpClient.suggestImprovements(editor.document.getText(), focusAreas);
        // Crear un nuevo documento con las sugerencias
        const suggestionsDoc = await vscode.workspace.openTextDocument({
            language: 'markdown',
            content: formatSuggestions(suggestions.suggestions)
        });
        await vscode.window.showTextDocument(suggestionsDoc, vscode.ViewColumn.Beside);
    }));
    // Comando: Abrir Wiki
    context.subscriptions.push(vscode.commands.registerCommand('pipelineAssistant.openWiki', async () => {
        const panel = vscode.window.createWebviewPanel('pipelineWiki', 'Pipeline Standards Wiki', vscode.ViewColumn.Beside, {
            enableScripts: true,
            retainContextWhenHidden: true
        });
        panel.webview.html = await getWikiContent();
    }));
    // Comando: Aplicar Quick Fix
    context.subscriptions.push(vscode.commands.registerCommand('pipelineAssistant.applyQuickFix', async (document, range, newText) => {
        const edit = new vscode.WorkspaceEdit();
        edit.replace(document.uri, range, newText);
        await vscode.workspace.applyEdit(edit);
        vscode.window.showInformationMessage('Fix aplicado exitosamente');
    }));
}
function registerLanguageProviders(context, codeActionProvider, completionProvider, hoverProvider) {
    // Registrar Code Actions (Quick Fixes)
    context.subscriptions.push(vscode.languages.registerCodeActionsProvider({ language: 'yaml', pattern: '**/*.{yml,yaml}' }, codeActionProvider, {
        providedCodeActionKinds: [
            vscode.CodeActionKind.QuickFix,
            vscode.CodeActionKind.Refactor
        ]
    }));
    // Registrar Completion Provider (Autocompletado)
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider({ language: 'yaml', pattern: '**/*.{yml,yaml}' }, completionProvider, '-', ' ', ':'));
    // Registrar Hover Provider
    context.subscriptions.push(vscode.languages.registerHoverProvider({ language: 'yaml', pattern: '**/*.{yml,yaml}' }, hoverProvider));
}
async function analyzeDocument(document) {
    if (!isYamlFile(document))
        return;
    const config = vscode.workspace.getConfiguration('pipelineAssistant');
    const strictMode = config.get('strictMode', false);
    // Detectar tipo de proyecto
    const projectType = await detectProjectType();
    // Analizar con MCP
    const analysis = await mcpClient.analyzePipeline(document.getText(), strictMode);
    // Actualizar diagnósticos
    diagnosticProvider.updateDiagnostics(document, analysis);
    // Actualizar status bar
    updateStatusBar(analysis);
}
function shouldAnalyzeDocument(document) {
    if (!isYamlFile(document))
        return false;
    const config = vscode.workspace.getConfiguration('pipelineAssistant');
    const autoAnalysis = config.get('enableAutoAnalysis', true);
    if (!autoAnalysis)
        return false;
    // Verificar si es un archivo de pipeline
    const fileName = document.fileName.toLowerCase();
    return fileName.includes('pipeline') ||
        fileName.includes('.github/workflows') ||
        fileName.includes('azure-pipelines');
}
function isYamlFile(document) {
    return document.languageId === 'yaml' ||
        document.fileName.endsWith('.yml') ||
        document.fileName.endsWith('.yaml');
}
async function detectProjectType() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder)
        return undefined;
    // Buscar archivos indicadores
    const patterns = [
        { pattern: '**/package.json', type: 'node' },
        { pattern: '**/*.csproj', type: 'dotnet' },
        { pattern: '**/*.sln', type: 'dotnet' },
        { pattern: '**/requirements.txt', type: 'python' },
        { pattern: '**/setup.py', type: 'python' }
    ];
    for (const { pattern, type } of patterns) {
        const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**', 1);
        if (files.length > 0) {
            return type;
        }
    }
    return undefined;
}
function updateStatusBar(analysis) {
    // Esta función actualizaría un item en la status bar con el score
    const score = analysis.score || 0;
    const emoji = score >= 80 ? '🟢' : score >= 60 ? '🟡' : '🔴';
    // Actualizar status bar item (implementación simplificada)
    console.log(`Pipeline Score: ${emoji} ${score}%`);
}
function formatSuggestions(suggestions) {
    let content = '# 💡 Sugerencias de Mejora para Pipeline\n\n';
    suggestions.forEach((suggestion, index) => {
        const icon = suggestion.type === 'PERFORMANCE' ? '⚡' :
            suggestion.type === 'SECURITY' ? '🛡️' :
                suggestion.type === 'QUALITY' ? '📈' : '💡';
        content += `## ${icon} ${index + 1}. ${suggestion.message}\n\n`;
        if (suggestion.description) {
            content += `${suggestion.description}\n\n`;
        }
        if (suggestion.code) {
            content += '### Código sugerido:\n\n';
            content += '```yaml\n';
            content += suggestion.code;
            content += '\n```\n\n';
        }
        if (suggestion.documentation) {
            content += `📚 [Más información](${suggestion.documentation})\n\n`;
        }
        content += '---\n\n';
    });
    return content;
}
async function getWikiContent() {
    // Contenido HTML para el webview de la wiki
    return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pipeline Standards Wiki</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 20px;
            line-height: 1.6;
        }
        h1 { color: #007ACC; }
        h2 { color: #005A9E; margin-top: 30px; }
        h3 { color: #333; }
        code {
            background: #f4f4f4;
            padding: 2px 6px;
            border-radius: 3px;
        }
        pre {
            background: #f4f4f4;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
        }
        .mandatory { 
            background: #ffebee; 
            border-left: 4px solid #f44336;
            padding: 10px;
            margin: 10px 0;
        }
        .recommended { 
            background: #fff3e0; 
            border-left: 4px solid #ff9800;
            padding: 10px;
            margin: 10px 0;
        }
        .forbidden { 
            background: #fce4ec; 
            border-left: 4px solid #e91e63;
            padding: 10px;
            margin: 10px 0;
        }
    </style>
</head>
<body>
    <h1>📚 Pipeline Standards Wiki</h1>
    
    <h2>Estándares Corporativos CI/CD</h2>
    
    <div class="mandatory">
        <h3>🔴 Obligatorio</h3>
        <ul>
            <li><strong>Stages requeridos:</strong> Validate, Security, Build, Test</li>
            <li><strong>Análisis de seguridad:</strong> TruffleHog, SonarQube, Snyk</li>
            <li><strong>Secretos:</strong> Usar Azure Key Vault, nunca hardcodear</li>
        </ul>
    </div>
    
    <div class="recommended">
        <h3>🟠 Recomendado</h3>
        <ul>
            <li><strong>Cache:</strong> Implementar para dependencias</li>
            <li><strong>Artifacts:</strong> Usar entre stages</li>
            <li><strong>Paralelización:</strong> Para stages independientes</li>
        </ul>
    </div>
    
    <div class="forbidden">
        <h3>🚫 Prohibido</h3>
        <ul>
            <li><strong>trigger: true</strong> sin especificar branches</li>
            <li><strong>continueOnError</strong> en tareas de seguridad</li>
            <li><strong>Passwords</strong> o tokens hardcodeados</li>
        </ul>
    </div>
    
    <h2>Templates por Tecnología</h2>
    
    <h3>Node.js</h3>
    <pre><code>- task: Cache@2
  inputs:
    key: 'npm | "$(Agent.OS)" | package-lock.json'
    path: $(npm_config_cache)
- script: npm ci
- script: npm audit --audit-level=high</code></pre>
    
    <h3>.NET</h3>
    <pre><code>- task: DotNetCoreCLI@2
  inputs:
    command: 'restore'
- task: DotNetCoreCLI@2
  inputs:
    command: 'build'
    arguments: '--no-restore'</code></pre>
    
    <h3>Python</h3>
    <pre><code>- task: UsePythonVersion@0
  inputs:
    versionSpec: '3.11'
- script: pip install safety
- script: safety check</code></pre>
    
    <h2>Enlaces Útiles</h2>
    <ul>
        <li><a href="https://docs.microsoft.com/azure/devops/pipelines">Azure Pipelines Documentation</a></li>
        <li><a href="https://github.com/features/actions">GitHub Actions</a></li>
        <li><a href="#">Políticas de Seguridad Internas</a></li>
    </ul>
</body>
</html>`;
}
function deactivate() {
    if (mcpClient) {
        mcpClient.disconnect();
    }
    console.log('Pipeline Assistant MCP extension deactivated');
}
//# sourceMappingURL=extension.js.map