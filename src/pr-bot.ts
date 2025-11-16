import { Octokit } from '@octokit/rest';
import { PipelineAnalyzer } from '../pipeline-analyzer';
import { WikiParser } from '../wiki-parser';
import { PolicyEnforcer } from '../policy-enforcer';

export interface PRAnalysisConfig {
  githubToken: string;
  owner: string;
  repo: string;
  pullNumber: number;
  strictMode?: boolean;
  enforcementMode?: 'learning' | 'enforcement';
  baseBranch?: string;
}

export interface FileAnalysis {
  path: string;
  score: number;
  violations: any[];
  warnings: any[];
  suggestions: any[];
}

export interface PRAnalysisResult {
  overallScore: number;
  files: FileAnalysis[];
  summary: {
    totalFiles: number;
    filesWithIssues: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
  };
  trend?: {
    scoreChange: number;
    issuesResolved: number;
    newIssues: number;
  };
}

export class PRBot {
  private octokit: Octokit;
  private analyzer: PipelineAnalyzer;
  private config: PRAnalysisConfig;
  private wikiParser: WikiParser;
  private policyEnforcer: PolicyEnforcer;

  constructor(config: PRAnalysisConfig) {
    this.config = config;
    this.octokit = new Octokit({
      auth: config.githubToken,
    });
    
    this.wikiParser = new WikiParser('./wiki/standards');
    this.analyzer = new PipelineAnalyzer(this.wikiParser);
    this.policyEnforcer = new PolicyEnforcer(this.wikiParser);
  }

  async analyzePR(): Promise<PRAnalysisResult> {
    // Cargar estándares y políticas
    await this.wikiParser.loadStandards();
    await this.policyEnforcer.loadPolicies();

    // Obtener archivos modificados
    const files = await this.getChangedFiles();
    
    // Filtrar solo archivos YAML de pipelines
    const pipelineFiles = files.filter(f => this.isPipelineFile(f.filename));
    
    // Analizar cada archivo
    const fileAnalyses: FileAnalysis[] = [];
    
    for (const file of pipelineFiles) {
      const content = await this.getFileContent(file.filename);
      const analysis = await this.analyzeFile(file.filename, content);
      fileAnalyses.push(analysis);
    }
    
    // Calcular métricas globales
    const result = this.calculateOverallMetrics(fileAnalyses);
    
    // Comparar con rama base si está disponible
    if (this.config.baseBranch) {
      result.trend = await this.calculateTrend(fileAnalyses);
    }
    
    return result;
  }

  async postAnalysisComment(analysis: PRAnalysisResult): Promise<void> {
    const comment = this.generateMainComment(analysis);
    
    // Buscar comentario existente
    const existingComment = await this.findBotComment();
    
    if (existingComment) {
      // Actualizar comentario
      await this.octokit.issues.updateComment({
        owner: this.config.owner,
        repo: this.config.repo,
        comment_id: existingComment.id,
        body: comment,
      });
    } else {
      // Crear nuevo comentario
      await this.octokit.issues.createComment({
        owner: this.config.owner,
        repo: this.config.repo,
        issue_number: this.config.pullNumber,
        body: comment,
      });
    }
  }

  async postInlineComments(analysis: PRAnalysisResult): Promise<void> {
    const pr = await this.octokit.pulls.get({
      owner: this.config.owner,
      repo: this.config.repo,
      pull_number: this.config.pullNumber,
    });

    const comments = [];
    
    for (const file of analysis.files) {
      for (const violation of file.violations) {
        if (violation.severity === 'CRITICAL' || violation.severity === 'HIGH') {
          comments.push({
            path: file.path,
            line: violation.line || 1,
            body: this.generateInlineComment(violation),
          });
        }
      }
      
      // Agregar warnings importantes
      for (const warning of file.warnings) {
        if (warning.severity === 'MEDIUM' && this.config.strictMode) {
          comments.push({
            path: file.path,
            line: warning.line || 1,
            body: this.generateInlineComment(warning),
          });
        }
      }
    }
    
    // Limitar a 50 comentarios (límite de GitHub)
    const limitedComments = comments.slice(0, 50);
    
    if (limitedComments.length > 0) {
      const reviewEvent = this.determineReviewEvent(analysis);
      
      await this.octokit.pulls.createReview({
        owner: this.config.owner,
        repo: this.config.repo,
        pull_number: this.config.pullNumber,
        commit_id: pr.data.head.sha,
        event: reviewEvent,
        body: this.generateReviewBody(analysis),
        comments: limitedComments,
      });
    }
  }

