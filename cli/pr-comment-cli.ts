#!/usr/bin/env node

/**
 * Pipeline Assistant PR Comment CLI
 *
 * Unified CLI for posting PR comments on both Azure DevOps and GitHub.
 * Reads analysis results and posts formatted comments to Pull Requests.
 */

import { Command } from 'commander';
import * as fs from 'fs';
import chalk from 'chalk';

const program = new Command();

program
  .name('pipeline-assistant-pr-comment')
  .description('Post pipeline analysis results as PR comments (Azure DevOps & GitHub)')
  .version('1.0.0');

// Azure DevOps command
program
  .command('azdo')
  .description('Post comment to Azure DevOps Pull Request')
  .requiredOption('--pr-id <id>', 'Pull Request ID')
  .option('--org-url <url>', 'Azure DevOps organization URL', process.env.AZDO_ORG_URL)
  .option('--pat <token>', 'Personal Access Token', process.env.AZDO_PAT)
  .option('--project <name>', 'Project name', process.env.AZDO_PROJECT)
  .option('--repository <name>', 'Repository name', process.env.AZDO_REPOSITORY)
  .option('--analysis-file <file>', 'JSON file with analysis results')
  .option('--score <number>', 'Overall compliance score', '0')
  .option('--violations <json>', 'JSON string with violations')
  .option('--dry-run', 'Print comment without posting', false)
  .action(async (options) => {
    console.log(chalk.blue.bold('\n🤖 Pipeline Assistant - Azure DevOps PR Comment\n'));

    // Validate required options
    if (!options.orgUrl) {
      console.error(chalk.red('Error: --org-url or AZDO_ORG_URL environment variable is required'));
      process.exit(1);
    }
    if (!options.pat) {
      console.error(chalk.red('Error: --pat or AZDO_PAT environment variable is required'));
      process.exit(1);
    }
    if (!options.project) {
      console.error(chalk.red('Error: --project or AZDO_PROJECT environment variable is required'));
      process.exit(1);
    }

    try {
      // Load analysis data
      let analysisData: any = null;
      if (options.analysisFile) {
        analysisData = JSON.parse(fs.readFileSync(options.analysisFile, 'utf-8'));
      } else if (options.violations) {
        analysisData = {
          score: parseInt(options.score),
          violations: JSON.parse(options.violations)
        };
      }

      // Generate comment markdown
      const comment = generateAzdoComment(
        parseInt(options.prId),
        parseInt(options.score),
        analysisData
      );

      if (options.dryRun) {
        console.log(chalk.yellow('DRY RUN - Comment would be posted:\n'));
        console.log(chalk.gray('─'.repeat(50)));
        console.log(comment);
        console.log(chalk.gray('─'.repeat(50)));
        return;
      }

      // Post comment to Azure DevOps
      await postAzdoComment(
        options.orgUrl,
        options.pat,
        options.project,
        options.repository,
        parseInt(options.prId),
        comment
      );

      console.log(chalk.green('✅ Comment posted successfully to PR #' + options.prId));
    } catch (error) {
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

// GitHub command
program
  .command('github')
  .description('Post comment to GitHub Pull Request')
  .requiredOption('--pr <number>', 'Pull Request number')
  .requiredOption('--owner <owner>', 'Repository owner')
  .requiredOption('--repo <repo>', 'Repository name')
  .option('--token <token>', 'GitHub token', process.env.GITHUB_TOKEN)
  .option('--analysis-file <file>', 'JSON file with analysis results')
  .option('--score <number>', 'Overall compliance score', '0')
  .option('--violations <json>', 'JSON string with violations')
  .option('--dry-run', 'Print comment without posting', false)
  .action(async (options) => {
    console.log(chalk.blue.bold('\n🤖 Pipeline Assistant - GitHub PR Comment\n'));

    if (!options.token) {
      console.error(chalk.red('Error: --token or GITHUB_TOKEN environment variable is required'));
      process.exit(1);
    }

    try {
      // Load analysis data
      let analysisData: any = null;
      if (options.analysisFile) {
        analysisData = JSON.parse(fs.readFileSync(options.analysisFile, 'utf-8'));
      } else if (options.violations) {
        analysisData = {
          score: parseInt(options.score),
          violations: JSON.parse(options.violations)
        };
      }

      // Generate comment markdown
      const comment = generateGitHubComment(
        parseInt(options.pr),
        parseInt(options.score),
        analysisData
      );

      if (options.dryRun) {
        console.log(chalk.yellow('DRY RUN - Comment would be posted:\n'));
        console.log(chalk.gray('─'.repeat(50)));
        console.log(comment);
        console.log(chalk.gray('─'.repeat(50)));
        return;
      }

      // Post comment to GitHub
      await postGitHubComment(
        options.token,
        options.owner,
        options.repo,
        parseInt(options.pr),
        comment
      );

      console.log(chalk.green('✅ Comment posted successfully to PR #' + options.pr));
    } catch (error) {
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

// Helper functions

function generateAzdoComment(prId: number, score: number, analysis: any): string {
  const emoji = getScoreEmoji(score);
  const status = score >= 80 ? 'PASSED' : score >= 60 ? 'WARNING' : 'FAILED';

  let comment = `## ${emoji} Pipeline Analysis Results\n\n`;
  comment += `**Status:** ${status}\n`;
  comment += `**Compliance Score:** ${score}/100\n\n`;

  if (analysis?.violations && analysis.violations.length > 0) {
    comment += `### Violations Found (${analysis.violations.length})\n\n`;

    const critical = analysis.violations.filter((v: any) => v.severity === 'CRITICAL');
    const high = analysis.violations.filter((v: any) => v.severity === 'HIGH');
    const medium = analysis.violations.filter((v: any) => v.severity === 'MEDIUM');
    const low = analysis.violations.filter((v: any) => v.severity === 'LOW');

    if (critical.length > 0) {
      comment += `#### 🔴 Critical (${critical.length})\n`;
      critical.forEach((v: any) => {
        comment += `- **Line ${v.line || 1}:** ${v.message}\n`;
      });
      comment += '\n';
    }

    if (high.length > 0) {
      comment += `#### 🟠 High (${high.length})\n`;
      high.forEach((v: any) => {
        comment += `- **Line ${v.line || 1}:** ${v.message}\n`;
      });
      comment += '\n';
    }

    if (medium.length > 0) {
      comment += `#### 🟡 Medium (${medium.length})\n`;
      medium.forEach((v: any) => {
        comment += `- **Line ${v.line || 1}:** ${v.message}\n`;
      });
      comment += '\n';
    }

    if (low.length > 0) {
      comment += `#### 🟢 Low (${low.length})\n`;
      low.forEach((v: any) => {
        comment += `- **Line ${v.line || 1}:** ${v.message}\n`;
      });
      comment += '\n';
    }
  } else if (score === 100) {
    comment += `### ✅ No issues found!\n\n`;
    comment += `Your pipeline meets all compliance requirements.\n`;
  }

  comment += `\n---\n`;
  comment += `*Generated by [Pipeline Assistant](https://github.com/soydachi/pipeline-assistant-mcp)*`;

  return comment;
}

function generateGitHubComment(prNumber: number, score: number, analysis: any): string {
  // Same format as Azure DevOps for consistency
  return generateAzdoComment(prNumber, score, analysis);
}

async function postAzdoComment(
  orgUrl: string,
  pat: string,
  project: string,
  repository: string | undefined,
  prId: number,
  comment: string
): Promise<void> {
  // Use Azure DevOps REST API to post comment
  const apiUrl = `${orgUrl}/${project}/_apis/git/repositories/${repository || project}/pullRequests/${prId}/threads?api-version=7.0`;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${Buffer.from(`:${pat}`).toString('base64')}`
    },
    body: JSON.stringify({
      comments: [{
        parentCommentId: 0,
        content: comment,
        commentType: 1 // Text comment
      }],
      status: 1 // Active
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Azure DevOps API error: ${response.status} - ${errorText}`);
  }
}

async function postGitHubComment(
  token: string,
  owner: string,
  repo: string,
  prNumber: number,
  comment: string
): Promise<void> {
  // Use GitHub REST API to post comment
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Pipeline-Assistant-Bot'
    },
    body: JSON.stringify({
      body: comment
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitHub API error: ${response.status} - ${errorText}`);
  }
}

function getScoreEmoji(score: number): string {
  if (score >= 80) return '✅';
  if (score >= 60) return '⚠️';
  return '❌';
}

// Run CLI
program.parse();
