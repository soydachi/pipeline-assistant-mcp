/**
 * Input Validation Schemas
 *
 * Zod schemas for validating all inputs to the system.
 * Replaces unsafe 'any' types with strict validation.
 */

import { z } from 'zod';

// =============================================================================
// BASE TYPES
// =============================================================================

// Note: Generator currently only supports these three
export const ProjectTypeSchema = z.enum(['dotnet', 'node', 'python']);
export type ProjectType = z.infer<typeof ProjectTypeSchema>;

// Extended project types for future use
export const ExtendedProjectTypeSchema = z.enum(['dotnet', 'node', 'python', 'java', 'go']);
export type ExtendedProjectType = z.infer<typeof ExtendedProjectTypeSchema>;

export const EnvironmentSchema = z.enum(['dev', 'development', 'staging', 'prod', 'production']);
export type Environment = z.infer<typeof EnvironmentSchema>;

export const AzureServiceSchema = z.enum([
  'azuresql',
  'cosmosdb',
  'redis',
  'servicebus',
  'storage',
  'keyvault',
  'aks',
  'functions',
  'appservice',
]);
export type AzureService = z.infer<typeof AzureServiceSchema>;

export const SeveritySchema = z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);
export type Severity = z.infer<typeof SeveritySchema>;

export const EnforcementModeSchema = z.enum(['learning', 'enforcement']);
export type EnforcementMode = z.infer<typeof EnforcementModeSchema>;

// =============================================================================
// PIPELINE GENERATION
// =============================================================================

export const GeneratePipelineArgsSchema = z.object({
  projectType: ProjectTypeSchema,
  services: z.array(z.string()).default([]),
  environment: z.string().default('dev'),
  includeDocker: z.boolean().default(false),
  usesDocker: z.boolean().default(false),
  enforceAllPolicies: z.boolean().default(true),
});
export type GeneratePipelineArgs = z.infer<typeof GeneratePipelineArgsSchema>;

export const AnalyzePipelineArgsSchema = z.object({
  pipelineYaml: z.string().min(1, 'Pipeline YAML cannot be empty'),
  projectType: ProjectTypeSchema.optional(),
  strictMode: z.boolean().default(false),
});
export type AnalyzePipelineArgs = z.infer<typeof AnalyzePipelineArgsSchema>;

// =============================================================================
// VIOLATIONS & ANALYSIS
// =============================================================================

export const ViolationTypeSchema = z.enum([
  'HARDCODED_SECRET',
  'UNSAFE_TRIGGER',
  'MISSING_SECURITY_STAGE',
  'SECURITY_BYPASS',
  'SECRET_EXPOSURE',
  'NO_STAGES',
  'MISSING_APPROVAL',
  'MISSING_CACHE',
  'INSECURE_SCRIPT',
  'MISSING_TIMEOUT',
  'DEPRECATED_TASK',
  'CONFIGURATION_ERROR',
]);
export type ViolationType = z.infer<typeof ViolationTypeSchema>;

export const ViolationSchema = z.object({
  type: z.string(),
  severity: SeveritySchema,
  message: z.string(),
  line: z.number().optional(),
  column: z.number().optional(),
  rule: z.string().optional(),
  code: z.string().optional(),
  file: z.string().optional(),
});
export type Violation = z.infer<typeof ViolationSchema>;

export const WarningSchema = z.object({
  type: z.string(),
  severity: SeveritySchema,
  message: z.string(),
  line: z.number().optional(),
  suggestion: z.string().optional(),
});
export type Warning = z.infer<typeof WarningSchema>;

export const SuggestionSchema = z.object({
  type: z.string(),
  message: z.string(),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
  code: z.string().optional(),
});
export type Suggestion = z.infer<typeof SuggestionSchema>;

export const AnalysisResultSchema = z.object({
  score: z.number().min(0).max(100),
  violations: z.array(ViolationSchema),
  warnings: z.array(WarningSchema),
  suggestions: z.array(SuggestionSchema),
  summary: z.object({
    totalIssues: z.number(),
    criticalCount: z.number(),
    highCount: z.number(),
    mediumCount: z.number(),
    lowCount: z.number(),
  }),
});
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

