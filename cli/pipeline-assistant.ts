#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import chalk from 'chalk';
import { getContainer } from '../src/container.js';
import { MultiPlatformGenerator } from '../src/multi-platform-generator.js';
import { PlatformFactory, PlatformType, getDefaultOutputFile } from '../src/platforms/index.js';
import { detectPlatform } from '../src/platforms/index.js';

const program = new Command();

program
  .name('pipeline-assistant')
  .description('CLI tool for generating and analyzing CI/CD pipelines')
  .version('1.0.0');

// Generate command
program
  .command('generate')
  .description('Generate a CI/CD pipeline for Azure DevOps or GitHub Actions')
  .requiredOption('-p, --platform <platform>', 'Target platform (azure-devops, github-actions)')
  .option('-t, --type <type>', 'Project type (dotnet, node, python, java, go)', 'node')
  .option('-s, --services <services>', 'Cloud services (comma-separated: redis,azuresql,cosmosdb,keyvault,servicebus,storage)', '')
  .option('-e, --env <environment>', 'Target environment (dev, staging, prod)', 'dev')
  .option('-o, --output <file>', 'Output file (default: platform-specific)')
  .option('--docker', 'Include Docker build and container scanning', false)
  .option('--strict', 'Apply strict security policies (fail on any issue)', false)
  .option('--no-security', 'Skip security scanning stage')
  .action(async (options) => {
    try {
      // Validate platform
      const platform = options.platform as PlatformType;
      if (!PlatformFactory.isSupported(platform)) {
        console.error(chalk.red(`❌ Unsupported platform: ${platform}`));
        console.error(chalk.gray(`Supported platforms: ${PlatformFactory.getSupportedPlatforms().join(', ')}`));
        console.error(chalk.gray('\nUse "pipeline-assistant platforms" to see all available platforms'));
        process.exit(1);
      }

      // Validate project type
      const validTypes = ['dotnet', 'node', 'python', 'java', 'go'];
      if (!validTypes.includes(options.type)) {
        console.error(chalk.red(`❌ Unsupported project type: ${options.type}`));
        console.error(chalk.gray(`Supported types: ${validTypes.join(', ')}`));
        process.exit(1);
      }

      // Validate environment
      const validEnvs = ['dev', 'staging', 'prod'];
      if (!validEnvs.includes(options.env)) {
        console.error(chalk.red(`❌ Invalid environment: ${options.env}`));
        console.error(chalk.gray(`Valid environments: ${validEnvs.join(', ')}`));
        process.exit(1);
      }

      // Determine output file
      const outputFile = options.output || getDefaultOutputFile(platform);

      // Create directory if needed (for .github/workflows)
      const dir = dirname(outputFile);
      if (dir && dir !== '.' && !existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      const platformLabel = platform === 'azure-devops' ? 'Azure Pipelines' : 'GitHub Actions';

      console.log(chalk.blue('🚀 Generating pipeline...'));
      console.log(chalk.gray(`  Platform: ${platformLabel}`));
      console.log(chalk.gray(`  Type: ${options.type}`));
      console.log(chalk.gray(`  Environment: ${options.env}`));

      // Use DI container for service management
      const container = getContainer();
      const wikiParser = container.getWikiParser();

      const services = options.services
        ? options.services.split(',').map((s: string) => s.trim()).filter(Boolean)
        : [];

      if (services.length > 0) {
        console.log(chalk.gray(`  Services: ${services.join(', ')}`));
      }

      if (options.docker) {
        console.log(chalk.gray(`  Docker: enabled`));
      }

      if (options.strict) {
        console.log(chalk.gray(`  Mode: strict`));
      }

      if (!options.security) {
        console.log(chalk.yellow(`  ⚠️  Security scanning disabled`));
      }

      // Load standards
      await wikiParser.loadStandards();
      const standards = await wikiParser.getStandardsForProject(options.type);

      // Use MultiPlatformGenerator for cross-platform support
      const multiPlatformGenerator = new MultiPlatformGenerator(wikiParser);

      const pipeline = await multiPlatformGenerator.generatePipeline({
        projectType: options.type as any,
        services,
        environment: options.env as any,
        standards,
        platform,
        usesDocker: options.docker,
        enforceAllPolicies: options.security !== false,
      });

      writeFileSync(outputFile, pipeline, 'utf-8');

      console.log(chalk.green(`\n✅ Pipeline generated successfully!`));
      console.log(chalk.gray(`  Output: ${outputFile}`));

      // Show stats
      const lines = pipeline.split('\n').length;
      const stages = (pipeline.match(/stage:|jobs:/g) || []).length;
      const tasks = (pipeline.match(/task:|uses:/g) || []).length;

      console.log(chalk.cyan('\n📊 Pipeline Stats:'));
      console.log(chalk.gray(`  Lines: ${lines}`));
      console.log(chalk.gray(`  Stages/Jobs: ${stages}`));
      console.log(chalk.gray(`  Tasks/Actions: ${tasks}`));

      // Show next steps
      console.log(chalk.cyan('\n📝 Next steps:'));
      if (platform === 'azure-devops') {
        console.log(chalk.gray('  1. Commit azure-pipelines.yml to your repository'));
        console.log(chalk.gray('  2. Create a new pipeline in Azure DevOps'));
        console.log(chalk.gray('  3. Configure service connections (SonarQube, Snyk, ACR)'));
      } else {
        console.log(chalk.gray('  1. Commit the workflow to .github/workflows/'));
        console.log(chalk.gray('  2. Add secrets (SONAR_TOKEN, SNYK_TOKEN, CODECOV_TOKEN)'));
        console.log(chalk.gray('  3. Configure environment protection rules'));
      }

    } catch (error) {
      console.error(chalk.red('❌ Error generating pipeline:'));
      console.error(chalk.red((error as Error).message));
      process.exit(1);
    }
  });

// Platforms command - list supported platforms
program
  .command('platforms')
  .description('List all supported CI/CD platforms')
  .action(() => {
    console.log(chalk.blue('\n📋 Supported Platforms:\n'));

    const platforms = [
      {
        id: 'azure-devops',
        name: 'Azure DevOps Pipelines',
        output: 'azure-pipelines.yml',
        status: '✅ Available',
      },
      {
        id: 'github-actions',
        name: 'GitHub Actions',
        output: '.github/workflows/ci-cd.yml',
        status: '✅ Available',
      },
      {
        id: 'gitlab-ci',
        name: 'GitLab CI/CD',
        output: '.gitlab-ci.yml',
        status: '🚧 Coming soon',
      },
    ];

    platforms.forEach(p => {
      console.log(chalk.white(`  ${p.status} ${p.name}`));
      console.log(chalk.gray(`     ID: ${p.id}`));
      console.log(chalk.gray(`     Output: ${p.output}\n`));
    });

    console.log(chalk.gray('Usage: pipeline-assistant generate --platform <id> --type <type>\n'));
  });

// Templates command - list available templates
program
  .command('templates')
  .description('List available pipeline templates')
  .option('-p, --platform <platform>', 'Filter by platform')
  .action((options) => {
    console.log(chalk.blue('\n📋 Available Templates:\n'));

    const templates = {
      'azure-devops': [
        { type: 'dotnet', desc: '.NET 8 microservice with Azure services' },
        { type: 'node', desc: 'Node.js 20 application with npm' },
        { type: 'python', desc: 'Python 3.11 application with pip' },
      ],
      'github-actions': [
        { type: 'dotnet', desc: '.NET 8 microservice with Azure/AWS' },
        { type: 'node', desc: 'Node.js 20 application with npm' },
        { type: 'python', desc: 'Python 3.11 application with pip' },
      ],
    };

    const platforms = options.platform
      ? [options.platform]
      : Object.keys(templates);

    platforms.forEach(platform => {
      const platformTemplates = templates[platform as keyof typeof templates];
      if (!platformTemplates) {
        console.log(chalk.yellow(`  ⚠️  Unknown platform: ${platform}`));
        return;
      }

      const label = platform === 'azure-devops' ? 'Azure DevOps' : 'GitHub Actions';
      console.log(chalk.white(`  ${label}:`));

      platformTemplates.forEach(t => {
        console.log(chalk.gray(`    • ${t.type}: ${t.desc}`));
      });
      console.log('');
    });

    console.log(chalk.gray('Usage: pipeline-assistant generate --platform <platform> --type <type>\n'));
  });

// Services command - list supported cloud services
program
  .command('services')
  .description('List supported cloud services')
  .action(() => {
    console.log(chalk.blue('\n📋 Supported Cloud Services:\n'));

    const services = [
      { id: 'redis', name: 'Redis Cache', category: 'Caching' },
      { id: 'azuresql', name: 'Azure SQL Database', category: 'Database' },
      { id: 'cosmosdb', name: 'Azure Cosmos DB', category: 'Database' },
      { id: 'postgresql', name: 'PostgreSQL', category: 'Database' },
      { id: 'servicebus', name: 'Azure Service Bus', category: 'Messaging' },
      { id: 'eventhub', name: 'Azure Event Hub', category: 'Messaging' },
      { id: 'storage', name: 'Azure Blob Storage', category: 'Storage' },
      { id: 'keyvault', name: 'Azure Key Vault', category: 'Secrets' },
    ];

    const categories = [...new Set(services.map(s => s.category))];

    categories.forEach(category => {
      console.log(chalk.white(`  ${category}:`));
      services
        .filter(s => s.category === category)
        .forEach(s => {
          console.log(chalk.gray(`    • ${s.id}: ${s.name}`));
        });
      console.log('');
    });

    console.log(chalk.gray('Usage: pipeline-assistant generate --services redis,azuresql,keyvault\n'));
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

      // Use DI container for service management
      const container = getContainer();
      const analyzer = container.getPipelineAnalyzer();

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

      // Use DI container for service management
      const container = getContainer();
      const analyzer = container.getPipelineAnalyzer();

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
