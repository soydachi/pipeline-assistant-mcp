import * as vscode from 'vscode';
import * as path from 'path';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';

/**
 * MCP Client for VS Code Extension
 * Uses the bundled CLI for pipeline analysis and generation
 */
export class MCPClient {
    private context: vscode.ExtensionContext;
    private isConnected: boolean = false;
    private cliPath: string = '';

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    async connect(): Promise<void> {
        // Find the bundled CLI
        const extensionPath = this.context.extensionPath;
        const bundledCli = path.join(extensionPath, 'core', 'dist', 'cli', 'pipeline-assistant.js');

        if (fs.existsSync(bundledCli)) {
            this.cliPath = bundledCli;
        } else {
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

    async disconnect(): Promise<void> {
        this.isConnected = false;
    }

    async generatePipeline(options: {
        projectType: string;
        services: string[];
        environment: string;
    }): Promise<string> {
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
        } finally {
            // Cleanup
            if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
            }
        }
    }

    async analyzePipeline(yamlContent: string, strictMode: boolean = false): Promise<{
        score: number;
        violations: Array<{
            severity: string;
            message: string;
            line?: number;
        }>;
    }> {
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
            const violations: Array<{
                severity: string;
                message: string;
                line?: number;
            }> = [];

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
        } finally {
            // Cleanup
            if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
            }
        }
    }

    async suggestImprovements(yamlContent: string, focus: string[] = ['security', 'performance']): Promise<{
        suggestions: Array<{
            category: string;
            message: string;
            example?: string;
        }>;
    }> {
        if (!this.isConnected) {
            throw new Error('Pipeline Assistant not connected');
        }

        // Use analyze to get suggestions
        const result = await this.analyzePipeline(yamlContent, false);

        // Convert violations to suggestions
        const suggestions: Array<{
            category: string;
            message: string;
            example?: string;
        }> = [];

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

    private runCli(args: string[]): Promise<string> {
        return new Promise((resolve, reject) => {
            // Get the core root where package.json is located
            const coreRoot = path.join(path.dirname(this.cliPath), '..', '..');

            const childProcess = spawn('node', args, {
                cwd: coreRoot,
                env: {
                    ...process.env,
                    WIKI_PATH: path.join(coreRoot, 'wiki', 'standards')
                }
            });

            let stdout = '';
            let stderr = '';

            childProcess.stdout?.on('data', (data: Buffer) => {
                stdout += data.toString();
            });

            childProcess.stderr?.on('data', (data: Buffer) => {
                stderr += data.toString();
            });

            childProcess.on('error', (error: Error) => {
                reject(error);
            });

            childProcess.on('close', (code: number | null) => {
                if (code === 0 || stdout.trim().startsWith('{')) {
                    // Success or JSON output (even with non-zero exit for violations)
                    resolve(stdout);
                } else {
                    reject(new Error(stderr || `CLI exited with code ${code}`));
                }
            });
        });
    }

    getConnectionStatus(): boolean {
        return this.isConnected;
    }
}
