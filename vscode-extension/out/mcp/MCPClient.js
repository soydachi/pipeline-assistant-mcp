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
exports.MCPClient = void 0;
const vscode = __importStar(require("vscode"));
const child_process_1 = require("child_process");
/**
 * MCP Client for VS Code Extension
 * Simplified version for compilation
 */
class MCPClient {
    constructor(context) {
        this.serverProcess = null;
        this.isConnected = false;
        this.context = context;
    }
    async connect() {
        try {
            const config = vscode.workspace.getConfiguration('pipelineAssistant');
            let serverPath = config.get('mcpServerPath');
            if (!serverPath) {
                serverPath = this.context.asAbsolutePath('../dist/src/server.js');
            }
            this.serverProcess = (0, child_process_1.spawn)('node', [serverPath], {
                stdio: ['pipe', 'pipe', 'pipe'],
                env: {
                    ...process.env,
                    WIKI_PATH: config.get('wikiPath', './wiki/standards')
                }
            });
            this.serverProcess.on('error', (error) => {
                console.error('Error starting MCP server:', error);
                vscode.window.showErrorMessage(`Error starting MCP server: ${error.message}`);
            });
            this.serverProcess.stderr?.on('data', (data) => {
                console.error('MCP Server Error:', data.toString());
            });
            this.isConnected = true;
            vscode.window.showInformationMessage('Pipeline Assistant MCP connected');
        }
        catch (error) {
            console.error('Error connecting to MCP server:', error);
            vscode.window.showErrorMessage(`Failed to connect to MCP server: ${error.message}`);
            throw error;
        }
    }
    async disconnect() {
        if (this.serverProcess) {
            this.serverProcess.kill();
            this.serverProcess = null;
        }
        this.isConnected = false;
    }
    async generatePipeline(options) {
        if (!this.isConnected) {
            throw new Error('MCP client not connected');
        }
        // Simplified implementation
        return `# Generated Pipeline for ${options.projectType}\n# Environment: ${options.environment}\n# Services: ${options.services.join(', ')}`;
    }
    async analyzePipeline(yamlContent, strictMode = false) {
        if (!this.isConnected) {
            throw new Error('MCP client not connected');
        }
        // Simplified implementation
        return {
            score: 75,
            violations: []
        };
    }
    async suggestImprovements(yamlContent, focus = ['security', 'performance']) {
        if (!this.isConnected) {
            throw new Error('MCP client not connected');
        }
        // Simplified implementation
        return {
            suggestions: []
        };
    }
    getConnectionStatus() {
        return this.isConnected;
    }
}
exports.MCPClient = MCPClient;
//# sourceMappingURL=MCPClient.js.map