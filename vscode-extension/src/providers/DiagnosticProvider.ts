import * as vscode from 'vscode';
import { MCPClient } from '../mcp/MCPClient';

export class DiagnosticProvider {
    private diagnosticCollection: vscode.DiagnosticCollection;
    private mcpClient: MCPClient;

    constructor(mcpClient: MCPClient, diagnosticCollection: vscode.DiagnosticCollection) {
        this.mcpClient = mcpClient;
        this.diagnosticCollection = diagnosticCollection;
    }

    updateDiagnostics(document: vscode.TextDocument, analysis: any): void {
        const diagnostics: vscode.Diagnostic[] = [];

        // Procesar violaciones
        if (analysis.violations) {
            analysis.violations.forEach((violation: any) => {
                const line = Math.max(0, (violation.line || 1) - 1);
                const range = new vscode.Range(line, 0, line, Number.MAX_VALUE);
                
                const severity = this.getSeverity(violation.severity);
                const diagnostic = new vscode.Diagnostic(
                    range,
                    violation.message,
                    severity
                );

                // Agregar código de error
                diagnostic.code = violation.type;
                diagnostic.source = 'Pipeline Assistant';

                // Agregar información adicional
                if (violation.rule) {
                    diagnostic.code = `${violation.type} (${violation.rule})`;
                }

                // Agregar tags si es apropiado
                if (violation.type === 'HARDCODED_SECRET') {
                    diagnostic.tags = [vscode.DiagnosticTag.Deprecated];
                }

                // Información relacionada
                const relatedInfo: vscode.DiagnosticRelatedInformation[] = [];
                
                if (violation.suggestion) {
                    relatedInfo.push(
                        new vscode.DiagnosticRelatedInformation(
                            new vscode.Location(document.uri, range),
                            `💡 Sugerencia: ${violation.suggestion}`
                        )
                    );
                }

                if (violation.code) {
                    // Guardar el código sugerido en los datos del diagnóstico
                    (diagnostic as any).suggestedCode = violation.code;
                }

                diagnostic.relatedInformation = relatedInfo;
                diagnostics.push(diagnostic);
            });
        }

        // Procesar warnings
        if (analysis.warnings) {
            analysis.warnings.forEach((warning: any) => {
                const line = Math.max(0, (warning.line || 1) - 1);
                const range = new vscode.Range(line, 0, line, Number.MAX_VALUE);
                
                const diagnostic = new vscode.Diagnostic(
                    range,
                    warning.message,
                    vscode.DiagnosticSeverity.Warning
                );

                diagnostic.code = warning.type;
                diagnostic.source = 'Pipeline Assistant';

                if (warning.suggestion) {
                    diagnostic.relatedInformation = [
                        new vscode.DiagnosticRelatedInformation(
                            new vscode.Location(document.uri, range),
                            `💡 ${warning.suggestion}`
                        )
                    ];
                }

                diagnostics.push(diagnostic);
            });
        }

        // Procesar sugerencias como hints
        if (analysis.suggestions) {
            analysis.suggestions.forEach((suggestion: any) => {
                // Las sugerencias generalmente no tienen línea específica
                const range = new vscode.Range(0, 0, 0, 0);
                
                const diagnostic = new vscode.Diagnostic(
                    range,
                    `💡 ${suggestion.message}`,
                    vscode.DiagnosticSeverity.Hint
                );

                diagnostic.code = suggestion.type;
                diagnostic.source = 'Pipeline Assistant';

                if (suggestion.description) {
                    diagnostic.relatedInformation = [
                        new vscode.DiagnosticRelatedInformation(
                            new vscode.Location(document.uri, range),
                            suggestion.description
                        )
                    ];
                }

                diagnostics.push(diagnostic);
            });
        }

        // Actualizar la colección de diagnósticos
        this.diagnosticCollection.set(document.uri, diagnostics);

        // Mostrar resumen en la barra de estado
        this.showSummary(analysis);
    }

    private getSeverity(severity: string): vscode.DiagnosticSeverity {
        switch (severity) {
            case 'CRITICAL':
            case 'HIGH':
                return vscode.DiagnosticSeverity.Error;
            case 'MEDIUM':
                return vscode.DiagnosticSeverity.Warning;
            case 'LOW':
                return vscode.DiagnosticSeverity.Information;
            default:
                return vscode.DiagnosticSeverity.Hint;
        }
    }

    private showSummary(analysis: any): void {
        const score = analysis.score || 0;
        const emoji = score >= 80 ? '🟢' : score >= 60 ? '🟡' : '🔴';
        
        const message = `Pipeline Score: ${emoji} ${score}% | ` +
                       `Críticos: ${analysis.summary?.criticalCount || 0} | ` +
                       `Altos: ${analysis.summary?.highCount || 0} | ` +
                       `Medios: ${analysis.summary?.mediumCount || 0}`;

        // Mostrar notificación si el score es muy bajo
        if (score < 40) {
            vscode.window.showWarningMessage(
                message,
                'Ver Problemas',
                'Sugerir Mejoras'
            ).then(selection => {
                if (selection === 'Ver Problemas') {
                    vscode.commands.executeCommand('workbench.actions.view.problems');
                } else if (selection === 'Sugerir Mejoras') {
                    vscode.commands.executeCommand('pipelineAssistant.suggestImprovements');
                }
            });
        } else if (score >= 80) {
            vscode.window.setStatusBarMessage(message, 5000);
        }
    }

    clear(document: vscode.TextDocument): void {
        this.diagnosticCollection.delete(document.uri);
    }

    clearAll(): void {
        this.diagnosticCollection.clear();
    }
}
