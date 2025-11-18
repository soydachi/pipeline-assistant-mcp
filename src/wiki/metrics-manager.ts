/**
 * Metrics Manager
 *
 * Tracks and reports adoption metrics for pipeline standards
 */

import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '../utils/logger.js';
import type { AdoptionMetrics } from './types.js';

const logger = createLogger('MetricsManager');

// Violation type descriptions
const VIOLATION_DESCRIPTIONS: Record<string, string> = {
  MISSING_STAGE: 'Stage obligatorio faltante',
  HARDCODED_SECRET: 'Secreto hardcodeado en código',
  NO_SECURITY_SCAN: 'Sin análisis de seguridad',
  UNSAFE_TRIGGER: 'Configuración de trigger insegura',
  MISSING_CACHE: 'No usa caché para dependencias',
  NO_TESTS: 'Sin ejecución de tests',
  SECURITY_BYPASS: 'Bypass de verificación de seguridad',
};

export class MetricsManager {
  private metrics: AdoptionMetrics[] = [];
  private wikiPath: string;

  constructor(wikiPath: string) {
    this.wikiPath = wikiPath;
  }

  async recordMetrics(analysisResults: any[]): Promise<void> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let currentMetrics = this.metrics.find(
      (m) =>
        m.period.start.getMonth() === now.getMonth() &&
        m.period.start.getFullYear() === now.getFullYear()
    );

    if (!currentMetrics) {
      currentMetrics = this.createEmptyMetrics(startOfMonth, now);
      this.metrics.push(currentMetrics);
    }

    analysisResults.forEach((result) => {
      currentMetrics!.pipelines.analyzed++;

      const scores = result.score || 0;
      currentMetrics!.compliance.average =
        (currentMetrics!.compliance.average * (currentMetrics!.pipelines.analyzed - 1) +
          scores) /
        currentMetrics!.pipelines.analyzed;

      if (scores >= 90) currentMetrics!.compliance.distribution.excellent++;
      else if (scores >= 80) currentMetrics!.compliance.distribution.good++;
      else if (scores >= 60) currentMetrics!.compliance.distribution.fair++;
      else currentMetrics!.compliance.distribution.poor++;

      if (result.violations) {
        result.violations.forEach((v: any) => {
          currentMetrics!.violations.total++;

          const count = currentMetrics!.violations.byType.get(v.type) || 0;
          currentMetrics!.violations.byType.set(v.type, count + 1);

          switch (v.severity) {
            case 'CRITICAL':
              currentMetrics!.violations.bySeverity.critical++;
              break;
            case 'HIGH':
              currentMetrics!.violations.bySeverity.high++;
              break;
            case 'MEDIUM':
              currentMetrics!.violations.bySeverity.medium++;
              break;
            case 'LOW':
              currentMetrics!.violations.bySeverity.low++;
              break;
          }
        });
      }
    });

