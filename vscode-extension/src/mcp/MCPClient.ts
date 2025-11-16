import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export class MCPClient {
    private client: Client | null = null;
    private serverProcess: ChildProcess | null = null;
    private context: vscode.ExtensionContext;
    private isConnected: boolean = false;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    async connect(): Promise<void> {
        try {
            // Obtener configuración
            const config = vscode.workspace.getConfiguration('pipelineAssistant');
            let serverPath = config.get<string>('mcpServerPath');

            // Si no está configurado, usar la ruta por defecto
            if (!serverPath) {
                serverPath = this.context.asAbsolutePath('dist/server.js');
            }

            // Iniciar proceso del servidor
            this.serverProcess = spawn('node', [serverPath], {
                stdio: ['pipe', 'pipe', 'pipe'],
                env: {
                    ...process.env,
                    WIKI_PATH: config.get<string>('wikiPath', './wiki/standards')
                }
            });

            // Manejar errores del proceso
            this.serverProcess.on('error', (error) => {
                console.error('Error iniciando servidor MCP:', error);
                vscode.window.showErrorMessage(`Error iniciando servidor MCP: ${error.message}`);
            });

            this.serverProcess.stderr?.on('data', (data) => {
                console.error('MCP Server Error:', data.toString());
            });

            // Crear transporte stdio
            const transport = new StdioClientTransport({
                readable: this.serverProcess.stdout!,
                writable: this.serverProcess.stdin!
            });

            // Crear cliente MCP
            this.client = new Client(
                {
                    name: 'pipeline-assistant-vscode',
                    version: '1.0.0'
                },
                {
                    capabilities: {}
                }
            );

            // Conectar
            await this.client.connect(transport);
            this.isConnected = true;

            console.log('Cliente MCP conectado exitosamente');
        } catch (error) {
            console.error('Error conectando con servidor MCP:', error);
            throw error;
        }
    }

    async disconnect(): Promise<void> {
        if (this.client) {
            await this.client.close();
            this.client = null;
        }
        
        if (this.serverProcess) {
            this.serverProcess.kill();
            this.serverProcess = null;
        }
        
        this.isConnected = false;
    }

    async generatePipeline(options: {
        projectType: string;
        services: string[];
        environment: string;
        usesDocker: boolean;
        enforceAllPolicies: boolean;
    }): Promise<string> {
        if (!this.isConnected || !this.client) {
            throw new Error('Cliente MCP no conectado');
        }

        try {
            const result = await this.client.callTool('generate_pipeline', options);
            
            if (result.content && result.content[0] && result.content[0].type === 'text') {
                return result.content[0].text;
            }
            
            throw new Error('Respuesta inesperada del servidor');
        } catch (error) {
            console.error('Error generando pipeline:', error);
            throw error;
        }
    }

    async analyzePipeline(
        yamlContent: string,
        strictMode: boolean = false,
        projectType?: string
    ): Promise<any> {
        if (!this.isConnected || !this.client) {
            throw new Error('Cliente MCP no conectado');
        }

        try {
            const result = await this.client.callTool('analyze_pipeline', {
                yamlContent,
                strictMode,
                projectType
            });
            
            // Parsear la respuesta del servidor
            if (result.content && result.content[0] && result.content[0].type === 'text') {
                return this.parseAnalysisResponse(result.content[0].text);
            }
            
            throw new Error('Respuesta inesperada del servidor');
        } catch (error) {
            console.error('Error analizando pipeline:', error);
            throw error;
        }
    }

    async suggestImprovements(
        yamlContent: string,
        focus: Array<'security' | 'performance' | 'compliance' | 'quality'>
    ): Promise<any[]> {
        if (!this.isConnected || !this.client) {
            throw new Error('Cliente MCP no conectado');
        }

        try {
            const result = await this.client.callTool('suggest_improvements', {
                yamlContent,
                focus
            });
            
            if (result.content && result.content[0] && result.content[0].type === 'text') {
                return this.parseSuggestionsResponse(result.content[0].text);
            }
            
            return [];
        } catch (error) {
            console.error('Error obteniendo sugerencias:', error);
            throw error;
        }
    }

    private parseAnalysisResponse(responseText: string): any {
        // Parsear la respuesta markdown del servidor a un objeto estructurado
        const analysis = {
            score: 0,
            violations: [] as any[],
            warnings: [] as any[],
            suggestions: [] as any[],
            summary: {
                totalIssues: 0,
                criticalCount: 0,
                highCount: 0,
                mediumCount: 0,
                lowCount: 0
            }
        };

        // Extraer score
        const scoreMatch = responseText.match(/Score de Compliance:\s*[🟢🟡🟠🔴]\s*(\d+)%/);
        if (scoreMatch) {
            analysis.score = parseInt(scoreMatch[1]);
        }

        // Extraer resumen
        const criticalMatch = responseText.match(/Críticos:\s*(\d+)/);
        if (criticalMatch) analysis.summary.criticalCount = parseInt(criticalMatch[1]);

        const highMatch = responseText.match(/Altos:\s*(\d+)/);
        if (highMatch) analysis.summary.highCount = parseInt(highMatch[1]);

        const mediumMatch = responseText.match(/Medios:\s*(\d+)/);
        if (mediumMatch) analysis.summary.mediumCount = parseInt(mediumMatch[1]);

        const lowMatch = responseText.match(/Bajos:\s*(\d+)/);
        if (lowMatch) analysis.summary.lowCount = parseInt(lowMatch[1]);

        const totalMatch = responseText.match(/Total de problemas:\s*(\d+)/);
        if (totalMatch) analysis.summary.totalIssues = parseInt(totalMatch[1]);

        // Extraer violaciones
        const violationsSection = responseText.match(/## ❌ Violaciones[\s\S]*?(?=##|$)/);
        if (violationsSection) {
            const violationMatches = violationsSection[0].matchAll(
                /- \*\*\[([^\]]+)\]\*\* Línea (\d+): ([^\n]+)(?:\n\s+- Regla: `([^`]+)`)?(?:\n\s+- 💡 ([^\n]+))?/g
            );
            
            for (const match of violationMatches) {
                analysis.violations.push({
                    type: match[1],
                    line: parseInt(match[2]),
                    message: match[3],
                    rule: match[4] || undefined,
                    suggestion: match[5] || undefined,
                    severity: this.determineSeverity(violationsSection[0], match[1])
                });
            }
        }

        // Extraer warnings
        const warningsSection = responseText.match(/## ⚠️ Warnings[\s\S]*?(?=##|$)/);
        if (warningsSection) {
            const warningMatches = warningsSection[0].matchAll(
                /- \*\*\[([^\]]+)\]\*\* Línea (\d+): ([^\n]+)(?:\n\s+- 💡 ([^\n]+))?/g
            );
            
            for (const match of warningMatches) {
                analysis.warnings.push({
                    type: match[1],
                    line: parseInt(match[2]),
                    message: match[3],
                    suggestion: match[4] || undefined,
                    severity: 'MEDIUM'
                });
            }
        }

        // Extraer sugerencias
        const suggestionsSection = responseText.match(/## 💡 Sugerencias de Mejora[\s\S]*?(?=##|$)/);
        if (suggestionsSection) {
            const suggestionMatches = suggestionsSection[0].matchAll(
                /- [🔴🟠🟢] ([^\n]+)(?:\n\s+- ([^\n]+))?/g
            );
            
            for (const match of suggestionMatches) {
                analysis.suggestions.push({
                    message: match[1],
                    description: match[2] || undefined,
                    type: 'PERFORMANCE',
                    priority: 'MEDIUM'
                });
            }
        }

        return analysis;
    }

    private parseSuggestionsResponse(responseText: string): any[] {
        const suggestions: any[] = [];
        
        // Parsear sugerencias del texto markdown
        const suggestionMatches = responseText.matchAll(
            /## [⚡🛡️📈💡] \d+\. ([^\n]+)\n+([^#]*?)(?=##|$)/g
        );
        
        for (const match of suggestionMatches) {
            const suggestion: any = {
                message: match[1],
                description: '',
                type: 'PERFORMANCE',
                priority: 'MEDIUM'
            };
            
            // Extraer descripción y código
            const content = match[2];
            const codeMatch = content.match(/```yaml\n([\s\S]*?)\n```/);
            
            if (codeMatch) {
                suggestion.code = codeMatch[1];
                suggestion.description = content.replace(codeMatch[0], '').trim();
            } else {
                suggestion.description = content.trim();
            }
            
            // Determinar tipo basado en el ícono
            if (match[0].includes('⚡')) suggestion.type = 'PERFORMANCE';
            else if (match[0].includes('🛡️')) suggestion.type = 'SECURITY';
            else if (match[0].includes('📈')) suggestion.type = 'QUALITY';
            
            suggestions.push(suggestion);
        }
        
        return suggestions;
    }

    private determineSeverity(section: string, type: string): string {
        if (section.includes('### 🔴 CRÍTICAS') && section.includes(type)) {
            return 'CRITICAL';
        } else if (section.includes('### 🟠 ALTAS') && section.includes(type)) {
            return 'HIGH';
        } else if (section.includes('### 🟡 MEDIAS') && section.includes(type)) {
            return 'MEDIUM';
        }
        return 'LOW';
    }

    isClientConnected(): boolean {
        return this.isConnected;
    }
}
