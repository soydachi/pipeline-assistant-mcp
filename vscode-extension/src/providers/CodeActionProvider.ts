import * as vscode from 'vscode';
import { MCPClient } from '../mcp/MCPClient';

export class CodeActionProvider implements vscode.CodeActionProvider {
    private mcpClient: MCPClient;

    constructor(mcpClient: MCPClient) {
        this.mcpClient = mcpClient;
    }

    provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range | vscode.Selection,
        context: vscode.CodeActionContext,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<(vscode.CodeAction | vscode.Command)[]> {
        const actions: vscode.CodeAction[] = [];

        // Procesar cada diagnóstico en el rango
        context.diagnostics.forEach(diagnostic => {
            // Solo procesar diagnósticos de Pipeline Assistant
            if (diagnostic.source !== 'Pipeline Assistant') {
                return;
            }

            // Crear acciones según el tipo de problema
            const diagnosticCode = String(diagnostic.code || '');
            
            if (diagnosticCode.includes('MISSING_MANDATORY_STAGE')) {
                actions.push(this.createAddStageAction(document, diagnostic, range));
            } else if (diagnosticCode.includes('HARDCODED_SECRET')) {
                actions.push(this.createReplaceSecretAction(document, diagnostic, range));
            } else if (diagnosticCode.includes('UNSAFE_TRIGGER')) {
                actions.push(this.createFixTriggerAction(document, diagnostic, range));
            } else if (diagnosticCode.includes('MISSING_STRUCTURE')) {
                actions.push(this.createAddStructureAction(document, diagnostic));
            } else if (diagnosticCode.includes('SECURITY_BYPASS')) {
                actions.push(this.createFixSecurityBypassAction(document, diagnostic, range));
            } else if (diagnosticCode.includes('MISSING_SECURITY_AUDIT')) {
                actions.push(this.createAddSecurityAuditAction(document, diagnostic));
            }

            // Acción genérica si hay código sugerido
            const suggestedCode = (diagnostic as any).suggestedCode;
            if (suggestedCode) {
                actions.push(this.createGenericFixAction(document, diagnostic, range, suggestedCode));
            }
        });

        // Agregar acciones de refactoring si no hay errores
        if (context.diagnostics.length === 0) {
            actions.push(this.createRefactorToStagesAction(document, range));
            actions.push(this.createAddCacheAction(document, range));
        }

        return actions;
    }

    private createAddStageAction(
        document: vscode.TextDocument,
        diagnostic: vscode.Diagnostic,
        range: vscode.Range
    ): vscode.CodeAction {
        const action = new vscode.CodeAction(
            '➕ Agregar Security Stage',
            vscode.CodeActionKind.QuickFix
        );
        
        action.edit = new vscode.WorkspaceEdit();
        
        // Buscar dónde insertar el stage
        const stagesLine = this.findStagesLine(document);
        if (stagesLine >= 0) {
            const insertPosition = this.findInsertPositionForStage(document, stagesLine);
            const newStage = `
  - stage: Security
    displayName: 'Análisis de Seguridad'
    dependsOn: Validate
    jobs:
      - job: SecurityScan
        displayName: 'Escaneo de seguridad'
        steps:
          - task: TruffleHog@1
            displayName: 'Escanear secretos'
            inputs:
              path: '$(Build.SourcesDirectory)'
              failOnSecrets: true
          - task: SonarQubePrepare@5
            displayName: 'Preparar SonarQube'
          - task: SnykSecurityScan@1
            displayName: 'Escanear dependencias'
`;
            
            action.edit.insert(
                document.uri,
                new vscode.Position(insertPosition, 0),
                newStage
            );
        }
        
        action.diagnostics = [diagnostic];
        action.isPreferred = true;
        
        return action;
    }