// =============================================================================
// POLICIES
// =============================================================================

export const PolicyToolSchema = z.object({
  name: z.string(),
  task: z.string(),
  displayName: z.string().optional(),
  inputs: z.record(z.string(), z.unknown()).optional(),
});
export type PolicyTool = z.infer<typeof PolicyToolSchema>;

export const PolicySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  severity: SeveritySchema,
  mandatory: z.boolean().default(false),
  tools: z.array(PolicyToolSchema),
  applicableTo: z.array(ProjectTypeSchema).optional(),
  environments: z.array(z.string()).optional(),
});
export type Policy = z.infer<typeof PolicySchema>;

export const PolicyEnforcementResultSchema = z.object({
  applied: z.array(PolicySchema),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
});
export type PolicyEnforcementResult = z.infer<typeof PolicyEnforcementResultSchema>;

// =============================================================================
// WIKI STANDARDS
// =============================================================================

export const StandardSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  content: z.string(),
  version: z.string().optional(),
  lastModified: z.string().optional(),
});
export type Standard = z.infer<typeof StandardSchema>;

export const RuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  severity: SeveritySchema,
  category: z.string().optional(),
  pattern: z.string().optional(),
  message: z.string().optional(),
});
export type Rule = z.infer<typeof RuleSchema>;

// =============================================================================
// AZURE DEVOPS
// =============================================================================

export const AzureDevOpsConfigSchema = z.object({
  organizationUrl: z.string().url(),
  project: z.string().min(1),
  personalAccessToken: z.string().min(1),
  enforcementMode: EnforcementModeSchema.default('learning'),
  webhookSecret: z.string().optional(),
});
export type AzureDevOpsConfig = z.infer<typeof AzureDevOpsConfigSchema>;

export const PullRequestSchema = z.object({
  pullRequestId: z.number(),
  title: z.string(),
  description: z.string().optional(),
  sourceRefName: z.string(),
  targetRefName: z.string(),
  status: z.string(),
  createdBy: z.object({
    displayName: z.string(),
    id: z.string(),
  }).optional(),
  repository: z.object({
    id: z.string(),
    name: z.string(),
  }),
});
export type PullRequest = z.infer<typeof PullRequestSchema>;

export const WebhookPayloadSchema = z.object({
  eventType: z.string(),
  resource: z.record(z.string(), z.unknown()),
  resourceVersion: z.string().optional(),
  subscriptionId: z.string().optional(),
});
export type WebhookPayload = z.infer<typeof WebhookPayloadSchema>;

// =============================================================================
// MCP SERVER
// =============================================================================

export const MCPToolCallSchema = z.object({
  name: z.string(),
  arguments: z.record(z.string(), z.unknown()),
});
export type MCPToolCall = z.infer<typeof MCPToolCallSchema>;

// =============================================================================
// CLI
// =============================================================================

export const CLIOptionsSchema = z.object({
  projectType: ProjectTypeSchema.optional(),
  services: z.array(z.string()).default([]),
  environment: z.string().default('dev'),
  output: z.string().optional(),
  strict: z.boolean().default(false),
  docker: z.boolean().default(false),
  format: z.enum(['yaml', 'json']).default('yaml'),
});
export type CLIOptions = z.infer<typeof CLIOptionsSchema>;

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * Validate input and return typed result or throw
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new ValidationError(`Validation failed: ${errors}`, result.error);
  }
  return result.data;
}

/**
 * Validate input and return result with success flag
 */
export function validateSafe<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Custom validation error with zod details
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly zodError: z.ZodError
  ) {
    super(message);
    this.name = 'ValidationError';
  }

  get details(): string[] {
    return this.zodError.issues.map((e) => `${e.path.join('.')}: ${e.message}`);
  }
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

export function isProjectType(value: unknown): value is ProjectType {
  return ProjectTypeSchema.safeParse(value).success;
}

export function isEnvironment(value: unknown): value is Environment {
  return EnvironmentSchema.safeParse(value).success;
}

export function isSeverity(value: unknown): value is Severity {
  return SeveritySchema.safeParse(value).success;
}

export function isViolation(value: unknown): value is Violation {
  return ViolationSchema.safeParse(value).success;
}
