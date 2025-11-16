import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class WikiWebviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'pipelineAssistant.wiki';

    private _view?: vscode.WebviewView;
    private _extensionUri: vscode.Uri;
    private wikiContent: Map<string, string> = new Map();

    constructor(private readonly extensionUri: vscode.Uri) {
        this._extensionUri = extensionUri;
        this.loadWikiContent();
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(async data => {
            switch (data.type) {
                case 'search':
                    this.handleSearch(data.query);
                    break;
                case 'copyCode':
                    await this.handleCopyCode(data.code);
                    break;
                case 'insertCode':
                    await this.handleInsertCode(data.code);
                    break;
                case 'openExternal':
                    vscode.env.openExternal(vscode.Uri.parse(data.url));
                    break;
            }
        });

        // Update content when visible
        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) {
                this.updateContent();
            }
        });
    }

    private loadWikiContent() {
        // Cargar contenido de la wiki desde archivos
        const config = vscode.workspace.getConfiguration('pipelineAssistant');
        const wikiPath = config.get<string>('wikiPath', './wiki/standards');
        
        // Contenido por defecto
        this.wikiContent.set('overview', this.getOverviewContent());
        this.wikiContent.set('mandatory', this.getMandatoryContent());
        this.wikiContent.set('templates', this.getTemplatesContent());
        this.wikiContent.set('security', this.getSecurityContent());
        this.wikiContent.set('performance', this.getPerformanceContent());
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pipeline Standards Wiki</title>
    <style>
        :root {
            --vscode-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            --container-padding: 20px;
            --border-radius: 6px;
        }
        
        body {
            font-family: var(--vscode-font-family);
            padding: 0;
            margin: 0;
            font-size: 14px;
            line-height: 1.6;
        }
        
        .header {
            padding: 15px 20px;
            background: var(--vscode-editor-background);
            border-bottom: 1px solid var(--vscode-panel-border);
            position: sticky;
            top: 0;
            z-index: 100;
        }
        
        .search-box {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid var(--vscode-input-border);
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border-radius: var(--border-radius);
            font-size: 13px;
        }
        
        .nav-tabs {
            display: flex;
            gap: 10px;
            padding: 10px 20px;
            background: var(--vscode-editor-background);
            border-bottom: 1px solid var(--vscode-panel-border);
            overflow-x: auto;
        }
        
        .nav-tab {
            padding: 6px 12px;
            background: transparent;
            border: 1px solid transparent;
            color: var(--vscode-foreground);
            cursor: pointer;
            border-radius: var(--border-radius);
            white-space: nowrap;
            font-size: 13px;
        }
        
        .nav-tab:hover {
            background: var(--vscode-button-hoverBackground);
        }
        
        .nav-tab.active {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        
        .content {
            padding: var(--container-padding);
        }
        
        .section {
            display: none;
            animation: fadeIn 0.3s;
        }
        
        .section.active {
            display: block;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        h1 {
            color: var(--vscode-editor-foreground);
            font-size: 24px;
            margin-top: 0;
        }
        
        h2 {
            color: var(--vscode-editor-foreground);
            font-size: 18px;
            margin-top: 25px;
            padding-bottom: 5px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        
        h3 {
            color: var(--vscode-editor-foreground);
            font-size: 16px;
            margin-top: 20px;
        }
        
        .policy-card {
            background: var(--vscode-editor-inactiveSelectionBackground);
            border-left: 4px solid;
            padding: 15px;
            margin: 15px 0;
            border-radius: var(--border-radius);
        }
        
        .policy-card.mandatory {
            border-left-color: var(--vscode-editorError-foreground);
            background: rgba(255, 0, 0, 0.05);
        }
        
        .policy-card.recommended {
            border-left-color: var(--vscode-editorWarning-foreground);
            background: rgba(255, 193, 7, 0.05);
        }
        
        .policy-card.forbidden {
            border-left-color: var(--vscode-errorForeground);
            background: rgba(244, 67, 54, 0.05);
        }
        
        .code-block {
            background: var(--vscode-textCodeBlock-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: var(--border-radius);
            padding: 12px;
            margin: 10px 0;
            position: relative;
            overflow-x: auto;
        }
        
        .code-block pre {
            margin: 0;
            font-family: var(--vscode-editor-font-family);
            font-size: 13px;
            line-height: 1.5;
        }
        
        .code-actions {
            position: absolute;
            top: 8px;
            right: 8px;
            display: flex;
            gap: 8px;
        }
        
        .code-action {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 4px 8px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 11px;
        }
        
        .code-action:hover {
            background: var(--vscode-button-hoverBackground);
        }
        
        ul {
            padding-left: 25px;
        }
        
        li {
            margin: 8px 0;
        }
        
        .icon {
            display: inline-block;
            margin-right: 6px;
        }
        
        .template-grid {
            display: grid;
            gap: 15px;
            margin-top: 15px;
        }
        
        .template-card {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: var(--border-radius);
            padding: 15px;
        }
        
        .template-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }
        
        .template-title {
            font-weight: 600;
            color: var(--vscode-editor-foreground);
        }
        
        .template-actions {
            display: flex;
            gap: 8px;
        }
        
        .badge {
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 11px;
            font-weight: 600;
        }
        
        .search-results {
            padding: 10px;
            background: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: var(--border-radius);
            margin-top: 10px;
        }
        
        .highlight {
            background: var(--vscode-editor-findMatchHighlightBackground);
            padding: 1px 3px;
            border-radius: 2px;
        }
        
        .tip {
            background: var(--vscode-textBlockQuote-background);
            border-left: 4px solid var(--vscode-textLink-activeForeground);
            padding: 10px 15px;
            margin: 15px 0;
            border-radius: var(--border-radius);
        }
        
        .tip-icon {
            color: var(--vscode-textLink-activeForeground);
            margin-right: 8px;
        }
        
        a {
            color: var(--vscode-textLink-foreground);
            text-decoration: none;
        }
        
        a:hover {
            color: var(--vscode-textLink-activeForeground);
            text-decoration: underline;
        }
        
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid var(--vscode-panel-border);
            text-align: center;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
    </style>
</head>
<body>
    <div class="header">
        <input type="text" class="search-box" placeholder="🔍 Buscar en la wiki..." id="searchBox">
    </div>
    
    <div class="nav-tabs">
        <button class="nav-tab active" onclick="showSection('overview')">📚 General</button>
        <button class="nav-tab" onclick="showSection('mandatory')">🔴 Obligatorio</button>
        <button class="nav-tab" onclick="showSection('templates')">📝 Templates</button>
        <button class="nav-tab" onclick="showSection('security')">🛡️ Seguridad</button>
        <button class="nav-tab" onclick="showSection('performance')">⚡ Rendimiento</button>
    </div>
    
    <div class="content">
        <div id="searchResults" class="search-results" style="display: none;"></div>
        
        <section id="overview" class="section active">
            ${this.getOverviewContent()}
        </section>
        
        <section id="mandatory" class="section">
            ${this.getMandatoryContent()}
        </section>
        
        <section id="templates" class="section">
            ${this.getTemplatesContent()}
        </section>
        
        <section id="security" class="section">
            ${this.getSecurityContent()}
        </section>
        
        <section id="performance" class="section">
            ${this.getPerformanceContent()}
        </section>
    </div>
    
    <div class="footer">
        Pipeline Assistant Wiki | <a href="#" onclick="openExternal('https://docs.microsoft.com/azure/devops')">Azure DevOps Docs</a>
    </div>
    
    <script>
        const vscode = acquireVsCodeApi();
        
        function showSection(sectionId) {
            // Hide all sections
            document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
            document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
            
            // Show selected section
            document.getElementById(sectionId).classList.add('active');
            event.target.classList.add('active');
            
            // Hide search results
            document.getElementById('searchResults').style.display = 'none';
        }
        
        function copyCode(code) {
            vscode.postMessage({
                type: 'copyCode',
                code: code
            });
        }
        
        function insertCode(code) {
            vscode.postMessage({
                type: 'insertCode',
                code: code
            });
        }
        
        function openExternal(url) {
            vscode.postMessage({
                type: 'openExternal',
                url: url
            });
        }
        
        // Search functionality
        document.getElementById('searchBox').addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            if (query.length > 2) {
                vscode.postMessage({
                    type: 'search',
                    query: query
                });
            } else {
                document.getElementById('searchResults').style.display = 'none';
            }
        });
        
        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
                case 'searchResults':
                    displaySearchResults(message.results);
                    break;
            }
        });
        
        function displaySearchResults(results) {
            const container = document.getElementById('searchResults');
            if (results.length > 0) {
                container.innerHTML = '<strong>Resultados de búsqueda:</strong><br>' + 
                    results.map(r => '<div class="search-result">' + r + '</div>').join('');
                container.style.display = 'block';
            } else {
                container.style.display = 'none';
            }
        }
    </script>