  async updatePRStatus(analysis: PRAnalysisResult): Promise<void> {
    const pr = await this.octokit.pulls.get({
      owner: this.config.owner,
      repo: this.config.repo,
      pull_number: this.config.pullNumber,
    });

    const { state, description } = this.determineStatus(analysis);
    
    await this.octokit.repos.createCommitStatus({
      owner: this.config.owner,
      repo: this.config.repo,
      sha: pr.data.head.sha,
      state,
      target_url: `https://github.com/${this.config.owner}/${this.config.repo}/pull/${this.config.pullNumber}`,
      description,
      context: 'pipeline-assistant/compliance',
    });

    // Agregar labels según el estado
    await this.updatePRLabels(analysis);
  }

  private async getChangedFiles(): Promise<any[]> {
    const response = await this.octokit.pulls.listFiles({
      owner: this.config.owner,
      repo: this.config.repo,
      pull_number: this.config.pullNumber,
      per_page: 100,
    });
    
    return response.data;
  }

  private isPipelineFile(filename: string): boolean {
    return (
      filename.endsWith('.yml') ||
      filename.endsWith('.yaml')
    ) && (
      filename.includes('.github/workflows/') ||
      filename.includes('azure-pipelines') ||
      filename.includes('pipeline')
    );
  }

  private async getFileContent(path: string): Promise<string> {
    try {
      const response = await this.octokit.repos.getContent({
        owner: this.config.owner,
        repo: this.config.repo,
        path,
        ref: `pull/${this.config.pullNumber}/head`,
      });
      
      if ('content' in response.data) {
        return Buffer.from(response.data.content, 'base64').toString('utf-8');
      }
      
      throw new Error('No se pudo obtener el contenido del archivo');
    } catch (error) {
      console.error(`Error obteniendo archivo ${path}:`, error);
      return '';
    }
  }

  private async analyzeFile(path: string, content: string): Promise<FileAnalysis> {
    const projectType = this.detectProjectType(path, content);
    
    const analysis = await this.analyzer.analyze(content, {
      strictMode: this.config.strictMode,
      projectType,
      checkSecurity: true,
      checkPerformance: true,
      checkCompliance: true,
    });
    
    return {
      path,
      score: analysis.score,
      violations: analysis.violations,
      warnings: analysis.warnings,
      suggestions: analysis.suggestions,
    };
  }

  private detectProjectType(path: string, content: string): string | undefined {
    if (content.includes('DotNetCoreCLI') || content.includes('dotnet')) {
      return 'dotnet';
    }
    if (content.includes('NodeTool') || content.includes('npm')) {
      return 'node';
    }
    if (content.includes('Python') || content.includes('pip')) {
      return 'python';
    }
    return undefined;
  }

  private calculateOverallMetrics(fileAnalyses: FileAnalysis[]): PRAnalysisResult {
    const totalFiles = fileAnalyses.length;
    const filesWithIssues = fileAnalyses.filter(f => 
      f.violations.length > 0 || f.warnings.length > 0
    ).length;
    
    let criticalCount = 0;
    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;
    let totalScore = 0;
    
    for (const file of fileAnalyses) {
      totalScore += file.score;
      
      for (const violation of file.violations) {
        switch (violation.severity) {
          case 'CRITICAL':
            criticalCount++;
            break;
          case 'HIGH':
            highCount++;
            break;
          case 'MEDIUM':
            mediumCount++;
            break;
          case 'LOW':
            lowCount++;
            break;
        }
      }
      
      for (const warning of file.warnings) {
        if (warning.severity === 'MEDIUM') {
          mediumCount++;
        } else {
          lowCount++;
        }
      }
    }
    
    const overallScore = totalFiles > 0 ? Math.round(totalScore / totalFiles) : 100;
    
    return {
      overallScore,
      files: fileAnalyses,
      summary: {
        totalFiles,
        filesWithIssues,
        criticalCount,
        highCount,
        mediumCount,
        lowCount,
      },
    };
  }

