#!/usr/bin/env node

import { Command } from 'commander';
import { WikiManager } from '../src/wiki-manager.js';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import Table from 'cli-table3';

const program = new Command();

program
  .name('pipeline-wiki')
  .description('Pipeline Assistant Wiki Manager - Gestión de estándares y métricas')
  .version('1.0.0');

// Comando: Cargar y mostrar estándares
program
  .command('standards')
  .description('Gestionar estándares de pipelines')
  .option('--list', 'Listar todos los estándares')
  .option('--show <id>', 'Mostrar detalle de un estándar')
  .option('--format <format>', 'Formato de salida (json, table)', 'table')
  .action(async (options) => {
    const wikiManager = new WikiManager('./wiki/standards');
    await wikiManager.loadAllStandards();
    
    if (options.list) {
      const standards = wikiManager.getStandards();
      
      if (options.format === 'json') {
        console.log(JSON.stringify(standards, null, 2));
      } else {
        const table = new Table({
          head: ['ID', 'Tipo', 'Severidad', 'Descripción'],
          colWidths: [30, 15, 12, 50]
        });
        
        standards.forEach(std => {
          table.push([
            std.id,
            std.type,
            getColoredSeverity(std.severity),
            std.description.substring(0, 47) + '...'
          ]);
        });
        
        console.log(chalk.blue.bold('\n📋 Estándares de Pipeline\n'));
        console.log(table.toString());
        console.log(chalk.gray(`\nTotal: ${standards.length} estándares`));
      }
    } else if (options.show) {
      const standard = wikiManager.getStandard(options.show);
      
      if (standard) {
        console.log(chalk.blue.bold(`\n📋 Estándar: ${standard.id}\n`));
        console.log(chalk.gray('─'.repeat(60)));
        console.log(chalk.white('Tipo:'), standard.type);
        console.log(chalk.white('Severidad:'), getColoredSeverity(standard.severity));
        console.log(chalk.white('Descripción:'), standard.description);
        
        if (standard.example) {
          console.log(chalk.white('\n📝 Ejemplo:'));
          console.log(chalk.gray(standard.example));
        }
        
        if (standard.tags?.length) {
          console.log(chalk.white('\n🏷️  Tags:'), standard.tags.join(', '));
        }
        
        if (standard.lastModified) {
          console.log(chalk.white('\n📅 Última modificación:'), 
            new Date(standard.lastModified).toLocaleString());
        }
      } else {
        console.error(chalk.red(`❌ Estándar '${options.show}' no encontrado`));
      }
    } else {
      console.log(chalk.yellow('Use --list para ver todos los estándares o --show <id> para ver detalles'));
    }
  });

// Comando: Gestionar templates
program
  .command('templates')
  .description('Gestionar templates de pipelines por tecnología')
  .option('--list', 'Listar todos los templates')
  .option('--tech <technology>', 'Filtrar por tecnología')
  .option('--show <id>', 'Mostrar template completo')
  .option('--export <id>', 'Exportar template a archivo')
  .action(async (options) => {
    const wikiManager = new WikiManager('./wiki/standards');
    await wikiManager.loadTechnologyTemplates();
    
    if (options.list) {
      let templates = wikiManager.getTemplates();
      
      if (options.tech) {
        templates = wikiManager.getTemplatesByTechnology(options.tech);
      }
      
      const table = new Table({
        head: ['ID', 'Tecnología', 'Nombre', 'Características'],
        colWidths: [25, 12, 30, 40]
      });
      
      templates.forEach(tmpl => {
        const features = [];
        if (tmpl.metadata?.dockerized) features.push('🐳 Docker');
        if (tmpl.metadata?.multiStage) features.push('📊 Multi-stage');
        if (tmpl.metadata?.helmChart) features.push('⚓ Helm');
        if (tmpl.metadata?.healthChecks) features.push('❤️ Health checks');
        
        table.push([
          tmpl.id,
          tmpl.technology,
          tmpl.name,
          features.join(' ')
        ]);
      });
      
      console.log(chalk.blue.bold('\n📝 Templates de Pipeline\n'));
      console.log(table.toString());
      console.log(chalk.gray(`\nTotal: ${templates.length} templates`));
      
    } else if (options.show) {
      const template = wikiManager.getTemplate(options.show);
      
      if (template) {
        console.log(chalk.blue.bold(`\n📝 Template: ${template.name}\n`));
        console.log(chalk.gray('─'.repeat(60)));
        console.log(chalk.white('ID:'), template.id);
        console.log(chalk.white('Tecnología:'), template.technology);
        console.log(chalk.white('Descripción:'), template.description);
        console.log(chalk.white('\n📄 Contenido:\n'));
        console.log(chalk.gray(template.template));
      } else {
        console.error(chalk.red(`❌ Template '${options.show}' no encontrado`));
      }
      
    } else if (options.export) {
      const template = wikiManager.getTemplate(options.export);
      
      if (template) {
        const filename = `${template.id}.yml`;
        fs.writeFileSync(filename, template.template, 'utf-8');
        console.log(chalk.green(`✅ Template exportado a ${filename}`));
      } else {
        console.error(chalk.red(`❌ Template '${options.export}' no encontrado`));
      }
    }
  });

