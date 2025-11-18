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
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
/**
 * MCP Client for VS Code Extension
 * Uses the bundled CLI for pipeline analysis and generation
 */
class MCPClient {
    constructor(context) {
        this.isConnected = false;
        this.cliPath = '';
        this.context = context;
    }
    async connect() {
        // Find the bundled CLI
        const extensionPath = this.context.extensionPath;
        const bundledCli = path.join(extensionPath, 'core', 'dist', 'cli', 'pipeline-assistant.js');
        if (fs.existsSync(bundledCli)) {
            this.cliPath = bundledCli;
        }
        else {
            // Fallback for development
            const devCli = path.join(extensionPath, '..', 'dist', 'cli', 'pipeline-assistant.js');
            if (fs.existsSync(devCli)) {
                this.cliPath = devCli;
            }
        }
        if (!this.cliPath) {
            throw new Error('Pipeline Assistant CLI not found. Extension may not be properly installed.');
        }
        this.isConnected = true;
        vscode.window.showInformationMessage('Pipeline Assistant connected');
    }
    async disconnect() {
        this.isConnected = false;
    }
    async generatePipeline(options) {
        if (!this.isConnected) {
            throw new Error('Pipeline Assistant not connected');
        }
        // Create temp file for output
        const tempFile = path.join(os.tmpdir(), `pipeline-${Date.now()}.yml`);
        try {
            const args = [
                this.cliPath,
                'generate',
                '--platform', 'azure-devops',
                '--type', options.projectType,
                '--env', options.environment,
                '--output', tempFile
            ];
            if (options.services.length > 0) {
                args.push('--services', options.services.join(','));
            }
            await this.runCli(args);
            // Read generated pipeline
            const content = fs.readFileSync(tempFile, 'utf-8');
            return content;
        }
        finally {
            // Cleanup
            if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
            }
        }
    }
    async analyzePipeline(yamlContent, strictMode = false) {
        if (!this.isConnected) {
            throw new Error('Pipeline Assistant not connected');
        }
        // Write content to temp file
        const tempFile = path.join(os.tmpdir(), `analyze-${Date.now()}.yml`);
        try {
            fs.writeFileSync(tempFile, yamlContent);
            const args = [
                this.cliPath,
                'analyze',
                '-f', tempFile,
                '--json'
            ];
            if (strictMode) {
                args.push('--strict');
            }
            const result = await this.runCli(args);
            // Parse JSON output
            const analysis = JSON.parse(result);
            // Convert to expected format
            const violations = [];
            // Add security issues
            if (analysis.securityIssues) {
                for (const issue of analysis.securityIssues) {
                    violations.push({
                        severity: issue.severity || 'HIGH',
                        message: `[${issue.ruleId || 'SEC'}] ${issue.message}`,
                        line: issue.line || 1
                    });
                }
            }
            // Add policy violations
            if (analysis.policyViolations) {
                for (const violation of analysis.policyViolations) {
                    violations.push({
                        severity: violation.severity || 'CRITICAL',
                        message: `[${violation.policyId || 'POL'}] ${violation.message}`,
                        line: violation.line || 1
                    });
                }
            }
            // Add best practice violations
            if (analysis.bestPracticeViolations) {
                for (const bp of analysis.bestPracticeViolations) {
                    violations.push({
                        severity: bp.severity || 'MEDIUM',
                        message: bp.message,
                        line: bp.line || 1
                    });
                }
            }
            return {
                score: analysis.complianceScore || 0,
                violations
            };
        }
        finally {
            // Cleanup
            if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
            }
        }
    }
    async suggestImprovements(yamlContent, focus = ['security', 'performance']) {
        if (!this.isConnected) {
            throw new Error('Pipeline Assistant not connected');
        }
        // Use analyze to get suggestions
        const result = await this.analyzePipeline(yamlContent, false);
        // Convert violations to suggestions
        const suggestions = [];
        for (const violation of result.violations) {
            const category = violation.message.includes('SEC') ? 'security' :
                violation.message.includes('POL') ? 'compliance' :
                    violation.message.includes('PERF') ? 'performance' : 'quality';
            if (focus.includes(category) || focus.includes('all')) {
                suggestions.push({
                    category,
                    message: violation.message
                });
            }
        }
        return { suggestions };
    }
    runCli(args) {
        return new Promise((resolve, reject) => {
            // Get the core root where package.json is located
            const coreRoot = path.join(path.dirname(this.cliPath), '..', '..');
            const childProcess = (0, child_process_1.spawn)('node', args, {
                cwd: coreRoot,
                env: {
                    ...process.env,
                    WIKI_PATH: path.join(coreRoot, 'wiki', 'standards')
                }
            });
            let stdout = '';
            let stderr = '';
            childProcess.stdout?.on('data', (data) => {
                stdout += data.toString();
            });
            childProcess.stderr?.on('data', (data) => {
                stderr += data.toString();
            });
            childProcess.on('error', (error) => {
                reject(error);
            });
            childProcess.on('close', (code) => {
                if (code === 0 || stdout.trim().startsWith('{')) {
                    // Success or JSON output (even with non-zero exit for violations)
                    resolve(stdout);
                }
                else {
                    reject(new Error(stderr || `CLI exited with code ${code}`));
                }
            });
        });
    }
    getConnectionStatus() {
        return this.isConnected;
    }
}
exports.MCPClient = MCPClient;
//# sourceMappingURL=MCPClient.js.map