    this.updateTopViolations(currentMetrics);
    this.calculateTrends(currentMetrics);
    await this.saveMetrics();
  }

  private createEmptyMetrics(start: Date, end: Date): AdoptionMetrics {
    return {
      period: { start, end },
      pipelines: {
        analyzed: 0,
        generated: 0,
        fixed: 0,
      },
      compliance: {
        average: 0,
        trend: 0,
        distribution: {
          excellent: 0,
          good: 0,
          fair: 0,
          poor: 0,
        },
      },
      violations: {
        total: 0,
        byType: new Map(),
        bySeverity: {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
        },
        topViolations: [],
      },
      improvements: {
        monthOverMonth: 0,
        resolvedIssues: 0,
        newAdoptions: 0,
      },
    };
  }

  private updateTopViolations(metrics: AdoptionMetrics): void {
    const violations = Array.from(metrics.violations.byType.entries())
      .map(([type, count]) => ({
        type,
        count,
        description: VIOLATION_DESCRIPTIONS[type] || type,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    metrics.violations.topViolations = violations;
  }

  private calculateTrends(currentMetrics: AdoptionMetrics): void {
    if (this.metrics.length < 2) return;

    const previousMetrics = this.metrics[this.metrics.length - 2];

    currentMetrics.compliance.trend =
      currentMetrics.compliance.average - previousMetrics.compliance.average;

    currentMetrics.improvements.monthOverMonth =
      ((currentMetrics.compliance.average - previousMetrics.compliance.average) /
        previousMetrics.compliance.average) *
      100;

    const prevTotal = previousMetrics.violations.total;
    const currTotal = currentMetrics.violations.total;
    const analyzed = currentMetrics.pipelines.analyzed;

    if (analyzed > 0) {
      const avgViolationsPerPipeline = currTotal / analyzed;
      const expectedViolations = avgViolationsPerPipeline * previousMetrics.pipelines.analyzed;
      currentMetrics.improvements.resolvedIssues = Math.max(0, prevTotal - expectedViolations);
    }
  }

  private async saveMetrics(): Promise<void> {
    const metricsFile = path.join(this.wikiPath, '.adoption-metrics.json');

    try {
      const metricsToSave = this.metrics.map((m) => ({
        ...m,
        violations: {
          ...m.violations,
          byType: Array.from(m.violations.byType.entries()),
        },
      }));

      await fs.promises.writeFile(metricsFile, JSON.stringify(metricsToSave, null, 2), 'utf-8');
    } catch (error) {
      logger.error('Error saving metrics', {
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  async loadMetrics(): Promise<void> {
    const metricsFile = path.join(this.wikiPath, '.adoption-metrics.json');

    if (fs.existsSync(metricsFile)) {
      try {
        const content = await fs.promises.readFile(metricsFile, 'utf-8');
        const loaded = JSON.parse(content);

        this.metrics = loaded.map((m: any) => ({
          ...m,
          period: {
            start: new Date(m.period.start),
            end: new Date(m.period.end),
          },
          violations: {
            ...m.violations,
            byType: new Map(m.violations.byType),
          },
        }));

        logger.info('Metrics loaded', { periods: this.metrics.length });
      } catch (error) {
        logger.error('Error loading metrics', {
          error: error instanceof Error ? error.message : error,
        });
      }
    }
  }

  async generateReport(format: 'json' | 'html' | 'markdown' = 'markdown'): Promise<string> {
    const latestMetrics = this.metrics[this.metrics.length - 1];

    if (!latestMetrics) {
      return 'No metrics available';
    }

    switch (format) {
      case 'json':
        return JSON.stringify(latestMetrics, null, 2);
      case 'html':
        return this.generateHtmlReport(latestMetrics);
      case 'markdown':
      default:
        return this.generateMarkdownReport(latestMetrics);
    }
  }

  private generateMarkdownReport(metrics: AdoptionMetrics): string {
    const period = `${metrics.period.start.toLocaleDateString()} - ${metrics.period.end.toLocaleDateString()}`;

    let report = `# Métricas de Adopción - Pipeline Assistant\n\n`;
    report += `**Período**: ${period}\n\n`;

    report += `## Resumen Ejecutivo\n\n`;
    report += `| Métrica | Valor |\n`;
    report += `|---------|-------|\n`;
    report += `| Pipelines Analizados | ${metrics.pipelines.analyzed} |\n`;
    report += `| Compliance Promedio | ${metrics.compliance.average.toFixed(1)}% |\n`;
    report += `| Total de Violaciones | ${metrics.violations.total} |\n`;
    report += `| Tendencia vs Mes Anterior | ${metrics.compliance.trend >= 0 ? '+' : ''}${metrics.compliance.trend.toFixed(1)}% |\n\n`;

    report += `## Distribución de Compliance\n\n`;
    report += `| Categoría | Cantidad | Porcentaje |\n`;
    report += `|-----------|----------|------------|\n`;

    const total = metrics.pipelines.analyzed || 1;
    report += `| Excelente (>=90%) | ${metrics.compliance.distribution.excellent} | ${((metrics.compliance.distribution.excellent / total) * 100).toFixed(1)}% |\n`;
    report += `| Bueno (80-89%) | ${metrics.compliance.distribution.good} | ${((metrics.compliance.distribution.good / total) * 100).toFixed(1)}% |\n`;
    report += `| Regular (60-79%) | ${metrics.compliance.distribution.fair} | ${((metrics.compliance.distribution.fair / total) * 100).toFixed(1)}% |\n`;
    report += `| Pobre (<60%) | ${metrics.compliance.distribution.poor} | ${((metrics.compliance.distribution.poor / total) * 100).toFixed(1)}% |\n\n`;

    report += `## Top 10 Violaciones\n\n`;
    report += `| # | Tipo | Ocurrencias | Descripción |\n`;
    report += `|---|------|-------------|-------------|\n`;

    metrics.violations.topViolations.forEach((v, i) => {
      report += `| ${i + 1} | ${v.type} | ${v.count} | ${v.description} |\n`;
    });

    report += `\n---\n`;
    report += `*Reporte generado el ${new Date().toLocaleString()}*\n`;

    return report;
  }

  private generateHtmlReport(metrics: AdoptionMetrics): string {
    return `<!DOCTYPE html>
<html>
<head>
  <title>Métricas de Adopción</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
    th { background-color: #007ACC; color: white; }
  </style>
</head>
<body>
  <h1>Métricas de Adopción</h1>
  <p><strong>Pipelines Analizados:</strong> ${metrics.pipelines.analyzed}</p>
  <p><strong>Compliance Promedio:</strong> ${metrics.compliance.average.toFixed(1)}%</p>
</body>
</html>`;
  }

  getMetrics(limit: number = 12): AdoptionMetrics[] {
    return this.metrics.slice(-limit);
  }

  getCurrentMonthMetrics(): AdoptionMetrics | undefined {
    const now = new Date();
    return this.metrics.find(
      (m) =>
        m.period.start.getMonth() === now.getMonth() &&
        m.period.start.getFullYear() === now.getFullYear()
    );
  }
}