    private createReplaceSecretAction(
        document: vscode.TextDocument,
        diagnostic: vscode.Diagnostic,
        range: vscode.Range
    ): vscode.CodeAction {
        const action = new vscode.CodeAction(
            '🔐 Reemplazar con Azure Key Vault',
            vscode.CodeActionKind.QuickFix
        );
        
        action.edit = new vscode.WorkspaceEdit();
        
        // Obtener la línea con el secreto
        const line = document.lineAt(diagnostic.range.start.line);
        const lineText = line.text;
        
        // Detectar el nombre de la variable
        const variableMatch = lineText.match(/name:\s*(\w+)/);
        const variableName = variableMatch ? variableMatch[1] : 'secret';
        
        // Reemplazar con referencia a Key Vault
        const replacement = lineText.replace(
            /value:\s*["'][^"']+["']/,
            `value: "$(${variableName.toUpperCase()})"`
        );
        
        action.edit.replace(
            document.uri,
            line.range,
            replacement
        );
        
        // Agregar comentario explicativo
        const comment = `    # Obtener de Key Vault - agregar AzureKeyVault@2 task`;
        action.edit.insert(
            document.uri,
            new vscode.Position(line.lineNumber + 1, 0),
            comment + '\n'
        );
        
        action.diagnostics = [diagnostic];
        action.isPreferred = true;
        
        return action;
    }

    private createFixTriggerAction(
        document: vscode.TextDocument,
        diagnostic: vscode.Diagnostic,
        range: vscode.Range
    ): vscode.CodeAction {
        const action = new vscode.CodeAction(
            '🔧 Corregir configuración de trigger',
            vscode.CodeActionKind.QuickFix
        );
        
        action.edit = new vscode.WorkspaceEdit();
        
        const triggerConfig = `trigger:
  branches:
    include:
      - main
      - develop
  paths:
    exclude:
      - '*.md'
      - 'docs/*'`;
        
        // Buscar línea con trigger
        const triggerLine = this.findLineWithText(document, 'trigger:');
        if (triggerLine >= 0) {
            const line = document.lineAt(triggerLine);
            
            // Si es "trigger: true", reemplazar toda la línea
            if (line.text.includes('trigger: true')) {
                action.edit.replace(
                    document.uri,
                    line.range,
                    triggerConfig
                );
            }
        }
        
        action.diagnostics = [diagnostic];
        action.isPreferred = true;
        
        return action;
    }

    private createAddStructureAction(
        document: vscode.TextDocument,
        diagnostic: vscode.Diagnostic
    ): vscode.CodeAction {
        const action = new vscode.CodeAction(
            '📋 Agregar estructura de stages',
            vscode.CodeActionKind.QuickFix
        );
        
        action.edit = new vscode.WorkspaceEdit();
        
        const stagesTemplate = `
stages:
  - stage: Validate
    displayName: 'Validación'
    jobs:
      - job: ValidateJob
        steps:
          - checkout: self
          - script: echo "Validating..."
          
  - stage: Security
    displayName: 'Seguridad'
    dependsOn: Validate
    jobs:
      - job: SecurityScan
        steps:
          - task: TruffleHog@1
          
  - stage: Build
    displayName: 'Build'
    dependsOn: Security
    jobs:
      - job: BuildJob
        steps:
          - script: echo "Building..."
          
  - stage: Test
    displayName: 'Test'
    dependsOn: Build
    jobs:
      - job: TestJob
        steps:
          - script: echo "Testing..."
`;
        
        // Insertar después del trigger o al final
        const insertLine = Math.max(
            this.findLineWithText(document, 'trigger:') + 5,
            this.findLineWithText(document, 'variables:') + 10,
            10
        );
        
        action.edit.insert(
            document.uri,
            new vscode.Position(insertLine, 0),
            stagesTemplate
        );
        
        action.diagnostics = [diagnostic];
        action.isPreferred = true;
        
        return action;
    }

    private createFixSecurityBypassAction(
        document: vscode.TextDocument,
        diagnostic: vscode.Diagnostic,
        range: vscode.Range
    ): vscode.CodeAction {
        const action = new vscode.CodeAction(
            '⚠️ Remover continueOnError de tarea de seguridad',
            vscode.CodeActionKind.QuickFix
        );
        
        action.edit = new vscode.WorkspaceEdit();
        
        // Buscar y eliminar continueOnError: true
        const line = document.lineAt(diagnostic.range.start.line);
        const newText = line.text.replace(/continueOnError:\s*true/i, 'continueOnError: false');
        
        if (newText !== line.text) {
            action.edit.replace(
                document.uri,
                line.range,
                newText
            );
        }
        
        action.diagnostics = [diagnostic];
        action.isPreferred = true;
        
        return action;
    }

