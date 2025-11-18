/**
 * Policy Version Manager
 *
 * Handles versioning and history of policy changes
 */

import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '../utils/logger.js';
import type { PolicyVersion, WikiStandard } from './types.js';

const logger = createLogger('PolicyVersionManager');

export class PolicyVersionManager {
  private policyHistory: PolicyVersion[] = [];
  private wikiPath: string;

  constructor(wikiPath: string) {
    this.wikiPath = wikiPath;
  }

  async saveVersion(
    standards: Map<string, WikiStandard>,
    checksum: string,
    justification: string
  ): Promise<PolicyVersion> {
    const version: PolicyVersion = {
      version: this.generateVersion(),
      date: new Date(),
      author: process.env.USER || process.env.USERNAME || 'system',
      changes: this.detectChanges(standards),
      justification,
      standards: Array.from(standards.values()),
      checksum,
    };

    this.policyHistory.push(version);

    // Keep only last 50 versions in memory
    if (this.policyHistory.length > 50) {
      this.policyHistory = this.policyHistory.slice(-50);
    }

    await this.saveHistory();
    logger.info('Policy version saved', { version: version.version });
    return version;
  }

  private generateVersion(): string {
    const date = new Date();
    const major = date.getFullYear();
    const minor = date.getMonth() + 1;
    const patch = date.getDate();
    const build = `${date.getHours()}${date.getMinutes()}${date.getSeconds()}`;

    return `${major}.${minor}.${patch}.${build}`;
  }

  private detectChanges(standards: Map<string, WikiStandard>): string[] {
    const changes: string[] = [];

    if (this.policyHistory.length === 0) {
      changes.push('Initial version');
      return changes;
    }

    const previousVersion = this.policyHistory[this.policyHistory.length - 1];
    const previousStandards = new Map(previousVersion.standards.map((s) => [s.id, s]));

    // Detect additions
    standards.forEach((standard, id) => {
      if (!previousStandards.has(id)) {
        changes.push(`Added: ${standard.id} - ${standard.description}`);
      }
    });

    // Detect removals
    previousStandards.forEach((standard, id) => {
      if (!standards.has(id)) {
        changes.push(`Removed: ${standard.id} - ${standard.description}`);
      }
    });

    // Detect modifications
    standards.forEach((standard, id) => {
      const previous = previousStandards.get(id);
      if (previous && JSON.stringify(previous) !== JSON.stringify(standard)) {
        changes.push(`Modified: ${standard.id} - ${this.getChangeSummary(previous, standard)}`);
      }
    });

    return changes;
  }

  private getChangeSummary(prev: WikiStandard, curr: WikiStandard): string {
    const changes: string[] = [];

    if (prev.severity !== curr.severity) {
      changes.push(`severity: ${prev.severity} -> ${curr.severity}`);
    }
    if (prev.type !== curr.type) {
      changes.push(`type: ${prev.type} -> ${curr.type}`);
    }
    if (prev.description !== curr.description) {
      changes.push('description updated');
    }
    if (prev.example !== curr.example) {
      changes.push('example updated');
    }

    return changes.join(', ') || 'content updated';
  }

  private async saveHistory(): Promise<void> {
    const historyFile = path.join(this.wikiPath, '.policy-history.json');

    try {
      await fs.promises.writeFile(historyFile, JSON.stringify(this.policyHistory, null, 2), 'utf-8');
    } catch (error) {
      logger.error('Error saving policy history', {
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  async loadHistory(): Promise<void> {
    const historyFile = path.join(this.wikiPath, '.policy-history.json');

    if (fs.existsSync(historyFile)) {
      try {
        const content = await fs.promises.readFile(historyFile, 'utf-8');
        this.policyHistory = JSON.parse(content);
        logger.info('Policy history loaded', { count: this.policyHistory.length });
      } catch (error) {
        logger.error('Error loading policy history', {
          error: error instanceof Error ? error.message : error,
        });
      }
    }
  }

  getHistory(limit: number = 10): PolicyVersion[] {
    return this.policyHistory.slice(-limit);
  }

  getVersion(version: string): PolicyVersion | undefined {
    return this.policyHistory.find((v) => v.version === version);
  }

  hasHistory(): boolean {
    return this.policyHistory.length > 0;
  }

  getLatestVersion(): PolicyVersion | undefined {
    return this.policyHistory[this.policyHistory.length - 1];
  }
}
