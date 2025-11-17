#!/usr/bin/env node

import { Command } from 'commander';
import { PipelineGenerator } from '../src/pipeline-generator.js';
import { PipelineAnalyzer } from '../src/pipeline-analyzer.js';
import { WikiParser } from '../src/wiki-parser.js';
import { readFileSync, writeFileSync } from 'fs';
import chalk from 'chalk';

const program = new Command();

program
  .name('pipeline-assistant')
  .description('CLI tool for generating and analyzing CI/CD pipelines')
  .version('1.0.0');

// Generate command
program
  .command('generate')
  .description('Generate a new pipeline')
  .option('-t, --type <type>', 'Project type (dotnet, node, python)', 'node')
  .option('-s, --services <services>', 'Azure services (comma-separated)', '')
  .option('-e, --env <environment>', 'Environment (dev, staging, production)', 'dev')
  .option('-o, --output <file>', 'Output file', 'azure-pipelines.yml')
  .action(async (options) => {
    try {
      console.log(chalk.blue('🚀 Generating pipeline...'));
      console.log(chalk.gray(`  Type: ${options.type}`));
      console.log(chalk.gray(`  Environment: ${options.env}`));

      const wikiParser = new WikiParser('./wiki/standards');
      const generator = new PipelineGenerator(wikiParser);

      const services = options.services
        ? options.services.split(',').map((s: string) => s.trim())
        : [];

      if (services.length > 0) {
        console.log(chalk.gray(`  Services: ${services.join(', ')}`));
      }

      // Load standards
      await wikiParser.loadStandards();
      const standards = await wikiParser.getStandardsForProject(options.type);

      const pipeline = await generator.generatePipeline({
        projectType: options.type as any,
        services,
        environment: options.env as any,
        standards,
      });

      writeFileSync(options.output, pipeline, 'utf-8');

      console.log(chalk.green(`✅ Pipeline generated successfully!`));
      console.log(chalk.gray(`  Output: ${options.output}`));

      // Show stats
      const lines = pipeline.split('\n').length;
      const stages = (pipeline.match(/stage:/g) || []).length;
      const tasks = (pipeline.match(/task:/g) || []).length;

      console.log(chalk.cyan('\n📊 Pipeline Stats:'));
      console.log(chalk.gray(`  Lines: ${lines}`));
      console.log(chalk.gray(`  Stages: ${stages}`));
      console.log(chalk.gray(`  Tasks: ${tasks}`));

    } catch (error) {
      console.error(chalk.red('❌ Error generating pipeline:'));
      console.error(chalk.red((error as Error).message));
      process.exit(1);
    }
  });

// Analyze command
program
  .command('analyze')
  .description('Analyze a pipeline for issues')
  .requiredOption('-f, --file <file>', 'Pipeline file to analyze')
  .option('--strict', 'Enable strict mode (more rules)', false)
  .option('--config <file>', 'Custom configuration file')
  .action(async (options) => {
    try {
      console.log(chalk.blue('🔍 Analyzing pipeline...'));
      console.log(chalk.gray(`  File: ${options.file}`));

      const content = readFileSync(options.file, 'utf-8');
      const wikiParser = new WikiParser('./wiki/standards');
      const analyzer = new PipelineAnalyzer(wikiParser);

      // Load custom config if provided
      if (options.config) {
        const config = JSON.parse(readFileSync(options.config, 'utf-8'));
        console.log(chalk.gray(`  Config: ${options.config}`));
        if (config.customRules) {
          console.log(chalk.gray(`  Custom rules: ${config.customRules.length}`));
        }
      }

      const result = await analyzer.analyze(content, { strictMode: options.strict });

      // Display results
      console.log(chalk.cyan('\n📊 Pipeline Analysis Results'));
      console.log(chalk.gray('─'.repeat(50)));

      // Score with color
      const scoreColor = result.score >= 90 ? chalk.green
        : result.score >= 70 ? chalk.yellow
        : result.score >= 50 ? chalk.blue
        : chalk.red;

      console.log(chalk.bold(`\nOverall Score: ${scoreColor(`${result.score}/100`)}`));

      // Violations by severity
      const critical = result.violations.filter((v: any) => v.severity === 'CRITICAL');
      const high = result.violations.filter((v: any) => v.severity === 'HIGH');
      const medium = result.violations.filter((v: any) => v.severity === 'MEDIUM');
      const low = result.violations.filter((v: any) => v.severity === 'LOW');

      if (critical.length > 0) {
        console.log(chalk.red(`\n❌ CRITICAL Violations (${critical.length}):`));
        critical.forEach((v: any) => {
          console.log(chalk.red(`  Line ${v.line || 'N/A'}: ${v.message}`));
          if (v.details) {
            console.log(chalk.gray(`    ${v.details}`));
          }
        });
      }

      if (high.length > 0) {
        console.log(chalk.yellow(`\n⚠️  HIGH Violations (${high.length}):`));
        high.forEach((v: any) => {
          console.log(chalk.yellow(`  Line ${v.line || 'N/A'}: ${v.message}`));
          if (v.details) {
            console.log(chalk.gray(`    ${v.details}`));
          }
        });
      }

      if (medium.length > 0) {
        console.log(chalk.blue(`\n🔵 MEDIUM Violations (${medium.length}):`));
        medium.forEach((v: any) => {
          console.log(chalk.blue(`  Line ${v.line || 'N/A'}: ${v.message}`));
        });
      }

      if (low.length > 0 && options.strict) {
        console.log(chalk.gray(`\n⚪ LOW Violations (${low.length}):`));
        low.forEach((v: any) => {
          console.log(chalk.gray(`  Line ${v.line || 'N/A'}: ${v.message}`));
        });
      }

      if (result.violations.length === 0) {
        console.log(chalk.green('\n✅ No violations found! Great job!'));
      }

      console.log('');

      // Exit code based on severity
      if (critical.length > 0) {
        process.exit(2);
      } else if (high.length > 0) {
        process.exit(1);
      }

    } catch (error) {
      console.error(chalk.red('❌ Error analyzing pipeline:'));
      console.error(chalk.red((error as Error).message));
      process.exit(1);
    }
  });