  private async calculateTrend(currentAnalysis: FileAnalysis[]): Promise<any> {
    // Comparar con análisis de la rama base
    // Simplificado para el ejemplo
    return {
      scoreChange: 0,
      issuesResolved: 0,
      newIssues: 0,
    };
  }

  private generateMainComment(analysis: PRAnalysisResult): string {
    const emoji = this.getScoreEmoji(analysis.overallScore);
    const status = this.getStatusText(analysis);
    
    let comment = `## 🔍 Pipeline Assistant Analysis\n\n`;
    comment += `### ${emoji} Overall Compliance Score: ${analysis.overallScore}%\n\n`;
    
    // Status badges
    comment += this.generateBadges(analysis);
    comment += '\n\n';
    
    // Summary table
    comment += '### 📊 Summary\n\n';
    comment += '| Metric | Count | Status |\n';
    comment += '|--------|-------|--------|\n';
    comment += `| Files Analyzed | ${analysis.summary.totalFiles} | - |\n`;
    comment += `| Files with Issues | ${analysis.summary.filesWithIssues} | ${analysis.summary.filesWithIssues === 0 ? '✅' : '⚠️'} |\n`;
    comment += `| Critical Issues | ${analysis.summary.criticalCount} | ${analysis.summary.criticalCount === 0 ? '✅' : '🔴'} |\n`;
    comment += `| High Issues | ${analysis.summary.highCount} | ${analysis.summary.highCount === 0 ? '✅' : '🟠'} |\n`;
    comment += `| Medium Issues | ${analysis.summary.mediumCount} | ${analysis.summary.mediumCount === 0 ? '✅' : '🟡'} |\n`;
    comment += `| Low Issues | ${analysis.summary.lowCount} | ${analysis.summary.lowCount === 0 ? '✅' : '🟢'} |\n\n`;
    
    // Trend if available
    if (analysis.trend) {
      comment += '### 📈 Trend vs Base Branch\n\n';
      const trendIcon = analysis.trend.scoreChange >= 0 ? '📈' : '📉';
      comment += `- Score Change: ${trendIcon} ${analysis.trend.scoreChange > 0 ? '+' : ''}${analysis.trend.scoreChange}%\n`;
      comment += `- Issues Resolved: ✅ ${analysis.trend.issuesResolved}\n`;
      comment += `- New Issues: ⚠️ ${analysis.trend.newIssues}\n\n`;
    }
    
    // File details
    if (analysis.files.length > 0) {
      comment += '### 📁 File Analysis\n\n';
      comment += '<details>\n';
      comment += '<summary>Click to expand file details</summary>\n\n';
      
      for (const file of analysis.files) {
        const fileEmoji = file.score >= 80 ? '✅' : file.score >= 60 ? '⚠️' : '❌';
        comment += `#### ${fileEmoji} \`${file.path}\` (Score: ${file.score}%)\n\n`;
        
        if (file.violations.length > 0) {
          comment += '**Violations:**\n';
          for (const violation of file.violations.slice(0, 5)) {
            comment += `- ${this.getSeverityIcon(violation.severity)} **${violation.type}**: ${violation.message}\n`;
          }
          if (file.violations.length > 5) {
            comment += `- _...and ${file.violations.length - 5} more_\n`;
          }
          comment += '\n';
        }
        
        if (file.warnings.length > 0) {
          comment += '**Warnings:**\n';
          for (const warning of file.warnings.slice(0, 3)) {
            comment += `- ⚠️ ${warning.message}\n`;
          }
          if (file.warnings.length > 3) {
            comment += `- _...and ${file.warnings.length - 3} more_\n`;
          }
          comment += '\n';
        }
      }
      
      comment += '</details>\n\n';
    }
    
    // Mode information
    const mode = this.config.enforcementMode || 'learning';
    if (mode === 'learning') {
      comment += '> ℹ️ **Learning Mode**: This analysis is informational. Merge is not blocked by pipeline issues.\n';
    } else {
      comment += '> 🚫 **Enforcement Mode**: Critical issues must be resolved before merging.\n';
    }
    
    // Actions
    comment += '\n### 🎯 Next Steps\n\n';
    
    if (analysis.summary.criticalCount > 0) {
      comment += '1. **🔴 Fix critical issues** - These are blocking the merge\n';
    }
    if (analysis.summary.highCount > 0) {
      comment += '2. **🟠 Address high priority issues** - Strongly recommended\n';
    }
    if (analysis.overallScore < 80) {
      comment += '3. **📈 Improve compliance score** - Target is 80% minimum\n';
    }
    
    // Commands
    comment += '\n### 💬 Commands\n\n';
    comment += '- Comment `/reanalyze` to trigger a new analysis\n';
    comment += '- Comment `/help` for more information\n';
    comment += '- Comment `/ignore [file]` to exclude a file from analysis\n';
    
    // Footer
    comment += '\n---\n';
    comment += '_Pipeline Assistant v1.0 | [Documentation](https://github.com/pipeline-assistant/docs) | [Report Issue](https://github.com/pipeline-assistant/issues)_\n';
    
    return comment;
  }