    private createAddSecurityAuditAction(
        document: vscode.TextDocument,
        diagnostic: vscode.Diagnostic
    ): vscode.CodeAction {
        const action = new vscode.CodeAction(
            '🔒 Agregar npm audit',
            vscode.CodeActionKind.QuickFix
        );
        
        action.edit = new vscode.WorkspaceEdit();
        
        // Buscar dónde está npm install o npm ci
        const npmInstallLine = this.findLineWithText(document, 'npm install') || 
                              this.findLineWithText(document, 'npm ci');
        
        if (npmInstallLine >= 0) {
            const auditStep = `
          - script: npm audit --audit-level=high
            displayName: 'Security audit'
            continueOnError: false
`;
            
            action.edit.insert(
                document.uri,
                new vscode.Position(npmInstallLine + 1, 0),
                auditStep
            );
        }
        
        action.diagnostics = [diagnostic];
        
        return action;
    }

    private createGenericFixAction(
        document: vscode.TextDocument,
        diagnostic: vscode.Diagnostic,
        range: vscode.Range,
        suggestedCode: string
    ): vscode.CodeAction {
        const action = new vscode.CodeAction(
            `✨ Aplicar corrección sugerida`,
            vscode.CodeActionKind.QuickFix
        );
        
        action.edit = new vscode.WorkspaceEdit();
        
        // Insertar el código sugerido
        if (diagnostic.range.start.line === diagnostic.range.end.line) {
            // Reemplazar línea actual
            action.edit.replace(
                document.uri,
                document.lineAt(diagnostic.range.start.line).range,
                suggestedCode
            );
        } else {
            // Insertar después de la línea actual
            action.edit.insert(
                document.uri,
                new vscode.Position(diagnostic.range.end.line + 1, 0),
                '\n' + suggestedCode + '\n'
            );
        }
        
        action.diagnostics = [diagnostic];
        
        return action;
    }

    private createRefactorToStagesAction(
        document: vscode.TextDocument,
        range: vscode.Range
    ): vscode.CodeAction {
        const action = new vscode.CodeAction(
            '♻️ Refactorizar a estructura multi-stage',
            vscode.CodeActionKind.Refactor
        );
        
        action.command = {
            title: 'Refactorizar a stages',
            command: 'pipelineAssistant.refactorToStages',
            arguments: [document, range]
        };
        
        return action;
    }

    private createAddCacheAction(
        document: vscode.TextDocument,
        range: vscode.Range
    ): vscode.CodeAction {
        const action = new vscode.CodeAction(
            '⚡ Agregar caché para dependencias',
            vscode.CodeActionKind.RefactorExtract
        );
        
        action.command = {
            title: 'Agregar caché',
            command: 'pipelineAssistant.addCache',
            arguments: [document, range]
        };
        
        return action;
    }

    // Métodos auxiliares
    private findStagesLine(document: vscode.TextDocument): number {
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes('stages:')) {
                return i;
            }
        }
        return -1;
    }

    private findLineWithText(document: vscode.TextDocument, text: string): number {
        for (let i = 0; i < document.lineCount; i++) {
            if (document.lineAt(i).text.includes(text)) {
                return i;
            }
        }
        return -1;
    }

    private findInsertPositionForStage(document: vscode.TextDocument, stagesLine: number): number {
        // Buscar dónde insertar el nuevo stage (después de Validate si existe)
        for (let i = stagesLine + 1; i < document.lineCount; i++) {
            const line = document.lineAt(i).text;
            if (line.includes('- stage: Build')) {
                return i; // Insertar antes de Build
            }
            if (line.includes('- stage:') && !line.includes('Validate')) {
                return i; // Insertar antes del siguiente stage
            }
        }
        return stagesLine + 1; // Insertar después de stages:
    }
}
