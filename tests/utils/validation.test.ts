import { describe, it, expect } from 'vitest';
import {
  ProjectTypeSchema,
  EnvironmentSchema,
  SeveritySchema,
  ViolationSchema,
  GeneratePipelineArgsSchema,
  AnalyzePipelineArgsSchema,
  AzureDevOpsConfigSchema,
  validate,
  validateSafe,
  ValidationError,
  isProjectType,
  isEnvironment,
  isSeverity,
  isViolation,
} from '../../src/utils/validation';

describe('Validation Schemas', () => {
  describe('ProjectTypeSchema', () => {
    it('should accept valid project types', () => {
      expect(ProjectTypeSchema.parse('dotnet')).toBe('dotnet');
      expect(ProjectTypeSchema.parse('node')).toBe('node');
      expect(ProjectTypeSchema.parse('python')).toBe('python');
    });

    it('should reject invalid project types', () => {
      expect(() => ProjectTypeSchema.parse('java')).toThrow();
      expect(() => ProjectTypeSchema.parse('go')).toThrow();
      expect(() => ProjectTypeSchema.parse('')).toThrow();
    });
  });

  describe('EnvironmentSchema', () => {
    it('should accept valid environments', () => {
      expect(EnvironmentSchema.parse('dev')).toBe('dev');
      expect(EnvironmentSchema.parse('development')).toBe('development');
      expect(EnvironmentSchema.parse('staging')).toBe('staging');
      expect(EnvironmentSchema.parse('prod')).toBe('prod');
      expect(EnvironmentSchema.parse('production')).toBe('production');
    });

    it('should reject invalid environments', () => {
      expect(() => EnvironmentSchema.parse('test')).toThrow();
      expect(() => EnvironmentSchema.parse('qa')).toThrow();
    });
  });

  describe('SeveritySchema', () => {
    it('should accept valid severities', () => {
      expect(SeveritySchema.parse('CRITICAL')).toBe('CRITICAL');
      expect(SeveritySchema.parse('HIGH')).toBe('HIGH');
      expect(SeveritySchema.parse('MEDIUM')).toBe('MEDIUM');
      expect(SeveritySchema.parse('LOW')).toBe('LOW');
    });

    it('should reject invalid severities', () => {
      expect(() => SeveritySchema.parse('critical')).toThrow();
      expect(() => SeveritySchema.parse('NONE')).toThrow();
    });
  });

  describe('ViolationSchema', () => {
    it('should accept valid violation', () => {
      const violation = {
        type: 'HARDCODED_SECRET',
        severity: 'CRITICAL',
        message: 'Found hardcoded secret',
      };
      const result = ViolationSchema.parse(violation);
      expect(result.type).toBe('HARDCODED_SECRET');
      expect(result.severity).toBe('CRITICAL');
      expect(result.message).toBe('Found hardcoded secret');
    });

    it('should accept violation with optional fields', () => {
      const violation = {
        type: 'MISSING_STAGE',
        severity: 'HIGH',
        message: 'Missing security stage',
        line: 10,
        column: 5,
        rule: 'security-stage-required',
        code: '- stage: Security',
        file: 'azure-pipelines.yml',
      };
      const result = ViolationSchema.parse(violation);
      expect(result.line).toBe(10);
      expect(result.column).toBe(5);
      expect(result.rule).toBe('security-stage-required');
    });

    it('should reject invalid violation', () => {
      expect(() => ViolationSchema.parse({
        type: 'TEST',
        severity: 'INVALID',
        message: 'test',
      })).toThrow();
    });
  });

  describe('GeneratePipelineArgsSchema', () => {
    it('should accept minimal valid args', () => {
      const args = { projectType: 'node' };
      const result = GeneratePipelineArgsSchema.parse(args);
      expect(result.projectType).toBe('node');
      expect(result.services).toEqual([]);
      expect(result.environment).toBe('dev');
      expect(result.includeDocker).toBe(false);
      expect(result.usesDocker).toBe(false);
      expect(result.enforceAllPolicies).toBe(true);
    });

    it('should accept full args', () => {
      const args = {
        projectType: 'dotnet',
        services: ['azuresql', 'redis'],
        environment: 'prod',
        includeDocker: true,
        usesDocker: true,
        enforceAllPolicies: false,
      };
      const result = GeneratePipelineArgsSchema.parse(args);
      expect(result.projectType).toBe('dotnet');
      expect(result.services).toEqual(['azuresql', 'redis']);
      expect(result.environment).toBe('prod');
      expect(result.includeDocker).toBe(true);
      expect(result.usesDocker).toBe(true);
      expect(result.enforceAllPolicies).toBe(false);
    });

    it('should reject missing projectType', () => {
      expect(() => GeneratePipelineArgsSchema.parse({})).toThrow();
    });
  });

  describe('AnalyzePipelineArgsSchema', () => {
    it('should accept valid args', () => {
      const args = { pipelineYaml: 'trigger: main' };
      const result = AnalyzePipelineArgsSchema.parse(args);
      expect(result.pipelineYaml).toBe('trigger: main');
      expect(result.strictMode).toBe(false);
    });

    it('should reject empty pipeline', () => {
      expect(() => AnalyzePipelineArgsSchema.parse({ pipelineYaml: '' })).toThrow();
    });

    it('should accept with optional fields', () => {
      const args = {
        pipelineYaml: 'trigger: main',
        projectType: 'node',
        strictMode: true,
      };
      const result = AnalyzePipelineArgsSchema.parse(args);
      expect(result.projectType).toBe('node');
      expect(result.strictMode).toBe(true);
    });
  });

  describe('AzureDevOpsConfigSchema', () => {
    it('should accept valid config', () => {
      const config = {
        organizationUrl: 'https://dev.azure.com/myorg',
        project: 'MyProject',
        personalAccessToken: 'my-pat-token',
      };
      const result = AzureDevOpsConfigSchema.parse(config);
      expect(result.organizationUrl).toBe('https://dev.azure.com/myorg');
      expect(result.project).toBe('MyProject');
      expect(result.enforcementMode).toBe('learning');
    });

    it('should reject invalid URL', () => {
      expect(() => AzureDevOpsConfigSchema.parse({
        organizationUrl: 'not-a-url',
        project: 'Test',
        personalAccessToken: 'token',
      })).toThrow();
    });

    it('should reject empty project', () => {
      expect(() => AzureDevOpsConfigSchema.parse({
        organizationUrl: 'https://dev.azure.com/org',
        project: '',
        personalAccessToken: 'token',
      })).toThrow();
    });
  });
});