  private generateInlineComment(issue: any): string {
    const icon = this.getSeverityIcon(issue.severity);
    let comment = `**${icon} ${issue.type}**\n\n`;
    comment += `${issue.message}\n\n`;
    
    if (issue.suggestion) {
      comment += `💡 **Suggestion:** ${issue.suggestion}\n\n`;
    }
    
    if (issue.code) {
      comment += '**Suggested fix:**\n';
      comment += '```yaml\n';
      comment += issue.code;
      comment += '\n```\n\n';
    }
    
    if (issue.rule) {
      comment += `📏 **Rule:** \`${issue.rule}\`\n`;
    }
    
    if (issue.documentation) {
      comment += `📚 [Learn more](${issue.documentation})\n`;
    }
    
    return comment;
  }

  private generateReviewBody(analysis: PRAnalysisResult): string {
    if (analysis.summary.criticalCount > 0) {
      return `❌ **Changes requested**: Found ${analysis.summary.criticalCount} critical issues that must be resolved.`;
    }
    
    if (analysis.summary.highCount > 0) {
      return `⚠️ **Review with concerns**: Found ${analysis.summary.highCount} high priority issues that should be addressed.`;
    }
    
    if (analysis.overallScore >= 80) {
      return `✅ **Approved**: Pipeline compliance score is ${analysis.overallScore}%. Good job!`;
    }
    
    return `📋 **Commented**: Pipeline compliance score is ${analysis.overallScore}%. Consider addressing the issues found.`;
  }

  private determineReviewEvent(analysis: PRAnalysisResult): 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT' {
    if (this.config.enforcementMode === 'enforcement' && analysis.summary.criticalCount > 0) {
      return 'REQUEST_CHANGES';
    }
    
    if (analysis.overallScore >= 80 && analysis.summary.criticalCount === 0) {
      return 'APPROVE';
    }
    
