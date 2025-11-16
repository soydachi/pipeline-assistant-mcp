#!/usr/bin/env node

import { Command } from 'commander';
import { PRBot, PRAnalysisConfig, runPRAnalysis } from '../src/pr-bot';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

const program = new Command();

program
  .name('pipeline-assistant-pr')
  .description('Pipeline Assistant PR Bot - Automated pipeline review for pull requests')
  .version('1.0.0');

program
  .command('analyze')
  .description('Analyze a pull request')
  .requiredOption('--token <token>', 'GitHub token with repo and PR permissions')
  .requiredOption('--owner <owner>', 'Repository owner')
  .requiredOption('--repo <repo>', 'Repository name')
  .requiredOption('--pr <number>', 'Pull request number')
  .option('--strict', 'Enable strict mode analysis', false)
  .option('--enforcement <mode>', 'Set enforcement mode', 'learning')
  .option('--base <branch>', 'Base branch for comparison', 'main')
  .option('--dry-run', 'Analyze without posting comments', false)
  .action(async (options) => {
    console.log(chalk.blue.bold('\n🤖 Pipeline Assistant PR Bot\n'));
    console.log(chalk.gray('═'.repeat(50)));
    
    const config: PRAnalysisConfig = {
      githubToken: options.token,
      owner: options.owner,
      repo: options.repo,
      pullNumber: parseInt(options.pr),
      strictMode: options.strict,
      enforcementMode: options.enforcement as 'learning' | 'enforcement',
      baseBranch: options.base
    };
    
    console.log(chalk.cyan(`\n📍 Repository: ${config.owner}/${config.repo}`));
    console.log(chalk.cyan(`🔀 Pull Request: #${config.pullNumber}`));
    console.log(chalk.cyan(`⚙️  Mode: ${config.enforcementMode}`));
    console.log(chalk.cyan(`🔍 Strict: ${config.strictMode ? 'Yes' : 'No'}\n`));
    
    try {
      if (options.dryRun) {
        console.log(chalk.yellow('🔸 DRY RUN MODE - No comments will be posted\n'));
        await performDryRun(config);
      } else {
        await runPRAnalysis(config);
      }
    } catch (error) {
      console.error(chalk.red('\n❌ Error:'), error);
      process.exit(1);
    }
  });

program
  .command('report')
  .description('Generate a report from analysis results')
  .requiredOption('--input <file>', 'Input JSON file with analysis results')
  .option('--format <format>', 'Output format (markdown, json, html)', 'markdown')
  .option('--output <file>', 'Output file (stdout if not specified)')
  .action(async (options) => {
    try {
      const inputData = JSON.parse(
        fs.readFileSync(options.input, 'utf-8')
      );
      
      const report = generateReport(inputData, options.format);
      
      if (options.output) {
        fs.writeFileSync(options.output, report);
        console.log(chalk.green(`✅ Report saved to ${options.output}`));
      } else {
        console.log(report);
      }
    } catch (error) {
      console.error(chalk.red('Error generating report:'), error);
      process.exit(1);
    }
  });