describe('Validation Helpers', () => {
  describe('validate', () => {
    it('should return validated data on success', () => {
      const result = validate(ProjectTypeSchema, 'node');
      expect(result).toBe('node');
    });

    it('should throw ValidationError on failure', () => {
      expect(() => validate(ProjectTypeSchema, 'invalid')).toThrow(ValidationError);
    });

    it('should include error details', () => {
      try {
        validate(ProjectTypeSchema, 'invalid');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        const validationError = error as ValidationError;
        expect(validationError.details).toBeDefined();
        expect(validationError.details.length).toBeGreaterThan(0);
      }
    });
  });

  describe('validateSafe', () => {
    it('should return success result on valid input', () => {
      const result = validateSafe(SeveritySchema, 'HIGH');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('HIGH');
      }
    });

    it('should return failure result on invalid input', () => {
      const result = validateSafe(SeveritySchema, 'invalid');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });
  });
});

describe('Type Guards', () => {
  describe('isProjectType', () => {
    it('should return true for valid project types', () => {
      expect(isProjectType('dotnet')).toBe(true);
      expect(isProjectType('node')).toBe(true);
      expect(isProjectType('python')).toBe(true);
    });

    it('should return false for invalid project types', () => {
      expect(isProjectType('java')).toBe(false);
      expect(isProjectType('')).toBe(false);
      expect(isProjectType(123)).toBe(false);
      expect(isProjectType(null)).toBe(false);
    });
  });

  describe('isEnvironment', () => {
    it('should return true for valid environments', () => {
      expect(isEnvironment('dev')).toBe(true);
      expect(isEnvironment('staging')).toBe(true);
      expect(isEnvironment('prod')).toBe(true);
    });

    it('should return false for invalid environments', () => {
      expect(isEnvironment('test')).toBe(false);
      expect(isEnvironment('')).toBe(false);
    });
  });

  describe('isSeverity', () => {
    it('should return true for valid severities', () => {
      expect(isSeverity('CRITICAL')).toBe(true);
      expect(isSeverity('HIGH')).toBe(true);
      expect(isSeverity('MEDIUM')).toBe(true);
      expect(isSeverity('LOW')).toBe(true);
    });

    it('should return false for invalid severities', () => {
      expect(isSeverity('critical')).toBe(false);
      expect(isSeverity('NONE')).toBe(false);
    });
  });

  describe('isViolation', () => {
    it('should return true for valid violations', () => {
      expect(isViolation({
        type: 'TEST',
        severity: 'HIGH',
        message: 'test message',
      })).toBe(true);
    });

    it('should return false for invalid violations', () => {
      expect(isViolation({})).toBe(false);
      expect(isViolation({ type: 'TEST' })).toBe(false);
      expect(isViolation(null)).toBe(false);
    });
  });
});
