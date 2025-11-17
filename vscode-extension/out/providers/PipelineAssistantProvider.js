"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WikiWebviewProvider = exports.HoverProvider = exports.CompletionProvider = exports.CodeActionProvider = exports.DiagnosticProvider = exports.PipelineAssistantProvider = void 0;
const DiagnosticProvider_1 = require("./DiagnosticProvider");
const CodeActionProvider_1 = require("./CodeActionProvider");
const CompletionProvider_1 = require("./CompletionProvider");
const HoverProvider_1 = require("./HoverProvider");
const WikiWebviewProvider_1 = require("./WikiWebviewProvider");
class PipelineAssistantProvider {
    constructor(mcpClient, diagnosticCollection, extensionUri) {
        this.mcpClient = mcpClient;
        this.diagnosticProvider = new DiagnosticProvider_1.DiagnosticProvider(mcpClient, diagnosticCollection);
        this.codeActionProvider = new CodeActionProvider_1.CodeActionProvider(mcpClient);
        this.completionProvider = new CompletionProvider_1.CompletionProvider(mcpClient);
        this.hoverProvider = new HoverProvider_1.HoverProvider(mcpClient);
        this.wikiProvider = new WikiWebviewProvider_1.WikiWebviewProvider(extensionUri);
    }
    getDiagnosticProvider() {
        return this.diagnosticProvider;
    }
    getCodeActionProvider() {
        return this.codeActionProvider;
    }
    getCompletionProvider() {
        return this.completionProvider;
    }
    getHoverProvider() {
        return this.hoverProvider;
    }
    getWikiProvider() {
        return this.wikiProvider;
    }
}
exports.PipelineAssistantProvider = PipelineAssistantProvider;
var DiagnosticProvider_2 = require("./DiagnosticProvider");
Object.defineProperty(exports, "DiagnosticProvider", { enumerable: true, get: function () { return DiagnosticProvider_2.DiagnosticProvider; } });
var CodeActionProvider_2 = require("./CodeActionProvider");
Object.defineProperty(exports, "CodeActionProvider", { enumerable: true, get: function () { return CodeActionProvider_2.CodeActionProvider; } });
var CompletionProvider_2 = require("./CompletionProvider");
Object.defineProperty(exports, "CompletionProvider", { enumerable: true, get: function () { return CompletionProvider_2.CompletionProvider; } });
var HoverProvider_2 = require("./HoverProvider");
Object.defineProperty(exports, "HoverProvider", { enumerable: true, get: function () { return HoverProvider_2.HoverProvider; } });
var WikiWebviewProvider_2 = require("./WikiWebviewProvider");
Object.defineProperty(exports, "WikiWebviewProvider", { enumerable: true, get: function () { return WikiWebviewProvider_2.WikiWebviewProvider; } });
//# sourceMappingURL=PipelineAssistantProvider.js.map