    return 'COMMENT';
  }

  private determineStatus(analysis: PRAnalysisResult): { state: 'success' | 'failure' | 'pending', description: string } {
    if (this.config.enforcementMode === 'enforcement' && analysis.summary.criticalCount > 0) {
      return {
        state: 'failure',
        description: `❌ ${analysis.summary.criticalCount} critical issues must be fixed`,
      };
    }
    
    if (analysis.overallScore < 60) {
      return {
        state: 'failure',
        description: `❌ Compliance score too low: ${analysis.overallScore}%`,
      };
    }
    
    if (analysis.overallScore < 80) {
      return {
        state: 'success', // GitHub no tiene warning
        description: `⚠️ Compliance: ${analysis.overallScore}% - Improvements recommended`,
      };
    }
    
    return {
      state: 'success',
      description: `✅ Pipeline compliance: ${analysis.overallScore}%`,
    };
  }

  private async updatePRLabels(analysis: PRAnalysisResult): Promise<void> {
    const labels = [];
    
    // Score labels
    if (analysis.overallScore >= 90) {
      labels.push('pipeline: excellent');
    } else if (analysis.overallScore >= 80) {
      labels.push('pipeline: good');
    } else if (analysis.overallScore >= 60) {
      labels.push('pipeline: needs-improvement');
    } else {
      labels.push('pipeline: requires-attention');
    }
    
    // Issue labels
    if (analysis.summary.criticalCount > 0) {
      labels.push('has: critical-issues');
    }
    if (analysis.summary.highCount > 0) {
      labels.push('has: high-priority-issues');
    }
    
    // Status label
    if (analysis.summary.criticalCount === 0 && analysis.summary.highCount === 0) {
      labels.push('ready-to-merge');
    }
    
    try {
      await this.octokit.issues.addLabels({
        owner: this.config.owner,
        repo: this.config.repo,
        issue_number: this.config.pullNumber,
        labels,
      });
    } catch (error) {
      console.error('Error adding labels:', error);
    }
  }

  private async findBotComment(): Promise<any> {
    const comments = await this.octokit.issues.listComments({
      owner: this.config.owner,
      repo: this.config.repo,
      issue_number: this.config.pullNumber,
    });
    
    return comments.data.find(comment =>
      comment.user?.type === 'Bot' &&
      comment.body?.includes('## 🔍 Pipeline Assistant Analysis')
    );
  }

  private getScoreEmoji(score: number): string {
    if (score >= 90) return '🟢';
    if (score >= 80) return '🟢';
    if (score >= 60) return '🟡';
    if (score >= 40) return '🟠';
    return '🔴';
  }

  private getSeverityIcon(severity: string): string {
    switch (severity) {
      case 'CRITICAL':
        return '🔴';
      case 'HIGH':
        return '🟠';
      case 'MEDIUM':
        return '🟡';
      case 'LOW':
        return '🟢';
      default:
        return '⚪';
    }
  }

  private getStatusText(analysis: PRAnalysisResult): string {
    if (analysis.summary.criticalCount > 0) {
      return '❌ Critical issues found';
    }
    if (analysis.overallScore >= 80) {
      return '✅ Ready to merge';
    }
    if (analysis.overallScore >= 60) {
      return '⚠️ Improvements recommended';
    }
    return '🔴 Requires attention';
  }

  private generateBadges(analysis: PRAnalysisResult): string {
    const scoreBadge = `![Compliance](https://img.shields.io/badge/compliance-${analysis.overallScore}%25-${this.getBadgeColor(analysis.overallScore)})`;
    const criticalBadge = `![Critical](https://img.shields.io/badge/critical-${analysis.summary.criticalCount}-${analysis.summary.criticalCount > 0 ? 'red' : 'green'})`;
    const highBadge = `![High](https://img.shields.io/badge/high-${analysis.summary.highCount}-${analysis.summary.highCount > 0 ? 'orange' : 'green'})`;
    
    return `${scoreBadge} ${criticalBadge} ${highBadge}`;
  }

  private getBadgeColor(score: number): string {
    if (score >= 80) return 'green';
    if (score >= 60) return 'yellow';
    if (score >= 40) return 'orange';
    return 'red';
  }
}

// CLI para testing local
export async function runPRAnalysis(config: PRAnalysisConfig): Promise<void> {
  console.log(`🔍 Analyzing PR #${config.pullNumber}...`);
  
  const bot = new PRBot(config);
  
  try {
    // Realizar análisis
    const analysis = await bot.analyzePR();
    
    console.log(`📊 Overall Score: ${analysis.overallScore}%`);
    console.log(`📁 Files Analyzed: ${analysis.summary.totalFiles}`);
    console.log(`❌ Critical Issues: ${analysis.summary.criticalCount}`);
    
    // Publicar comentarios
    await bot.postAnalysisComment(analysis);
    console.log('✅ Main comment posted');
    
    // Publicar comentarios inline
    await bot.postInlineComments(analysis);
    console.log('✅ Inline comments posted');
    
    // Actualizar estado
    await bot.updatePRStatus(analysis);
    console.log('✅ PR status updated');
    
    console.log('🎉 Analysis complete!');
  } catch (error) {
    console.error('❌ Error during analysis:', error);
    throw error;
  }
}
