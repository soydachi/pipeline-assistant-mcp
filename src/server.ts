#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { WikiParser } from './wiki-parser.js';
import { PipelineGenerator } from './pipeline-generator.js';
import { PipelineAnalyzer } from './pipeline-analyzer.js';

class PipelineAssistantServer {
  private server: Server;
  private wikiParser: WikiParser;
  private generator: PipelineGenerator;
  private analyzer: PipelineAnalyzer;

  constructor() {
    this.wikiParser = new WikiParser('./wiki/standards');
    this.generator = new PipelineGenerator(this.wikiParser);
    this.analyzer = new PipelineAnalyzer(this.wikiParser);

    this.server = new Server(
      {
        name: 'pipeline-assistant',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'generate_pipeline',
          description: 'Genera un pipeline CI/CD basado en estándares corporativos de la wiki',
          inputSchema: {
            type: 'object',
            properties: {
              projectType: {
                type: 'string',
                description: 'Tipo de proyecto',
                enum: ['dotnet', 'node', 'python'],
              },
              services: {
                type: 'array',
                description: 'Servicios adicionales requeridos',
                items: { type: 'string' },
                default: [],
              },
              environment: {
                type: 'string',
                description: 'Ambiente target',
                enum: ['dev', 'staging', 'prod'],
                default: 'dev',
              },
              usesDocker: {
                type: 'boolean',
                description: 'Si el proyecto usa Docker/contenedores',
                default: false,
              },
              enforceAllPolicies: {
                type: 'boolean',
                description: 'Aplicar todas las políticas de seguridad obligatorias',
                default: true,
              },
            },
            required: ['projectType'],
          },
        },
        {
          name: 'analyze_pipeline',
          description: 'Analiza un pipeline YAML existente contra los estándares',
          inputSchema: {
            type: 'object',
            properties: {
              yamlContent: {
                type: 'string',
                description: 'Contenido del pipeline YAML',
              },
              strictMode: {
                type: 'boolean',
                description: 'Aplicar validación estricta',
                default: false,
              },
            },
            required: ['yamlContent'],
          },
        },
        {
          name: 'suggest_improvements',
          description: 'Sugiere mejoras para un pipeline existente',
          inputSchema: {
            type: 'object',
            properties: {
              yamlContent: {
                type: 'string',
                description: 'Contenido del pipeline YAML',
              },
              focus: {
                type: 'array',
                description: 'Áreas de enfoque para mejoras',
                items: {
                  type: 'string',
                  enum: ['security', 'performance', 'compliance', 'quality'],
                },
                default: ['security', 'performance'],
              },
            },
            required: ['yamlContent'],
          },
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'generate_pipeline':
            return await this.handleGeneratePipeline(args);
          case 'analyze_pipeline':
            return await this.handleAnalyzePipeline(args);
          case 'suggest_improvements':
            return await this.handleSuggestImprovements(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
        };
      }
    });
  }

  private async handleGeneratePipeline(args: any) {
    const { 
      projectType, 
      services = [], 
      environment = 'dev',
      usesDocker = false,
      enforceAllPolicies = true
    } = args;
    
    // Cargar estándares desde la wiki
    await this.wikiParser.loadStandards();
    const standards = await this.wikiParser.getStandardsForProject(projectType);
    
    // Generar pipeline con políticas aplicadas
    const pipeline = await this.generator.generatePipeline({
      projectType,
      services,
      environment,
      standards,
      usesDocker,
      enforceAllPolicies
    });

    return {
      content: [
        {
          type: 'text',
          text: pipeline,
        },
      ],
    };
  }

  private async handleAnalyzePipeline(args: any) {
    const { yamlContent, strictMode = false, projectType } = args;
    
    // Cargar estándares
    await this.wikiParser.loadStandards();
    
    // Analizar pipeline con todas las opciones
    const analysis = await this.analyzer.analyze(yamlContent, { 
      strictMode,
      projectType,
      checkSecurity: true,
      checkPerformance: true,
      checkCompliance: true
    });
    
    // Formatear respuesta detallada
    const response = this.formatAnalysisResponse(analysis);
    
    return {
      content: [
        {
          type: 'text',
          text: response,
        },
      ],
    };
  }

  private async handleSuggestImprovements(args: any) {
    const { yamlContent, focus = ['security', 'performance'] } = args;
    
    // Analizar y generar sugerencias
    const suggestions = await this.analyzer.suggestImprovements(yamlContent, focus);
    
    return {
      content: [
        {
          type: 'text',
          text: this.formatSuggestions(suggestions),
        },
      ],
    };
  }

  private formatAnalysisResponse(analysis: any): string {
    let response = '# 📋 Análisis de Pipeline\n\n';
    
    // Score y resumen
    const scoreEmoji = analysis.score >= 80 ? '🟢' : 
                       analysis.score >= 60 ? '🟡' : 
                       analysis.score >= 40 ? '🟠' : '🔴';
    
    response += `## Score de Compliance: ${scoreEmoji} ${analysis.score}%\n\n`;
    
    response += `### 📊 Resumen\n`;
    response += `- **Total de problemas**: ${analysis.summary.totalIssues}\n`;
    response += `- **Críticos**: ${analysis.summary.criticalCount}\n`;
    response += `- **Altos**: ${analysis.summary.highCount}\n`;
    response += `- **Medios**: ${analysis.summary.mediumCount}\n`;
    response += `- **Bajos**: ${analysis.summary.lowCount}\n\n`;
    
    // Violations
    if (analysis.violations.length > 0) {
      response += '## ❌ Violaciones\n\n';
      
      // Agrupar por severidad
      const critical = analysis.violations.filter((v: any) => v.severity === 'CRITICAL');
      const high = analysis.violations.filter((v: any) => v.severity === 'HIGH');
      const medium = analysis.violations.filter((v: any) => v.severity === 'MEDIUM');
      const low = analysis.violations.filter((v: any) => v.severity === 'LOW');
      
      if (critical.length > 0) {
        response += '### 🔴 CRÍTICAS\n';
        critical.forEach((v: any) => {
          response += `- **[${v.type}]** Línea ${v.line}: ${v.message}\n`;
          if (v.rule) response += `  - Regla: \`${v.rule}\`\n`;
          if (v.suggestion) response += `  - 💡 ${v.suggestion}\n`;
          if (v.code) {
            response += '  - Código sugerido:\n';
            response += '  ```yaml\n';
            v.code.split('\n').forEach((line: string) => {
              response += '  ' + line + '\n';
            });
            response += '  ```\n';
          }
        });
        response += '\n';
      }
      
      if (high.length > 0) {
        response += '### 🟠 ALTAS\n';
        high.forEach((v: any) => {
          response += `- **[${v.type}]** Línea ${v.line}: ${v.message}\n`;
          if (v.suggestion) response += `  - 💡 ${v.suggestion}\n`;
        });
        response += '\n';
      }
      
      if (medium.length > 0) {
        response += '### 🟡 MEDIAS\n';
        medium.forEach((v: any) => {
          response += `- **[${v.type}]** Línea ${v.line}: ${v.message}\n`;
        });
        response += '\n';
      }
    }
    
    // Warnings
    if (analysis.warnings.length > 0) {
      response += '## ⚠️ Warnings\n\n';
      analysis.warnings.forEach((w: any) => {
        response += `- **[${w.type}]** Línea ${w.line}: ${w.message}\n`;
        if (w.suggestion) response += `  - 💡 ${w.suggestion}\n`;
      });
      response += '\n';
    }
    
    // Suggestions
    if (analysis.suggestions.length > 0) {
      response += '## 💡 Sugerencias de Mejora\n\n';
      
      // Agrupar por tipo
      const performance = analysis.suggestions.filter((s: any) => s.type === 'PERFORMANCE');
      const security = analysis.suggestions.filter((s: any) => s.type === 'SECURITY');
      const quality = analysis.suggestions.filter((s: any) => s.type === 'QUALITY');
      
      if (performance.length > 0) {
        response += '### ⚡ Rendimiento\n';
        performance.forEach((s: any) => {
          const priorityEmoji = s.priority === 'HIGH' ? '🔴' : 
                               s.priority === 'MEDIUM' ? '🟠' : '🟢';
          response += `- ${priorityEmoji} ${s.message}\n`;
          if (s.description) response += `  - ${s.description}\n`;
          if (s.code) {
            response += '  ```yaml\n';
            s.code.split('\n').forEach((line: string) => {
              response += '  ' + line + '\n';
            });
            response += '  ```\n';
          }
        });
        response += '\n';
      }
      
      if (security.length > 0) {
        response += '### 🛡️ Seguridad\n';
        security.forEach((s: any) => {
          response += `- ${s.message}\n`;
          if (s.description) response += `  - ${s.description}\n`;
        });
        response += '\n';
      }
      
      if (quality.length > 0) {
        response += '### 📈 Calidad\n';
        quality.forEach((s: any) => {
          response += `- ${s.message}\n`;
          if (s.description) response += `  - ${s.description}\n`;
        });
        response += '\n';
      }
    }
    
    // Acciones recomendadas
    response += '## 🎯 Acciones Recomendadas\n\n';
    
    if (analysis.summary.criticalCount > 0) {
      response += '1. **🔴 URGENTE**: Resolver todas las violaciones críticas inmediatamente\n';
    }
    if (analysis.summary.highCount > 0) {
      response += '2. **🟠 IMPORTANTE**: Abordar las violaciones altas antes del próximo release\n';
    }
    if (analysis.score < 60) {
      response += '3. **📈 MEJORA**: Implementar las sugerencias para alcanzar un score mínimo del 80%\n';
    }
    
    // Footer con enlace a documentación
    response += '\n---\n';
    response += '*Para más información, consulte la [wiki de estándares](wiki/standards/pipeline-standards.md)*\n';
    
    return response;
  }

  private formatSuggestions(suggestions: any[]): string {
    let response = '# 🚀 Sugerencias de Mejora\n\n';
    
    suggestions.forEach((s) => {
      response += `## ${s.category}\n\n`;
      response += `${s.description}\n\n`;
      if (s.code) {
        response += '```yaml\n' + s.code + '\n```\n\n';
      }
    });
    
    return response;
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Pipeline Assistant MCP Server started');
  }
}

// Start server
const server = new PipelineAssistantServer();
server.start().catch(console.error);