// Suggest command
program
  .command('suggest')
  .description('Get improvement suggestions for a pipeline')
  .requiredOption('-f, --file <file>', 'Pipeline file to analyze')
  .option('--focus <area>', 'Focus area (security, performance, all)', 'all')
  .action(async (options) => {
    try {
      console.log(chalk.blue('💡 Generating suggestions...'));
      console.log(chalk.gray(`  File: ${options.file}`));
      console.log(chalk.gray(`  Focus: ${options.focus}`));

      const content = readFileSync(options.file, 'utf-8');
      const wikiParser = new WikiParser('./wiki/standards');
      const analyzer = new PipelineAnalyzer(wikiParser);
      const result = await analyzer.analyze(content, { strictMode: false });

      console.log(chalk.cyan('\n📝 Improvement Suggestions'));
      console.log(chalk.gray('─'.repeat(50)));

      let suggestionCount = 0;

      // Security suggestions
      if (options.focus === 'all' || options.focus === 'security') {
        const securityIssues = result.violations.filter((v: any) =>
          v.message.toLowerCase().includes('secret') ||
          v.message.toLowerCase().includes('security') ||
          v.message.toLowerCase().includes('scan')
        );

        if (securityIssues.length > 0) {
          console.log(chalk.yellow('\n🔒 SECURITY IMPROVEMENTS:'));

          securityIssues.forEach((issue: any) => {
            suggestionCount++;
            console.log(chalk.white(`\n${suggestionCount}. ${issue.message}`));

            if (issue.message.includes('secret') || issue.message.includes('password')) {
              console.log(chalk.gray('   Replace with:'));
              console.log(chalk.green('   variables:'));
              console.log(chalk.green('     - group: your-variable-group'));
              console.log(chalk.gray('   or use:'));
              console.log(chalk.green('   - task: AzureKeyVault@2'));
            } else if (issue.message.includes('Security scanning')) {
              console.log(chalk.gray('   Add:'));
              console.log(chalk.green('   - task: TruffleHog@1'));
              console.log(chalk.green('     inputs:'));
              console.log(chalk.green('       failOnHighSeverity: true'));
            }
          });
        }
      }

      // Performance suggestions
      if (options.focus === 'all' || options.focus === 'performance') {
        const perfIssues = result.violations.filter((v: any) =>
          v.message.toLowerCase().includes('cache') ||
          v.message.toLowerCase().includes('artifact')
        );

        if (perfIssues.length > 0) {
          console.log(chalk.cyan('\n⚡ PERFORMANCE IMPROVEMENTS:'));

          perfIssues.forEach((issue: any) => {
            suggestionCount++;
            console.log(chalk.white(`\n${suggestionCount}. ${issue.message}`));

            if (issue.message.includes('cache')) {
              console.log(chalk.gray('   Add dependency caching:'));
              console.log(chalk.green('   - task: Cache@2'));
              console.log(chalk.green('     inputs:'));
              console.log(chalk.green('       key: \'npm | "$(Agent.OS)" | package-lock.json\''));
              console.log(chalk.green('       path: $(npm_config_cache)'));
            }
          });
        }
      }

      // General improvements
      if (suggestionCount === 0) {
        console.log(chalk.green('\n✅ Pipeline looks good! No major suggestions.'));
        console.log(chalk.gray('\nConsider these optional enhancements:'));
        console.log(chalk.gray('  • Add more comprehensive tests'));
        console.log(chalk.gray('  • Enable code coverage reporting'));
        console.log(chalk.gray('  • Add deployment stages for other environments'));
      } else {
        console.log(chalk.gray(`\n\n💡 Total suggestions: ${suggestionCount}`));
      }

      console.log('');

    } catch (error) {
      console.error(chalk.red('❌ Error generating suggestions:'));
      console.error(chalk.red((error as Error).message));
      process.exit(1);
    }
  });

program.parse(process.argv);