program
  .command('check')
  .description('Check if PR meets minimum requirements')
  .requiredOption('--input <file>', 'Analysis results file')
  .option('--min-score <score>', 'Minimum required score', '80')
  .option('--max-critical <count>', 'Maximum critical issues allowed', '0')
  .option('--max-high <count>', 'Maximum high issues allowed', '2')
  .action((options) => {
    try {
      const analysis = JSON.parse(
        fs.readFileSync(options.input, 'utf-8')
      );
      
      const minScore = parseInt(options.minScore);
      const maxCritical = parseInt(options.maxCritical);
      const maxHigh = parseInt(options.maxHigh);
      
      console.log(chalk.blue.bold('\n📊 Compliance Check\n'));
      console.log(chalk.gray('─'.repeat(30)));
      
      let passed = true;
      
      // Check score
      if (analysis.overallScore < minScore) {
        console.log(chalk.red(`❌ Score: ${analysis.overallScore}% (minimum: ${minScore}%)`));
        passed = false;
      } else {
        console.log(chalk.green(`✅ Score: ${analysis.overallScore}% (minimum: ${minScore}%)`));
      }
      
      // Check critical issues
      if (analysis.summary.criticalCount > maxCritical) {
        console.log(chalk.red(`❌ Critical issues: ${analysis.summary.criticalCount} (maximum: ${maxCritical})`));
        passed = false;
      } else {
        console.log(chalk.green(`✅ Critical issues: ${analysis.summary.criticalCount} (maximum: ${maxCritical})`));
      }
      
      // Check high issues
      if (analysis.summary.highCount > maxHigh) {
        console.log(chalk.red(`❌ High issues: ${analysis.summary.highCount} (maximum: ${maxHigh})`));
        passed = false;
      } else {
        console.log(chalk.green(`✅ High issues: ${analysis.summary.highCount} (maximum: ${maxHigh})`));
      }
      
      console.log(chalk.gray('─'.repeat(30)));
      
      if (passed) {
        console.log(chalk.green.bold('\n✅ PR MEETS REQUIREMENTS\n'));
        process.exit(0);
      } else {
        console.log(chalk.red.bold('\n❌ PR DOES NOT MEET REQUIREMENTS\n'));
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('Error checking compliance:'), error);
      process.exit(1);
    }
  });

program
  .command('simulate')
  .description('Simulate PR analysis with sample data')
  .option('--scenario <type>', 'Scenario type (good, bad, mixed)', 'mixed')
  .action((options) => {
    console.log(chalk.blue.bold('\n🎭 Simulation Mode\n'));
    
    const scenarios = {
      good: {
        overallScore: 95,
        summary: {
          totalFiles: 3,
          filesWithIssues: 0,
          criticalCount: 0,
          highCount: 0,
          mediumCount: 1,
          lowCount: 2
        }
      },
      bad: {
        overallScore: 35,
        summary: {
          totalFiles: 2,
          filesWithIssues: 2,
          criticalCount: 3,
          highCount: 5,
          mediumCount: 8,
          lowCount: 4
        }
      },
      mixed: {
        overallScore: 72,
        summary: {
          totalFiles: 4,
          filesWithIssues: 2,
          criticalCount: 0,
          highCount: 2,
          mediumCount: 4,
          lowCount: 3
        }
      }
    };
    
    const scenario = scenarios[options.scenario as keyof typeof scenarios];
    
    console.log(chalk.cyan('Scenario:'), options.scenario);
    console.log(chalk.cyan('Score:'), getScoreWithEmoji(scenario.overallScore));
    console.log(chalk.cyan('\nIssues:'));
    console.log(`  🔴 Critical: ${scenario.summary.criticalCount}`);
    console.log(`  🟠 High: ${scenario.summary.highCount}`);
    console.log(`  🟡 Medium: ${scenario.summary.mediumCount}`);
    console.log(`  🟢 Low: ${scenario.summary.lowCount}`);
    
    const report = generateMarkdownReport(scenario);
    console.log(chalk.gray('\n' + '─'.repeat(50) + '\n'));
    console.log(report);
  });

// Funciones auxiliares

async function performDryRun(config: PRAnalysisConfig) {
  const bot = new PRBot(config);
  
  console.log(chalk.cyan('🔍 Analyzing pull request...'));
  const analysis = await bot.analyzePR();
  
  console.log(chalk.green('\n✅ Analysis Complete\n'));
  console.log(chalk.gray('─'.repeat(50)));
  
  console.log(chalk.white('📊 Results:'));
  console.log(`  Score: ${getScoreWithEmoji(analysis.overallScore)}`);
  console.log(`  Files: ${analysis.summary.totalFiles}`);
  console.log(`  Issues: ${analysis.summary.criticalCount + analysis.summary.highCount + analysis.summary.mediumCount + analysis.summary.lowCount}`);
  
  console.log(chalk.gray('\n─'.repeat(50)));
  console.log(chalk.white('\n📁 File Details:\n'));
  
  for (const file of analysis.files) {
    const emoji = file.score >= 80 ? '✅' : file.score >= 60 ? '⚠️' : '❌';
    console.log(`${emoji} ${chalk.cyan(file.path)} (Score: ${file.score}%)`);
    
    if (file.violations.length > 0) {
      console.log(chalk.red(`  Violations: ${file.violations.length}`));
      for (const violation of file.violations.slice(0, 3)) {
        console.log(`    - ${violation.severity}: ${violation.message}`);
      }
    }
    
    if (file.warnings.length > 0) {
      console.log(chalk.yellow(`  Warnings: ${file.warnings.length}`));
    }
  }
  
  console.log(chalk.gray('\n' + '═'.repeat(50)));
  console.log(chalk.yellow('\n📝 This was a dry run. No comments were posted to GitHub.\n'));
}

