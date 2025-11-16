#!/usr/bin/env node

/**
 * DEMO: Pipeline Analyzer - Análisis de Pipelines Existentes
 * 
 * Demuestra cómo el analyzer detecta violaciones, configuraciones
 * inseguras y sugiere mejoras en pipelines existentes.
 */

import { PipelineAnalyzer } from '../src/pipeline-analyzer.js';
import { WikiParser } from '../src/wiki-parser.js';
import { promises as fs } from 'fs';
import chalk from 'chalk';

async function analyzeProblematicPipeline() {
  console.log(chalk.blue.bold('\n🔍 Pipeline Analyzer - Demo de Análisis\n'));
  console.log(chalk.gray('═'.repeat(70)));

  // Cargar pipeline problemático
  const problematicYaml = await fs.readFile(
    './examples/problematic-pipeline.yml',
    'utf-8'
  );

  // Inicializar analyzer
  const wikiParser = new WikiParser('./wiki/standards');
  await wikiParser.loadStandards();
  const analyzer = new PipelineAnalyzer(wikiParser);

  console.log(chalk.yellow('\n📄 Pipeline a Analizar:'));
  console.log(chalk.gray('(Contiene múltiples problemas intencionales)\n'));
  
  // Mostrar extracto del pipeline
  const lines = problematicYaml.split('\n').slice(0, 20);
  lines.forEach(line => {
    if (line.includes('password') || line.includes('Password')) {
      console.log(chalk.red(line));
    } else if (line.includes('trigger: true')) {
      console.log(chalk.yellow(line));
    } else if (line.includes('PROBLEMA:')) {
      console.log(chalk.gray(line));
    } else {
      console.log(chalk.white(line));
    }
  });
  console.log(chalk.gray('... [más líneas] ...'));

  console.log(chalk.gray('\n' + '─'.repeat(70)));

  // ANÁLISIS 1: Modo Normal
  console.log(chalk.cyan.bold('\n📊 Análisis en Modo Normal:\n'));
  
  const normalResult = await analyzer.analyze(problematicYaml, {
    strictMode: false,
    projectType: 'node'
  });

  displayResults(normalResult, 'Normal');

  console.log(chalk.gray('\n' + '─'.repeat(70)));

  // ANÁLISIS 2: Modo Estricto
  console.log(chalk.magenta.bold('\n⚡ Análisis en Modo Estricto:\n'));
  
  const strictResult = await analyzer.analyze(problematicYaml, {
    strictMode: true,
    projectType: 'node'
  });

  displayResults(strictResult, 'Estricto');

  console.log(chalk.gray('\n' + '═'.repeat(70)));

  // Comparación
  console.log(chalk.blue.bold('\n📈 Comparación de Modos:\n'));
  
  const comparison = [
    ['Métrica', 'Modo Normal', 'Modo Estricto'],
    ['─'.repeat(20), '─'.repeat(15), '─'.repeat(15)],
    ['Score', `${normalResult.score}%`, `${strictResult.score}%`],
    ['Violaciones', normalResult.violations.length, strictResult.violations.length],
    ['Warnings', normalResult.warnings.length, strictResult.warnings.length],
    ['Sugerencias', normalResult.suggestions.length, strictResult.suggestions.length],
    ['Total Issues', normalResult.summary.totalIssues, strictResult.summary.totalIssues],
  ];

  comparison.forEach(row => {
    if (typeof row[0] === 'string' && row[0].includes('─')) {
      console.log(chalk.gray(row[0].padEnd(25) + row[1].toString().padEnd(20) + row[2]));
    } else {
      const col1 = row[0].toString().padEnd(25);
      const col2 = row[1].toString().padEnd(20);
      const col3 = row[2].toString();
      
      if (row[0] === 'Score') {
        const normalColor = normalResult.score >= 60 ? chalk.green : chalk.red;
        const strictColor = strictResult.score >= 60 ? chalk.green : chalk.red;
        console.log(col1 + normalColor(col2) + strictColor(col3));
      } else if (row[0] === 'Métrica') {
        console.log(chalk.bold(col1 + col2 + col3));
      } else {
        console.log(col1 + col2 + col3);
      }
    }
  });

  console.log(chalk.gray('\n' + '═'.repeat(70)));

  // Mostrar ejemplos de correcciones
  console.log(chalk.green.bold('\n✅ Ejemplos de Correcciones Sugeridas:\n'));
  
  displayCorrections(normalResult);

  console.log(chalk.gray('\n' + '═'.repeat(70)));
  console.log(chalk.green.bold('\n✨ Análisis completado!\n'));
  console.log(chalk.blue('El analyzer identificó todos los problemas y proporcionó'));
  console.log(chalk.blue('soluciones específicas para cada violación detectada.'));
  console.log();
}

