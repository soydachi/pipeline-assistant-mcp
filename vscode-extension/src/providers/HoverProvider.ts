import * as vscode from 'vscode';
import { MCPClient } from '../mcp/MCPClient';

export class HoverProvider implements vscode.HoverProvider {
    private mcpClient: MCPClient;
    private taskDocumentation: Map<string, string> = new Map();

    constructor(mcpClient: MCPClient) {
        this.mcpClient = mcpClient;
        this.initializeDocumentation();
    }

    private initializeDocumentation() {
        // Documentación para tareas de seguridad
        this.taskDocumentation.set('TruffleHog@1', `
### 🔐 TruffleHog - Escaneo de Secretos

**Política:** SEC-001 (OBLIGATORIO)

Escanea el código fuente en busca de secretos hardcodeados como:
- Passwords
- API Keys
- Tokens
- Connection Strings
- Certificados

**Configuración recomendada:**
\`\`\`yaml
failOnSecrets: true  # Falla el build si encuentra secretos
depth: 50            # Profundidad de búsqueda en el historial git
maxSecrets: 0        # No tolerar ningún secreto
\`\`\`

⚠️ **Importante:** Esta tarea es obligatoria según las políticas de seguridad corporativas.
        `);

        this.taskDocumentation.set('SonarQubePrepare@5', `
### 📊 SonarQube - Análisis Estático (SAST)

**Política:** SEC-002 (OBLIGATORIO)

Realiza análisis estático del código para detectar:
- Vulnerabilidades de seguridad
- Bugs
- Code Smells
- Deuda técnica
- Cobertura de código

**Quality Gates obligatorios:**
- Coverage: > 80%
- Bugs: 0 nuevos
- Vulnerabilities: 0 críticas o altas
- Technical Debt: < 5 días

[Ver documentación completa](https://docs.sonarqube.org/latest/)
        `);

        this.taskDocumentation.set('SnykSecurityScan@1', `
### 📦 Snyk - Escaneo de Dependencias

**Política:** SEC-003 (OBLIGATORIO)

Analiza las dependencias del proyecto en busca de vulnerabilidades conocidas:
- Librerías con CVEs
- Dependencias desactualizadas
- Licencias problemáticas

**Severidad mínima:** HIGH
**Acción en caso de vulnerabilidades:** Falla el build

💡 **Tip:** Ejecutar regularmente para mantener las dependencias actualizadas.
        `);

        this.taskDocumentation.set('continueOnError', `
### ⚠️ continueOnError

**Valores:**
- \`true\`: El pipeline continúa aunque esta tarea falle
- \`false\`: El pipeline se detiene si esta tarea falla (default)

🚫 **PROHIBIDO** usar \`continueOnError: true\` en:
- Tareas de seguridad (TruffleHog, SonarQube, Snyk)
- Tests unitarios
- Validación de código

✅ **Aceptable** solo en:
- Tareas de limpieza
- Notificaciones
- Tareas no críticas
        `);

        this.taskDocumentation.set('trigger', `
### 🔄 Trigger Configuration

**Configuración de trigger del pipeline**

❌ **NUNCA** usar:
\`\`\`yaml
trigger: true  # Inseguro - se ejecuta en TODOS los cambios
\`\`\`

✅ **SIEMPRE** especificar branches:
\`\`\`yaml
trigger:
  branches:
    include:
      - main
      - develop
    exclude:
      - feature/experimental/*
  paths:
    include:
      - src/*
    exclude:
      - '*.md'
\`\`\`

💡 **Mejores prácticas:**
- Especificar branches explícitamente
- Excluir archivos de documentación
- Usar path filters para optimizar
        `);

        this.taskDocumentation.set('Cache@2', `
### ⚡ Cache Task

**Optimización de rendimiento mediante caché**

Reduce significativamente el tiempo de build cacheando:
- Dependencias de NPM/NuGet/pip
- Archivos de build intermedios
- Artefactos reutilizables

**Ejemplos:**
- NPM: ~50% reducción de tiempo
- NuGet: ~40% reducción de tiempo
- pip: ~45% reducción de tiempo

💡 **Tip:** Usar siempre para dependencias
        `);
    }

    async provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<vscode.Hover | null | undefined> {
        const range = document.getWordRangeAtPosition(position);
        if (!range) {
            return undefined;
        }

        const word = document.getText(range);
        const line = document.lineAt(position.line).text;

        // Buscar documentación para tareas
        for (const [key, doc] of this.taskDocumentation) {
            if (line.includes(key) || word === key) {
                return new vscode.Hover(new vscode.MarkdownString(doc));
            }
        }

        // Detectar patrones peligrosos y mostrar advertencias
        if (this.isDangerousPattern(line)) {
            return this.getDangerousPatternHover(line);
        }

        // Detectar variables y mostrar información de seguridad
        if (this.isVariable(line)) {
            return this.getVariableHover(line);
        }

        // Detectar stages y mostrar si son obligatorios
        if (line.includes('stage:')) {
            return this.getStageHover(word);
        }

        return undefined;
    }