function generateReport(analysis: any, format: string): string {
  switch (format) {
    case 'markdown':
      return generateMarkdownReport(analysis);
    case 'json':
      return JSON.stringify(analysis, null, 2);
    case 'html':
      return generateHtmlReport(analysis);
    default:
      throw new Error(`Unknown format: ${format}`);
  }
}

function generateMarkdownReport(analysis: any): string {
  let report = '# Pipeline Analysis Report\n\n';
  
  report += `## Score: ${analysis.overallScore || 0}%\n\n`;
  
  report += '## Summary\n\n';
  report += '| Metric | Count |\n';
  report += '|--------|-------|\n';
  
  const summary = analysis.summary || {};
  report += `| Total Files | ${summary.totalFiles || 0} |\n`;
  report += `| Files with Issues | ${summary.filesWithIssues || 0} |\n`;
  report += `| Critical Issues | ${summary.criticalCount || 0} |\n`;
  report += `| High Issues | ${summary.highCount || 0} |\n`;
  report += `| Medium Issues | ${summary.mediumCount || 0} |\n`;
  report += `| Low Issues | ${summary.lowCount || 0} |\n`;
  
  if (analysis.files && analysis.files.length > 0) {
    report += '\n## Files\n\n';
    for (const file of analysis.files) {
      report += `### ${file.path}\n\n`;
      report += `- Score: ${file.score}%\n`;
      report += `- Violations: ${file.violations?.length || 0}\n`;
      report += `- Warnings: ${file.warnings?.length || 0}\n`;
      report += `- Suggestions: ${file.suggestions?.length || 0}\n\n`;
    }
  }
  
  return report;
}

function generateHtmlReport(analysis: any): string {
  return `<!DOCTYPE html>
<html>
<head>
  <title>Pipeline Analysis Report</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    h1 { color: #333; }
    .score { font-size: 2em; font-weight: bold; }
    .good { color: green; }
    .warning { color: orange; }
    .bad { color: red; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; }
  </style>
</head>
<body>
  <h1>Pipeline Analysis Report</h1>
  <div class="score ${getScoreClass(analysis.overallScore)}">
    Score: ${analysis.overallScore}%
  </div>
  <h2>Summary</h2>
  <table>
    <tr><th>Metric</th><th>Count</th></tr>
    <tr><td>Total Files</td><td>${analysis.summary?.totalFiles || 0}</td></tr>
    <tr><td>Critical Issues</td><td>${analysis.summary?.criticalCount || 0}</td></tr>
    <tr><td>High Issues</td><td>${analysis.summary?.highCount || 0}</td></tr>
    <tr><td>Medium Issues</td><td>${analysis.summary?.mediumCount || 0}</td></tr>
    <tr><td>Low Issues</td><td>${analysis.summary?.lowCount || 0}</td></tr>
  </table>
</body>
</html>`;
}

function getScoreClass(score: number): string {
  if (score >= 80) return 'good';
  if (score >= 60) return 'warning';
  return 'bad';
}

function getScoreWithEmoji(score: number): string {
  const emoji = score >= 80 ? '🟢' : score >= 60 ? '🟡' : '🔴';
  return `${emoji} ${score}%`;
}

// Ejecutar CLI
program.parse();