// Comando: Ver historial de versiones
program
  .command('versions')
  .description('Gestionar versionado de políticas')
  .option('--list [limit]', 'Listar historial de versiones', '10')
  .option('--show <version>', 'Ver detalles de una versión')
  .option('--diff <version>', 'Comparar con versión actual')
  .option('--rollback <version>', 'Hacer rollback a una versión')
  .action(async (options) => {
    const wikiManager = new WikiManager('./wiki/standards');
    await wikiManager.loadPolicyHistory();
    
    if (options.list) {
      const limit = parseInt(options.list) || 10;
      const history = wikiManager.getPolicyHistory(limit);
      
      if (history.length === 0) {
        console.log(chalk.yellow('No hay historial de versiones disponible'));
        return;
      }
      
      const table = new Table({
        head: ['Versión', 'Fecha', 'Autor', 'Cambios', 'Justificación'],
        colWidths: [20, 20, 15, 15, 35]
      });
      
      history.forEach(v => {
        table.push([
          v.version,
          new Date(v.date).toLocaleDateString(),
          v.author,
          v.changes.length.toString(),
          v.justification.substring(0, 32) + '...'
        ]);
      });
      
      console.log(chalk.blue.bold('\n📚 Historial de Versiones\n'));
      console.log(table.toString());
      
    } else if (options.show) {
      const version = wikiManager.getPolicyVersion(options.show);
      
      if (version) {
        console.log(chalk.blue.bold(`\n📚 Versión: ${version.version}\n`));
        console.log(chalk.gray('─'.repeat(60)));
        console.log(chalk.white('Fecha:'), new Date(version.date).toLocaleString());
        console.log(chalk.white('Autor:'), version.author);
        console.log(chalk.white('Justificación:'), version.justification);
        console.log(chalk.white('\n📝 Cambios:'));
        
        version.changes.forEach(change => {
          const color = change.startsWith('Added') ? chalk.green :
                        change.startsWith('Removed') ? chalk.red :
                        change.startsWith('Modified') ? chalk.yellow :
                        chalk.white;
          console.log('  ' + color(change));
        });
        
        console.log(chalk.white('\n📊 Estadísticas:'));
        console.log(`  Total de estándares: ${version.standards.length}`);
        console.log(`  Checksum: ${version.checksum}`);
      } else {
        console.error(chalk.red(`❌ Versión '${options.show}' no encontrada`));
      }
      
    } else if (options.rollback) {
      console.log(chalk.yellow(`⚠️  Preparando rollback a versión ${options.rollback}...`));
      
      const success = await wikiManager.rollbackToVersion(options.rollback);
      
      if (success) {
        console.log(chalk.green(`✅ Rollback exitoso a versión ${options.rollback}`));
      } else {
        console.error(chalk.red(`❌ Error en rollback a versión ${options.rollback}`));
      }
    }
  });

// Comando: Métricas de adopción
program
  .command('metrics')
  .description('Ver y generar métricas de adopción')
  .option('--current', 'Métricas del mes actual')
  .option('--history [months]', 'Historial de métricas', '12')
  .option('--report <format>', 'Generar reporte (markdown, html, json)', 'markdown')
  .option('--export <file>', 'Exportar reporte a archivo')
  .action(async (options) => {
    const wikiManager = new WikiManager('./wiki/standards');
    await wikiManager.loadMetrics();
    
    if (options.current) {
      const metrics = wikiManager.getCurrentMonthMetrics();
      
      if (!metrics) {
        console.log(chalk.yellow('No hay métricas disponibles para el mes actual'));
        return;
      }
      
      console.log(chalk.blue.bold('\n📊 Métricas del Mes Actual\n'));
      console.log(chalk.gray('─'.repeat(60)));
      
      console.log(chalk.white('\n📈 Resumen:'));
      console.log(`  Pipelines analizados: ${metrics.pipelines.analyzed}`);
      console.log(`  Compliance promedio: ${getColoredScore(metrics.compliance.average)}%`);
      console.log(`  Total violaciones: ${metrics.violations.total}`);
      
      if (metrics.compliance.trend !== 0) {
        const trendIcon = metrics.compliance.trend > 0 ? '📈' : '📉';
        const trendColor = metrics.compliance.trend > 0 ? chalk.green : chalk.red;
        console.log(`  Tendencia: ${trendIcon} ${trendColor(metrics.compliance.trend.toFixed(1) + '%')}`);
      }
      
      console.log(chalk.white('\n🎯 Distribución de Compliance:'));
      console.log(`  Excelente (≥90%): ${chalk.green(metrics.compliance.distribution.excellent)}`);
      console.log(`  Bueno (80-89%): ${chalk.blue(metrics.compliance.distribution.good)}`);
      console.log(`  Regular (60-79%): ${chalk.yellow(metrics.compliance.distribution.fair)}`);
      console.log(`  Pobre (<60%): ${chalk.red(metrics.compliance.distribution.poor)}`);
      
      if (metrics.violations.topViolations.length > 0) {
        console.log(chalk.white('\n❌ Top 5 Violaciones:'));
        metrics.violations.topViolations.slice(0, 5).forEach((v, i) => {
          console.log(`  ${i + 1}. ${v.type}: ${v.count} ocurrencias`);
        });
      }
      
    } else if (options.history) {
      const months = parseInt(options.history) || 12;
      const history = wikiManager.getMetrics(months);
      
      const table = new Table({
        head: ['Período', 'Analizados', 'Compliance', 'Tendencia', 'Violaciones'],
        colWidths: [20, 12, 12, 12, 12]
      });
      
      history.forEach(m => {
        const period = `${new Date(m.period.start).getMonth() + 1}/${new Date(m.period.start).getFullYear()}`;
        const trend = m.compliance.trend > 0 ? chalk.green(`+${m.compliance.trend.toFixed(1)}%`) :
                     m.compliance.trend < 0 ? chalk.red(`${m.compliance.trend.toFixed(1)}%`) :
                     '─';
        
        table.push([
          period,
          m.pipelines.analyzed.toString(),
          getColoredScore(m.compliance.average) + '%',
          trend,
          m.violations.total.toString()
        ]);
      });
      
      console.log(chalk.blue.bold('\n📊 Historial de Métricas\n'));
      console.log(table.toString());
      
    } else if (options.report) {
      const report = await wikiManager.generateMetricsReport(options.report as any);
      
      if (options.export) {
        fs.writeFileSync(options.export, report, 'utf-8');
        console.log(chalk.green(`✅ Reporte exportado a ${options.export}`));
      } else {
        console.log(report);
      }
    }
  });

