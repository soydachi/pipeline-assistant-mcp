import * as vscode from 'vscode';
import { MCPClient } from '../mcp/MCPClient';
import { DiagnosticProvider } from './DiagnosticProvider';
import { CodeActionProvider } from './CodeActionProvider';
import { CompletionProvider } from './CompletionProvider';
import { HoverProvider } from './HoverProvider';
import { WikiWebviewProvider } from './WikiWebviewProvider';

export class PipelineAssistantProvider {
    private mcpClient: MCPClient;
    private diagnosticProvider: DiagnosticProvider;
    private codeActionProvider: CodeActionProvider;
    private completionProvider: CompletionProvider;
    private hoverProvider: HoverProvider;
    private wikiProvider: WikiWebviewProvider;

    constructor(
        mcpClient: MCPClient,
        diagnosticCollection: vscode.DiagnosticCollection,
        extensionUri: vscode.Uri
    ) {
        this.mcpClient = mcpClient;
        this.diagnosticProvider = new DiagnosticProvider(mcpClient, diagnosticCollection);
        this.codeActionProvider = new CodeActionProvider(mcpClient);
        this.completionProvider = new CompletionProvider(mcpClient);
        this.hoverProvider = new HoverProvider(mcpClient);
        this.wikiProvider = new WikiWebviewProvider(extensionUri);
    }

    getDiagnosticProvider(): DiagnosticProvider {
        return this.diagnosticProvider;
    }

    getCodeActionProvider(): CodeActionProvider {
        return this.codeActionProvider;
    }

    getCompletionProvider(): CompletionProvider {
        return this.completionProvider;
    }

    getHoverProvider(): HoverProvider {
        return this.hoverProvider;
    }

    getWikiProvider(): WikiWebviewProvider {
        return this.wikiProvider;
    }
}

export { DiagnosticProvider } from './DiagnosticProvider';
export { CodeActionProvider } from './CodeActionProvider';
export { CompletionProvider } from './CompletionProvider';
export { HoverProvider } from './HoverProvider';
export { WikiWebviewProvider } from './WikiWebviewProvider';
