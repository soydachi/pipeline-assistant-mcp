/**
 * Markdown Parser for Wiki Standards
 *
 * Parses markdown content from wiki to extract rules and standards
 */

import { createLogger } from '../utils/logger.js';
import type { WikiRule } from './types.js';

const logger = createLogger('MarkdownParser');

export class MarkdownParser {
  /**
   * Parse markdown content to extract rules
   */
  async parseMarkdownToRules(content: string): Promise<WikiRule[]> {
    const rules: WikiRule[] = [];
    const sections = this.extractSections(content);

    if (sections['obligatorio']) {
      rules.push(...this.parseSection(sections['obligatorio'], 'mandatory'));
    }

    if (sections['recomendado']) {
      rules.push(...this.parseSection(sections['recomendado'], 'recommended'));
    }

    if (sections['prohibido']) {
      rules.push(...this.parseSection(sections['prohibido'], 'forbidden'));
    }

    logger.debug('Parsed markdown rules', { count: rules.length });
    return rules;
  }

  private extractSections(content: string): Record<string, string> {
    const sections: Record<string, string> = {};
    const sectionRegex = /^##\s+(.+)$/gm;
    const matches = Array.from(content.matchAll(sectionRegex));

    for (let i = 0; i < matches.length; i++) {
      const sectionName = matches[i][1].toLowerCase();
      const startIndex = matches[i].index! + matches[i][0].length;
      const endIndex = matches[i + 1]?.index || content.length;
      sections[sectionName] = content.substring(startIndex, endIndex).trim();
    }

    return sections;
  }

  private parseSection(content: string, type: string): WikiRule[] {
    const rules: WikiRule[] = [];
    const ruleBlocks = content.split(/^###\s+/m).filter(Boolean);

    for (const block of ruleBlocks) {
      const lines = block.split('\n');
      const ruleName = lines[0]?.trim();

      if (!ruleName) continue;

      const rule: WikiRule = {
        id: this.generateId(ruleName),
        name: ruleName,
        description: '',
        severity: this.determineSeverity(type, block),
        type: type,
        check: () => true,
        tags: this.extractTags(block),
        category: this.extractCategory(block),
      };

      // Extract description
      const descMatch = block.match(/Descripción:\s*(.+)/i);
      if (descMatch) {
        rule.description = descMatch[1].trim();
      }

      // Extract code example
      const codeMatch = block.match(/```(?:yaml|yml)\n([\s\S]*?)```/);
      if (codeMatch) {
        rule.example = codeMatch[1].trim();
      }

      // Extract suggested fix
      const fixMatch = block.match(/Fix:\s*(.+)/i);
      if (fixMatch) {
        rule.fix = fixMatch[1].trim();
      }

      // Create check function based on patterns
      rule.check = this.createCheckFunction(rule);

      rules.push(rule);
    }

    return rules;
  }

  private generateId(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private determineSeverity(
    type: string,
    content: string
  ): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
    // Look for explicit severity
    const severityMatch = content.match(/Severidad:\s*(CRITICAL|HIGH|MEDIUM|LOW)/i);
    if (severityMatch) {
      return severityMatch[1].toUpperCase() as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    }

    // Determine by type
    if (type === 'mandatory') {
      return content.includes('seguridad') || content.includes('secreto')
        ? 'CRITICAL'
        : 'HIGH';
    } else if (type === 'forbidden') {
      return 'HIGH';
    } else {
      return 'MEDIUM';
    }
  }

  private extractTags(content: string): string[] {
    const tagMatch = content.match(/Tags?:\s*(.+)/i);
    if (tagMatch) {
      return tagMatch[1].split(',').map((t) => t.trim());
    }
    return [];
  }

  private extractCategory(content: string): string {
    const categoryMatch = content.match(/Categor[íi]a:\s*(.+)/i);
    if (categoryMatch) {
      return categoryMatch[1].trim();
    }

    // Infer category from content
    if (content.includes('seguridad') || content.includes('security')) return 'Security';
    if (content.includes('rendimiento') || content.includes('performance'))
      return 'Performance';
    if (content.includes('calidad') || content.includes('quality')) return 'Quality';

    return 'General';
  }

  private createCheckFunction(rule: WikiRule): (content: string) => boolean {
    return (content: string) => {
      if (rule.type === 'mandatory') {
        if (rule.example) {
          const requiredElements = this.extractRequiredElements(rule.example);
          return requiredElements.every((elem) => content.includes(elem));
        }
      } else if (rule.type === 'forbidden') {
        if (rule.example) {
          const forbiddenElements = this.extractForbiddenElements(rule.example);
          return !forbiddenElements.some((elem) => content.includes(elem));
        }
      }

      return true;
    };
  }

  private extractRequiredElements(example: string): string[] {
    const elements: string[] = [];

    // Find tasks
    const taskMatches = example.matchAll(/task:\s*(\S+)/g);
    for (const match of taskMatches) {
      elements.push(match[1]);
    }

    // Find stages
    const stageMatches = example.matchAll(/stage:\s*(\S+)/g);
    for (const match of stageMatches) {
      elements.push(match[1]);
    }

    return elements;
  }

  private extractForbiddenElements(_example: string): string[] {
    return [
      'trigger: true',
      'continueOnError: true',
      'password:',
      'apikey:',
      'token:',
    ];
  }
}