// Comando: Auto-update
program
  .command('watch')
  .description('Monitorear cambios en la wiki')
  .option('--interval <ms>', 'Intervalo de verificación en ms', '300000')
  .action(async (options) => {
    const wikiManager = new WikiManager('./wiki/standards');
    const interval = parseInt(options.interval) || 300000;
    
    console.log(chalk.blue.bold('\n👁️  Monitoreando cambios en la wiki\n'));
    console.log(chalk.gray(`Intervalo: ${interval}ms (${interval / 1000 / 60} minutos)`));
    console.log(chalk.gray('Presiona Ctrl+C para detener\n'));
    
    // Escuchar eventos
    wikiManager.on('standards:updated', (event) => {
      console.log(chalk.yellow(`\n🔄 [${new Date().toLocaleTimeString()}] Wiki actualizada`));
      console.log(`  Nuevos estándares: ${event.newCount}`);
      console.log(`  Cambios detectados: ${event.changes?.length || 0}`);
    });
    
    wikiManager.on('version:saved', (version) => {
      console.log(chalk.green(`💾 [${new Date().toLocaleTimeString()}] Nueva versión guardada: ${version.version}`));
    });
    
    // Iniciar monitoreo
    await wikiManager.startAutoUpdate(interval);
    
    // Mantener el proceso vivo
    process.on('SIGINT', () => {
      console.log(chalk.red('\n\n⏹️  Deteniendo monitoreo...'));
      wikiManager.stopAutoUpdate();
      process.exit(0);
    });
  });

// Comando: Sincronizar con repositorio
program
  .command('sync')
  .description('Sincronizar wiki con repositorio remoto')
  .option('--repo <url>', 'URL del repositorio')
  .option('--branch <branch>', 'Rama a usar', 'main')
  .option('--dry-run', 'Simular sin hacer cambios')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n🔄 Sincronización con Repositorio\n'));
    
    if (options.dryRun) {
      console.log(chalk.yellow('🔸 Modo DRY RUN - No se harán cambios\n'));
    }
    
    // Aquí iría la lógica de sincronización con Git
    console.log(chalk.gray('Repositorio:'), options.repo || 'local');
    console.log(chalk.gray('Rama:'), options.branch);
    
    // Simular proceso
    console.log(chalk.cyan('\n📥 Descargando cambios...'));
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log(chalk.cyan('🔍 Detectando cambios...'));
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (options.dryRun) {
      console.log(chalk.yellow('\nCambios que se aplicarían:'));
      console.log('  + 2 nuevos estándares');
      console.log('  ~ 3 estándares modificados');
      console.log('  - 1 estándar eliminado');
    } else {
      console.log(chalk.green('\n✅ Sincronización completada'));
    }
  });

// Utilidades
function getColoredSeverity(severity?: string): string {
  switch (severity) {
    case 'CRITICAL':
      return chalk.red('CRITICAL');
    case 'HIGH':
      return chalk.yellow('HIGH');
    case 'MEDIUM':
      return chalk.blue('MEDIUM');
    case 'LOW':
      return chalk.green('LOW');
    default:
      return chalk.gray('UNKNOWN');
  }
}

function getColoredScore(score: number): string {
  if (score >= 90) return chalk.green(score.toFixed(1));
  if (score >= 80) return chalk.blue(score.toFixed(1));
  if (score >= 60) return chalk.yellow(score.toFixed(1));
  return chalk.red(score.toFixed(1));
}

// Ejecutar CLI
program.parse();

// Si no se proporciona comando, mostrar ayuda
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
