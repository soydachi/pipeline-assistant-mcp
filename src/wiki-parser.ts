import { promises as fs } from 'fs';
import { parse } from 'yaml';
import path from 'path';

export interface Standard {
  mandatory: Rule[];
  recommended: Rule[];
  forbidden: Rule[];
  templates: Map<string, string>;
  policies: any;
}

export interface Rule {
  id: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  example?: string;
}

interface PartialRule {
  description?: string;
  severity?: Rule['severity'];
  example?: string;
}

export class WikiParser {
  private wikiPath: string;
  private standardsCache: Map<string, Standard> = new Map();
  private policiesCache: any = null;

  constructor(wikiPath: string) {
    this.wikiPath = wikiPath;
  }

  async loadStandards(): Promise<void> {
    // Cargar markdown de estándares
    const standardsContent = await fs.readFile(
      path.join(this.wikiPath, 'pipeline-standards.md'),
      'utf-8'
    );
    
    // Cargar políticas YAML
    const policiesContent = await fs.readFile(
      path.join(this.wikiPath, 'security-policies.yaml'),
      'utf-8'
    );
    
    // Parsear contenido
    const standards = this.parseMarkdownStandards(standardsContent);
    this.policiesCache = parse(policiesContent);
    
    // Cachear para cada tipo de proyecto
    ['dotnet', 'node', 'python'].forEach((type) => {
      this.standardsCache.set(type, {
        ...standards,
        policies: this.policiesCache,
      });
    });
  }

  private parseMarkdownStandards(content: string): Omit<Standard, 'policies'> {
    const sections = content.split(/^##\s+/m);
    
    const mandatory: Rule[] = [];
    const recommended: Rule[] = [];
    const forbidden: Rule[] = [];
    const templates = new Map<string, string>();
    
    sections.forEach((section) => {
      if (section.includes('Obligatorio')) {
        mandatory.push(...this.extractRules(section, 'CRITICAL'));
      } else if (section.includes('Recomendado')) {
        recommended.push(...this.extractRules(section, 'MEDIUM'));
      } else if (section.includes('Prohibido')) {
        forbidden.push(...this.extractRules(section, 'HIGH'));
      } else if (section.includes('Templates por Tecnología')) {
        this.extractTemplates(section, templates);
      }
    });
    
    return { mandatory, recommended, forbidden, templates };
  }

  private extractRules(section: string, defaultSeverity: Rule['severity']): Rule[] {
    const rules: Rule[] = [];
    const lines = section.split('\n');

    let currentRule: PartialRule | null = null;

    lines.forEach((line) => {
      if (line.match(/^###\s+\d+\.\s+/)) {
        if (currentRule?.description) {
          rules.push({
            id: `RULE-${rules.length + 1}`,
            description: currentRule.description,
            severity: currentRule.severity || defaultSeverity,
            example: currentRule.example || '',
          });
        }
        currentRule = {
          description: line.replace(/^###\s+\d+\.\s+/, '').trim(),
          severity: defaultSeverity,
        };
      } else if (line.startsWith('- ') && currentRule) {
        // Agregar detalles a la regla actual
        if (!currentRule.example) {
          currentRule.example = '';
        }
        currentRule.example += line + '\n';
      }
    });

    // Agregar última regla
    if (currentRule) {
      const rule = currentRule as PartialRule;
      if (rule.description) {
        rules.push({
          id: `RULE-${rules.length + 1}`,
          description: rule.description,
          severity: rule.severity || defaultSeverity,
          example: rule.example || '',
        });
      }
    }

    return rules;
  }

  private extractTemplates(section: string, templates: Map<string, string>) {
    const codeBlocks = section.match(/```yaml[\s\S]*?```/g);
    const headers = section.match(/###\s+[^\n]+/g);
    
    if (codeBlocks && headers) {
      headers.forEach((header, index) => {
        if (codeBlocks[index]) {
          const name = header.replace(/###\s+/, '').toLowerCase().replace(/\s+/g, '-');
          const code = codeBlocks[index].replace(/```yaml\n?/, '').replace(/```/, '');
          templates.set(name, code);
        }
      });
    }
  }

  async getStandardsForProject(projectType: string): Promise<Standard> {
    if (!this.standardsCache.has(projectType)) {
      await this.loadStandards();
    }
    
    const standards = this.standardsCache.get(projectType);
    if (!standards) {
      throw new Error(`No standards found for project type: ${projectType}`);
    }
    
    return standards;
  }

  getSecurityPolicies(): any {
    return this.policiesCache?.policies?.security || {};
  }

  getCompliancePolicies(): any {
    return this.policiesCache?.policies?.compliance || {};
  }

  getQualityPolicies(): any {
    return this.policiesCache?.policies?.quality || {};
  }
}
