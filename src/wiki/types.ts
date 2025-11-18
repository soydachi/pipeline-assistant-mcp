/**
 * Type definitions for Wiki management
 */

export interface WikiStandard {
  id: string;
  type: 'mandatory' | 'recommended' | 'forbidden';
  description: string;
  example?: string;
  documentation?: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  tags?: string[];
  category?: string;
  version?: string;
  lastModified?: Date;
  author?: string;
}

export interface WikiRule {
  id: string;
  name: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  type: string;
  pattern?: RegExp;
  check: (content: string) => boolean;
  fix?: string;
  example?: string;
  documentation?: string;
  tags?: string[];
  category?: string;
}

export interface PolicyVersion {
  version: string;
  date: Date;
  author: string;
  changes: string[];
  justification: string;
  standards: WikiStandard[];
  checksum: string;
}

export interface TechnologyTemplate {
  id: string;
  name: string;
  description: string;
  technology: string;
  features: string[];
  template: string;
  metadata?: {
    dockerized?: boolean;
    multiStage?: boolean;
    helmChart?: boolean;
    healthChecks?: boolean;
    monitoring?: boolean;
  };
}

export interface AdoptionMetrics {
  period: {
    start: Date;
    end: Date;
  };
  pipelines: {
    analyzed: number;
    generated: number;
    fixed: number;
  };
  compliance: {
    average: number;
    trend: number;
    distribution: {
      excellent: number;
      good: number;
      fair: number;
      poor: number;
    };
  };
  violations: {
    total: number;
    byType: Map<string, number>;
    bySeverity: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    topViolations: Array<{
      type: string;
      count: number;
      description: string;
    }>;
  };
  improvements: {
    monthOverMonth: number;
    resolvedIssues: number;
    newAdoptions: number;
  };
}