</body>
</html>`;
    }

    private getOverviewContent(): string {
        return `
            <h1>📚 Pipeline Standards Wiki</h1>
            
            <div class="tip">
                <span class="tip-icon">💡</span>
                <strong>Tip:</strong> Usa los Quick Fixes (Ctrl+.) para aplicar estas reglas automáticamente en tu pipeline.
            </div>
            
            <h2>Principios Fundamentales</h2>
            
            <ul>
                <li><strong>Seguridad primero:</strong> Todos los pipelines deben incluir análisis de seguridad</li>
                <li><strong>Sin secretos hardcodeados:</strong> Usar Azure Key Vault para todas las credenciales</li>
                <li><strong>Estructura consistente:</strong> Usar stages: Validate → Security → Build → Test → Deploy</li>
                <li><strong>Fail fast:</strong> Los errores de seguridad deben detener el pipeline inmediatamente</li>
            </ul>
            
            <h2>Estructura Requerida</h2>
            
            <div class="code-block">
                <div class="code-actions">
                    <button class="code-action" onclick="copyCode(\`stages:
  - stage: Validate
  - stage: Security
  - stage: Build
  - stage: Test
  - stage: Deploy\`)">📋 Copiar</button>
                    <button class="code-action" onclick="insertCode(\`stages:
  - stage: Validate
  - stage: Security
  - stage: Build
  - stage: Test
  - stage: Deploy\`)">➕ Insertar</button>
                </div>
                <pre>stages:
  - stage: Validate
  - stage: Security
  - stage: Build
  - stage: Test
  - stage: Deploy</pre>
            </div>
            
            <h2>Herramientas de Seguridad Obligatorias</h2>
            
            <ul>
                <li><span class="icon">🔐</span><strong>TruffleHog:</strong> Escaneo de secretos</li>
                <li><span class="icon">📊</span><strong>SonarQube:</strong> Análisis estático de código (SAST)</li>
                <li><span class="icon">📦</span><strong>Snyk:</strong> Escaneo de dependencias vulnerables</li>
                <li><span class="icon">🐳</span><strong>Trivy:</strong> Escaneo de contenedores (si usa Docker)</li>
            </ul>
        `;
    }

    private getMandatoryContent(): string {
        return `
            <h1>🔴 Políticas Obligatorias</h1>
            
            <div class="policy-card mandatory">
                <h3>SEC-001: Escaneo de Secretos</h3>
                <p>Todos los pipelines DEBEN escanear secretos hardcodeados.</p>
                <div class="code-block">
                    <div class="code-actions">
                        <button class="code-action" onclick="insertCode(\`- task: TruffleHog@1
  displayName: 'Escanear secretos'
  inputs:
    path: '$(Build.SourcesDirectory)'
    failOnSecrets: true\`)">➕ Insertar</button>
                    </div>
                    <pre>- task: TruffleHog@1
  displayName: 'Escanear secretos'
  inputs:
    path: '$(Build.SourcesDirectory)'
    failOnSecrets: true</pre>
                </div>
            </div>
            
            <div class="policy-card mandatory">
                <h3>SEC-002: Análisis SAST</h3>
                <p>Análisis estático de código con Quality Gates obligatorios.</p>
                <div class="code-block">
                    <div class="code-actions">
                        <button class="code-action" onclick="insertCode(\`- task: SonarQubePrepare@5
- task: SonarQubeAnalyze@5
- task: SonarQubePublish@5\`)">➕ Insertar</button>
                    </div>
                    <pre>- task: SonarQubePrepare@5
- task: SonarQubeAnalyze@5
- task: SonarQubePublish@5</pre>
                </div>
            </div>
            
            <div class="policy-card mandatory">
                <h3>SEC-003: Escaneo de Dependencias</h3>
                <p>Verificar vulnerabilidades en dependencias de terceros.</p>
                <div class="code-block">
                    <div class="code-actions">
                        <button class="code-action" onclick="insertCode(\`- task: SnykSecurityScan@1
  inputs:
    severityThreshold: 'high'
    failOnIssues: true\`)">➕ Insertar</button>
                    </div>
                    <pre>- task: SnykSecurityScan@1
  inputs:
    severityThreshold: 'high'
    failOnIssues: true</pre>
                </div>
            </div>
            
            <div class="policy-card forbidden">
                <h3>🚫 Prácticas Prohibidas</h3>
                <ul>
                    <li>❌ <code>trigger: true</code> sin especificar branches</li>
                    <li>❌ <code>continueOnError: true</code> en tareas de seguridad</li>
                    <li>❌ Passwords o tokens hardcodeados</li>
                    <li>❌ Despliegue directo a producción sin aprobación</li>
                </ul>
            </div>
        `;
    }

    private getTemplatesContent(): string {
        return `
            <h1>📝 Templates por Tecnología</h1>
            
            <div class="template-grid">
                <div class="template-card">
                    <div class="template-header">
                        <span class="template-title">🟢 Node.js Pipeline</span>
                        <div class="template-actions">
                            <span class="badge">Popular</span>
                        </div>
                    </div>
                    <div class="code-block">
                        <div class="code-actions">
                            <button class="code-action" onclick="copyCode(\`pool:
  vmImage: 'ubuntu-latest'

steps:
  - task: NodeTool@0
    inputs:
      versionSpec: '20.x'
  - task: Cache@2
    inputs:
      key: 'npm | "$(Agent.OS)" | package-lock.json'
      path: $(npm_config_cache)
  - script: npm ci
  - script: npm run build
  - script: npm test
  - script: npm audit --audit-level=high\`)">📋 Copiar</button>
                            <button class="code-action" onclick="insertCode(\`pool:
  vmImage: 'ubuntu-latest'

steps:
  - task: NodeTool@0
    inputs:
      versionSpec: '20.x'
  - task: Cache@2
    inputs:
      key: 'npm | "$(Agent.OS)" | package-lock.json'
      path: $(npm_config_cache)
  - script: npm ci
  - script: npm run build
  - script: npm test
  - script: npm audit --audit-level=high\`)">➕ Insertar</button>
                        </div>
                        <pre>pool:
  vmImage: 'ubuntu-latest'

steps:
  - task: NodeTool@0
    inputs:
      versionSpec: '20.x'
  - task: Cache@2
    inputs:
      key: 'npm | "$(Agent.OS)" | package-lock.json'
      path: $(npm_config_cache)
  - script: npm ci
  - script: npm run build
  - script: npm test
  - script: npm audit --audit-level=high</pre>
                    </div>
                </div>
                
                <div class="template-card">
                    <div class="template-header">
                        <span class="template-title">🔵 .NET Pipeline</span>
                        <div class="template-actions">
                            <span class="badge">Enterprise</span>
                        </div>
                    </div>
                    <div class="code-block">
                        <div class="code-actions">
                            <button class="code-action" onclick="copyCode(\`pool:
  vmImage: 'ubuntu-latest'

variables:
  buildConfiguration: 'Release'

steps:
  - task: UseDotNet@2
    inputs:
      version: '8.x'
  - task: DotNetCoreCLI@2
    inputs:
      command: 'restore'
  - task: DotNetCoreCLI@2
    inputs:
      command: 'build'
      arguments: '--configuration $(buildConfiguration)'
  - task: DotNetCoreCLI@2
    inputs:
      command: 'test'
      arguments: '--collect:"XPlat Code Coverage"'\`)">📋 Copiar</button>
                        </div>
                        <pre>pool:
  vmImage: 'ubuntu-latest'

variables:
  buildConfiguration: 'Release'

steps:
  - task: UseDotNet@2
    inputs:
      version: '8.x'
  - task: DotNetCoreCLI@2
    inputs:
      command: 'restore'
  - task: DotNetCoreCLI@2
    inputs:
      command: 'build'
      arguments: '--configuration $(buildConfiguration)'
  - task: DotNetCoreCLI@2
    inputs:
      command: 'test'
      arguments: '--collect:"XPlat Code Coverage"'</pre>
                    </div>
                </div>
                
                <div class="template-card">
                    <div class="template-header">
                        <span class="template-title">🐍 Python Pipeline</span>
                        <div class="template-actions">
                            <span class="badge">ML/Data</span>
                        </div>
                    </div>
                    <div class="code-block">
                        <div class="code-actions">
                            <button class="code-action" onclick="insertCode(\`pool:
  vmImage: 'ubuntu-latest'

steps:
  - task: UsePythonVersion@0
    inputs:
      versionSpec: '3.11'
  - script: |
      python -m pip install --upgrade pip
      pip install -r requirements.txt
  - script: |
      pip install pytest pytest-cov
      pytest tests/ --cov=./
  - script: |
      pip install safety
      safety check\`)">➕ Insertar</button>
                        </div>
                        <pre>pool:
  vmImage: 'ubuntu-latest'

steps:
  - task: UsePythonVersion@0
    inputs:
      versionSpec: '3.11'
  - script: |
      python -m pip install --upgrade pip
      pip install -r requirements.txt
  - script: |
      pip install pytest pytest-cov
      pytest tests/ --cov=./
  - script: |
      pip install safety
      safety check</pre>
                    </div>
                </div>
            </div>
        `;
    }

    private getSecurityContent(): string {
        return `
            <h1>🛡️ Guía de Seguridad</h1>
            
            <h2>Gestión de Secretos</h2>
            
            <div class="policy-card recommended">
                <h3>Usar Azure Key Vault</h3>
                <p>Nunca hardcodear credenciales. Siempre usar Key Vault:</p>
                <div class="code-block">
                    <div class="code-actions">
                        <button class="code-action" onclick="insertCode(\`- task: AzureKeyVault@2
  inputs:
    azureSubscription: 'ServiceConnection'
    KeyVaultName: 'my-keyvault'
    SecretsFilter: '*'\`)">➕ Insertar</button>
                    </div>
                    <pre>- task: AzureKeyVault@2
  inputs:
    azureSubscription: 'ServiceConnection'
    KeyVaultName: 'my-keyvault'
    SecretsFilter: '*'</pre>
                </div>
            </div>
            
            <h2>Patrones de Secretos a Evitar</h2>
            
            <div class="policy-card forbidden">
                <h3>❌ Ejemplos de Malas Prácticas</h3>
                <pre style="background: rgba(255,0,0,0.1); padding: 10px; border-radius: 4px;">
# NUNCA hacer esto:
password: "MySecret123!"
apiKey: "sk-1234567890"
connectionString: "Server=prod;Password=admin123"</pre>
                
                <h3>✅ Forma Correcta</h3>
                <pre style="background: rgba(0,255,0,0.1); padding: 10px; border-radius: 4px;">
# SIEMPRE hacer esto:
password: "$(PASSWORD)"  # De Key Vault
apiKey: "$(API_KEY)"     # De variable group
connectionString: "$(CONNECTION_STRING)"</pre>
            </div>
            
            <h2>Quality Gates</h2>
            
            <ul>
                <li>📊 <strong>Coverage:</strong> Mínimo 80%</li>
                <li>🐛 <strong>Bugs:</strong> 0 nuevos</li>
                <li>🔒 <strong>Vulnerabilities:</strong> 0 críticas o altas</li>
                <li>🔍 <strong>Code Smells:</strong> < 5% de deuda técnica</li>
            </ul>
        `;
    }

    private getPerformanceContent(): string {
        return `
            <h1>⚡ Optimización de Rendimiento</h1>
            
            <h2>Estrategias de Caché</h2>
            
            <div class="template-card">
                <h3>NPM Cache (Node.js)</h3>
                <div class="code-block">
                    <div class="code-actions">
                        <button class="code-action" onclick="insertCode(\`- task: Cache@2
  inputs:
    key: 'npm | "$(Agent.OS)" | package-lock.json'
    restoreKeys: |
      npm | "$(Agent.OS)"
    path: $(npm_config_cache)\`)">➕ Insertar</button>
                    </div>
                    <pre>- task: Cache@2
  inputs:
    key: 'npm | "$(Agent.OS)" | package-lock.json'
    restoreKeys: |
      npm | "$(Agent.OS)"
    path: $(npm_config_cache)</pre>
                </div>
            </div>
            
            <div class="template-card">
                <h3>NuGet Cache (.NET)</h3>
                <div class="code-block">
                    <div class="code-actions">
                        <button class="code-action" onclick="insertCode(\`- task: Cache@2
  inputs:
    key: 'nuget | "$(Agent.OS)" | **/packages.lock.json'
    path: $(NUGET_PACKAGES)\`)">➕ Insertar</button>
                    </div>
                    <pre>- task: Cache@2
  inputs:
    key: 'nuget | "$(Agent.OS)" | **/packages.lock.json'
    path: $(NUGET_PACKAGES)</pre>
                </div>
            </div>
            
            <h2>Paralelización</h2>
            
            <div class="tip">
                <span class="tip-icon">💡</span>
                Los stages independientes pueden ejecutarse en paralelo:
            </div>
            
            <div class="code-block">
                <pre>stages:
  - stage: Build
    
  - stage: SecurityScan
    dependsOn: []  # Ejecuta en paralelo con Build
    
  - stage: Tests
    dependsOn: Build
    
  - stage: CodeQuality
    dependsOn: Build  # Ambos dependen de Build, ejecutan en paralelo</pre>
            </div>
            
            <h2>Mejores Prácticas</h2>
            
            <ul>
                <li>✅ Usar <code>npm ci</code> en lugar de <code>npm install</code></li>
                <li>✅ Cachear dependencias siempre</li>
                <li>✅ Usar artifacts para compartir entre stages</li>
                <li>✅ Limitar el <code>fetchDepth</code> en checkout</li>
                <li>✅ Usar pools de agentes específicos para tareas pesadas</li>
            </ul>
        `;
    }

    private handleSearch(query: string) {
        // Buscar en todo el contenido
        const results: string[] = [];
        
        this.wikiContent.forEach((content, key) => {
            if (content.toLowerCase().includes(query.toLowerCase())) {
                // Extraer contexto alrededor de la coincidencia
                const index = content.toLowerCase().indexOf(query.toLowerCase());
                const start = Math.max(0, index - 50);
                const end = Math.min(content.length, index + query.length + 50);
                const excerpt = content.substring(start, end);
                results.push(`...${excerpt}...`);
            }
        });

        // Enviar resultados al webview
        if (this._view) {
            this._view.webview.postMessage({
                type: 'searchResults',
                results: results.slice(0, 5) // Limitar a 5 resultados
            });
        }
    }

    private async handleCopyCode(code: string) {
        await vscode.env.clipboard.writeText(code);
        vscode.window.showInformationMessage('Código copiado al portapapeles');
    }

    private async handleInsertCode(code: string) {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const position = editor.selection.active;
            await editor.edit(editBuilder => {
                editBuilder.insert(position, code);
            });
            vscode.window.showInformationMessage('Código insertado en el editor');
        } else {
            vscode.window.showWarningMessage('No hay editor activo para insertar el código');
        }
    }

    public updateContent() {
        // Recargar contenido si es necesario
        this.loadWikiContent();
    }

    public showSection(sectionName: string) {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'showSection',
                section: sectionName
            });
        }
    }
}