    private isDangerousPattern(line: string): boolean {
        const dangerousPatterns = [
            /password\s*:\s*["'][^$][^"']+["']/i,
            /apikey\s*:\s*["'][^$][^"']+["']/i,
            /token\s*:\s*["'][^$][^"']+["']/i,
            /trigger\s*:\s*true/i,
            /continueOnError\s*:\s*true/i
        ];

        return dangerousPatterns.some(pattern => pattern.test(line));
    }

    private getDangerousPatternHover(line: string): vscode.Hover {
        let message = '';

        if (/password|apikey|token/i.test(line) && !/\$\(/.test(line)) {
            message = `
### 🚨 SECRETO HARDCODEADO DETECTADO

**Violación:** SEC-001 - No secretos en código

Este parece ser un secreto hardcodeado. **NUNCA** incluyas credenciales en el código.

**Solución inmediata:**
1. Reemplazar con: \`$(VARIABLE_NAME)\`
2. Agregar el secreto a Azure Key Vault
3. O usar un Variable Group

**Quick Fix disponible:** Presiona \`Ctrl+.\` para aplicar corrección automática.

[Ver políticas de seguridad](command:pipelineAssistant.openWiki)
            `;
        } else if (/trigger\s*:\s*true/i.test(line)) {
            message = `
### ⚠️ TRIGGER INSEGURO

**Problema:** \`trigger: true\` ejecutará el pipeline en TODOS los cambios

**Riesgo:** Alto consumo de recursos y posibles ejecuciones no deseadas

**Solución recomendada:**
\`\`\`yaml
trigger:
  branches:
    include: [main, develop]
\`\`\`

**Quick Fix disponible:** Presiona \`Ctrl+.\` para corregir
            `;
        } else if (/continueOnError\s*:\s*true/i.test(line)) {
            const isSecurityTask = /sonar|snyk|trufflehog|security/i.test(line);
            if (isSecurityTask) {
                message = `
### 🚫 BYPASS DE SEGURIDAD DETECTADO

**Violación CRÍTICA:** Nunca usar \`continueOnError: true\` en tareas de seguridad

Esto permite que el pipeline continúe aunque fallen las verificaciones de seguridad.

**Acción requerida:** Cambiar a \`continueOnError: false\` inmediatamente

**Quick Fix disponible:** Presiona \`Ctrl+.\` para corregir
                `;
            }
        }

        return new vscode.Hover(new vscode.MarkdownString(message));
    }

    private isVariable(line: string): boolean {
        return /^\s*-?\s*name:\s*/.test(line) || /value:\s*/.test(line);
    }

    private getVariableHover(line: string): vscode.Hover | undefined {
        if (line.includes('$(') && line.includes(')')) {
            const message = `
### ✅ Variable Segura

Esta variable usa la sintaxis correcta \`$(VARIABLE_NAME)\` para referencias seguras.

**Fuentes posibles:**
- Azure Key Vault
- Variable Groups
- Pipeline Variables
- Runtime Parameters

Esto evita exponer secretos en el código.
            `;
            return new vscode.Hover(new vscode.MarkdownString(message));
        } else if (/value:\s*["'][^$][^"']+["']/.test(line)) {
            const message = `
### ⚠️ Valor Hardcodeado

Considera si este valor debería ser una variable:
- Si es un secreto → Usar Key Vault
- Si cambia por ambiente → Usar Variable Groups
- Si es configurable → Usar Pipeline Parameters

**Ejemplo:**
\`\`\`yaml
value: "$(VARIABLE_NAME)"
\`\`\`
            `;
            return new vscode.Hover(new vscode.MarkdownString(message));
        }

        return undefined;
    }

    private getStageHover(stageName: string): vscode.Hover {
        const mandatoryStages = ['Validate', 'Security', 'Build', 'Test'];
        let message = `### Stage: ${stageName}\n\n`;

        if (mandatoryStages.includes(stageName)) {
            message += `✅ **Stage OBLIGATORIO** según políticas corporativas\n\n`;
            
            switch(stageName) {
                case 'Validate':
                    message += 'Validación de código y configuración antes del build';
                    break;
                case 'Security':
                    message += 'Análisis de seguridad obligatorio (SAST, secretos, dependencias)';
                    break;
                case 'Build':
                    message += 'Compilación del código fuente';
                    break;
                case 'Test':
                    message += 'Ejecución de tests unitarios e integración';
                    break;
            }
        } else {
            message += `Stage opcional - ${stageName}`;
        }

        message += `\n\n**Dependencias típicas:**\n`;
        message += `\`\`\`yaml\ndependsOn: ${this.getStageDependencies(stageName)}\n\`\`\``;

        return new vscode.Hover(new vscode.MarkdownString(message));
    }

    private getStageDependencies(stageName: string): string {
        const dependencies: { [key: string]: string } = {
            'Validate': '[]  # Primer stage, sin dependencias',
            'Security': 'Validate',
            'Build': 'Security',
            'Test': 'Build',
            'Deploy': 'Test',
            'Package': 'Test',
            'Release': '[Test, Package]  # Múltiples dependencias'
        };

        return dependencies[stageName] || 'PreviousStage';
    }
}
