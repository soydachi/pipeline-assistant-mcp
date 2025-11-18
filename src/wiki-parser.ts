import { promises as fs } from 'fs';
import { parse } from 'yaml';
import path from 'path';
import { WIKI_PATHS } from './utils/constants.js';

export interface Standard {
  mandatory: Rule[];
  recommended: Rule[];
  forbidden: Rule[];
  templates: Map<string, string>;
  policies: any;
  stages?: any;
  quality?: any;
  sla?: any;
}

export interface Rule {
  id: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  example?: string;
}

export class WikiParser {
  private wikiPath: string;
  private standardsCache: Map<string, Standard> = new Map();
  private policiesCache: any = null;
  private stagesCache: any = null;
  private qualityCache: any = null;
  private slaCache: any = null;

  constructor(wikiPath: string) {
    this.wikiPath = wikiPath;
  }

  async loadStandards(): Promise<void> {
    // Load v2.0 structure files

    // Load security policies
    const policiesContent = await fs.readFile(
      path.join(this.wikiPath, WIKI_PATHS.POLICIES_FILE),
      'utf-8'
    );
    this.policiesCache = parse(policiesContent);

    // Load stages configuration
    const stagesContent = await fs.readFile(
      path.join(this.wikiPath, WIKI_PATHS.STAGES_FILE),
      'utf-8'
    );
    this.stagesCache = parse(stagesContent);

    // Load quality gates
    const gatesContent = await fs.readFile(
      path.join(this.wikiPath, WIKI_PATHS.GATES_FILE),
      'utf-8'
    );
    this.qualityCache = parse(gatesContent);

    // Load SLA definitions
    const slaContent = await fs.readFile(
      path.join(this.wikiPath, WIKI_PATHS.SLA_FILE),
      'utf-8'
    );
    this.slaCache = parse(slaContent);

    // Build standards from v2.0 structure
    const standards = this.buildStandardsFromV2();

    // Cache for each project type
    ['dotnet', 'node', 'python', 'java', 'go'].forEach((type) => {
      this.standardsCache.set(type, {
        ...standards,
        policies: this.policiesCache,
        stages: this.stagesCache,
        quality: this.qualityCache,
        sla: this.slaCache,
      });
    });
  }

  private buildStandardsFromV2(): Omit<Standard, 'policies' | 'stages' | 'quality' | 'sla'> {
    const mandatory: Rule[] = [];
    const recommended: Rule[] = [];
    const forbidden: Rule[] = [];
    const templates = new Map<string, string>();

    // Build mandatory rules from security policies
    if (this.policiesCache?.policies && Array.isArray(this.policiesCache.policies)) {
      this.policiesCache.policies.forEach((policy: any) => {
        if (policy.level === 'mandatory') {
          mandatory.push({
            id: policy.id,
            description: `${policy.name}: ${policy.description}`,
            severity: policy.severity || 'CRITICAL',
            example: policy.tools?.primary || '',
          });
        } else {
          recommended.push({
            id: policy.id,
            description: `${policy.name}: ${policy.description}`,
            severity: policy.severity || 'MEDIUM',
            example: policy.tools?.primary || '',
          });
        }
      });
    }

    // Build mandatory rules from stages
    if (this.stagesCache?.stages?.mandatory) {
      this.stagesCache.stages.mandatory.forEach((stage: any) => {
        mandatory.push({
          id: `STAGE-${stage.order}`,
          description: `Stage ${stage.order}: ${stage.name} - ${stage.description}`,
          severity: 'CRITICAL',
          example: stage.tasks?.join(', ') || '',
        });
      });
    }

    // Add forbidden patterns
    forbidden.push({
      id: 'FORBIDDEN-001',
      description: 'Hardcoded secrets or credentials in pipeline files',
      severity: 'CRITICAL',
      example: 'password: mypassword123',
    });

    forbidden.push({
      id: 'FORBIDDEN-002',
      description: 'Skipping security scans without documented exception',
      severity: 'HIGH',
      example: 'continue-on-error: true for security jobs',
    });

    forbidden.push({
      id: 'FORBIDDEN-003',
      description: 'Deploying to production without security stage',
      severity: 'CRITICAL',
      example: 'Direct deploy without SEC-* policies',
    });

    return { mandatory, recommended, forbidden, templates };
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
    // Return policies in expected format with mandatory array
    if (!this.policiesCache?.policies || !Array.isArray(this.policiesCache.policies)) {
      return { mandatory: [] };
    }

    const mandatory = this.policiesCache.policies
      .filter((policy: any) => policy.level === 'mandatory')
      .map((policy: any) => ({
        id: policy.id,
        name: policy.name,
        description: policy.description,
        severity: policy.severity || 'CRITICAL',
        condition: policy.condition ? this.mapCondition(policy.condition) : undefined,
        tools: policy.tools ? [{
          name: policy.tools.primary,
          task: this.getTaskForTool(policy.tools.primary, policy.id),
          failOnDetection: true,
          failOnIssues: true,
        }] : [],
      }));

    return { mandatory };
  }

  private mapCondition(condition: string): string | undefined {
    // Map YAML condition names to policy-enforcer expected values
    const conditionMap: Record<string, string> = {
      'usesDocker': 'uses_docker',
      'isApiProject': 'is_api_project',
      'productionOnly': 'production_only',
      'hasWebInterface': 'has_web_interface',
    };
    return conditionMap[condition] || condition;
  }

  private getTaskForTool(toolName: string, policyId: string): string {
    // Map tool names to Azure DevOps task names
    const taskMap: Record<string, string> = {
      'TruffleHog': 'TruffleHog@1',
      'SonarQube': 'SonarQubePrepare@6',
      'Snyk': 'SnykSecurityScan@1',
      'Trivy': 'Trivy@1',
      'OWASP ZAP': 'owaspzap@1',
      'oss-review-toolkit': 'LicenseChecker@1',
      'Syft': 'Syft@1',
      'Grype': 'Grype@1',
    };

    return taskMap[toolName] || `${toolName}@1`;
  }

  getCompliancePolicies(): any {
    // Load from compliance-mapping.yaml
    return this.policiesCache?.compliance || {};
  }

  getQualityPolicies(): any {
    return this.qualityCache || {};
  }

  getStages(): any {
    return this.stagesCache?.stages?.mandatory || [];
  }

  getSLAs(): any {
    return this.slaCache || {};
  }

  // Get specific security policy by ID
  getSecurityPolicy(policyId: string): any {
    return this.policiesCache?.policies?.[policyId] || null;
  }

  // Check if a policy is required
  isPolicyRequired(policyId: string): boolean {
    const policy = this.getSecurityPolicy(policyId);
    return policy?.required === true;
  }

  // Get remediation SLA for a severity
  getRemediationSLA(severity: string): any {
    return this.slaCache?.remediation_sla?.[severity.toLowerCase()] || null;
  }

  // Get quality gate for an environment
  getQualityGate(environment: string): any {
    return this.qualityCache?.gates?.[environment] || null;
  }
}