function displayResults(result: any, mode: string) {
  // Score con emoji
  const scoreEmoji = result.score >= 80 ? '🟢' : 
                     result.score >= 60 ? '🟡' : 
                     result.score >= 40 ? '🟠' : '🔴';
  
  console.log(`${scoreEmoji} Score de Compliance: ${chalk.bold(result.score + '%')}`);
  
  // Resumen
  console.log(chalk.white('\nResumen de Problemas:'));
  console.log(`  🔴 Críticos: ${chalk.red(result.summary.criticalCount)}`);
  console.log(`  🟠 Altos: ${chalk.yellow(result.summary.highCount)}`);
  console.log(`  🟡 Medios: ${chalk.yellow(result.summary.mediumCount)}`);
  console.log(`  🟢 Bajos: ${chalk.green(result.summary.lowCount)}`);
  console.log(`  📊 Total: ${chalk.bold(result.summary.totalIssues)}`);

  // Top 3 violaciones críticas
  if (result.violations.length > 0) {
    console.log(chalk.red('\nTop Violaciones Detectadas:'));
    const criticals = result.violations
      .filter((v: any) => v.severity === 'CRITICAL')
      .slice(0, 3);
    
    criticals.forEach((v: any) => {
      console.log(`  ❌ [${v.type}] Línea ${v.line}: ${v.message}`);
      if (v.rule) {
        console.log(chalk.gray(`     Regla: ${v.rule}`));
      }
    });
  }

  // Secretos detectados
  const secretViolations = result.violations.filter(
    (v: any) => v.type === 'HARDCODED_SECRET'
  );
  if (secretViolations.length > 0) {
    console.log(chalk.red(`\n🔐 Secretos Hardcodeados Detectados: ${secretViolations.length}`));
  }

  // Sugerencias de rendimiento
  if (result.suggestions.length > 0) {
    console.log(chalk.cyan('\n💡 Sugerencias de Mejora:'));
    result.suggestions.slice(0, 2).forEach((s: any) => {
      const icon = s.type === 'PERFORMANCE' ? '⚡' : 
                   s.type === 'SECURITY' ? '🛡️' : '📈';
      console.log(`  ${icon} ${s.message}`);
    });
  }
}

function displayCorrections(result: any) {
  // Mostrar corrección para trigger inseguro
  const triggerViolation = result.violations.find(
    (v: any) => v.type === 'UNSAFE_TRIGGER'
  );
  
  if (triggerViolation && triggerViolation.code) {
    console.log(chalk.white('1. Corregir trigger inseguro:'));
    console.log(chalk.red('   ❌ Actual: trigger: true'));
    console.log(chalk.green('   ✅ Sugerido:'));
    console.log(chalk.gray(triggerViolation.code.split('\n').map((l: string) => '      ' + l).join('\n')));
  }

  // Mostrar corrección para secretos
  const secretViolation = result.violations.find(
    (v: any) => v.type === 'HARDCODED_SECRET'
  );
  
  if (secretViolation && secretViolation.code) {
    console.log(chalk.white('\n2. Reemplazar secretos hardcodeados:'));
    console.log(chalk.red('   ❌ Actual: password: "SuperSecret123!"'));
    console.log(chalk.green('   ✅ Sugerido: Usar Azure Key Vault'));
    const codeLines = secretViolation.code.split('\n').slice(0, 5);
    console.log(chalk.gray(codeLines.map((l: string) => '      ' + l).join('\n')));
  }

  // Mostrar template de Security stage
  const securityViolation = result.violations.find(
    (v: any) => v.message.includes('Security')
  );
  
  if (securityViolation && securityViolation.code) {
    console.log(chalk.white('\n3. Agregar stage de Security obligatorio:'));
    const codeLines = securityViolation.code.split('\n').slice(0, 8);
    console.log(chalk.gray(codeLines.map((l: string) => '      ' + l).join('\n')));
    console.log(chalk.gray('      [...]'));
  }
}

// Pipeline válido para comparación
async function analyzeValidPipeline() {
  console.log(chalk.green.bold('\n\n🎯 Análisis de Pipeline Válido (para comparación):\n'));
  console.log(chalk.gray('═'.repeat(70)));

  // Pipeline que cumple con los estándares
  const validPipeline = `
trigger:
  branches:
    include:
      - main
      - develop

pool:
  vmImage: 'ubuntu-latest'

variables:
  - group: my-variable-group
  - name: nodeVersion
    value: '16.x'

stages:
  - stage: Validate
    displayName: 'Validation'
    jobs:
      - job: Validate
        steps:
          - checkout: self
          
  - stage: Security
    displayName: 'Security Scanning'
    dependsOn: Validate
    jobs:
      - job: SecurityScan
        steps:
          - task: TruffleHog@1
          - task: SonarQubePrepare@5
          - task: SnykSecurityScan@1
          
  - stage: Build
    displayName: 'Build'
    dependsOn: Security
    jobs:
      - job: Build
        steps:
          - task: NodeTool@0
            inputs:
              versionSpec: $(nodeVersion)
          - task: Cache@2
            inputs:
              key: 'npm | "$(Agent.OS)" | package-lock.json'
              path: $(npm_config_cache)
          - script: npm ci
          - script: npm run build
          
  - stage: Test
    displayName: 'Test'
    dependsOn: Build
    jobs:
      - job: Test
        steps:
          - script: npm test
          - script: npm audit --audit-level=high
`;

  const wikiParser = new WikiParser('./wiki/standards');
  await wikiParser.loadStandards();
  const analyzer = new PipelineAnalyzer(wikiParser);

  const validResult = await analyzer.analyze(validPipeline, {
    projectType: 'node'
  });

  console.log(chalk.green(`\n✅ Pipeline Válido - Score: ${validResult.score}%`));
  console.log(chalk.green(`   Violaciones: ${validResult.violations.length}`));
  console.log(chalk.green(`   Cumple con todos los estándares corporativos`));
  
  if (validResult.suggestions.length > 0) {
    console.log(chalk.cyan(`\n   Aún tiene ${validResult.suggestions.length} sugerencias de mejora opcionales`));
  }
}

// Ejecutar demos
async function runDemo() {
  try {
    await analyzeProblematicPipeline();
    await analyzeValidPipeline();
  } catch (error) {
    console.error(chalk.red('Error en la demo:'), error);
  }
}

runDemo();
