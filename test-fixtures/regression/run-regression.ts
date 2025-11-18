#!/usr/bin/env npx ts-node

/**
 * Regression Test Runner
 *
 * Executes all test scenarios and validates results against expected outcomes.
 * Use this to ensure changes don't break existing functionality.
 */

import { PipelineAnalyzer } from '../../src/pipeline-analyzer.js';
import { WikiParser } from '../../src/wiki-parser.js';
import { PolicyEnforcer } from '../../src/policy-enforcer.js';
import { promises as fs } from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface TestCase {
  name: string;
  file: string;
  expectedMinScore?: number;
  expectedMaxScore?: number;
  expectedViolations?: string[];
  expectedPolicies?: string[];
  shouldFail?: boolean;
}

interface TestSuite {
  name: string;
  description: string;
  tests: TestCase[];
}

interface TestResult {
  name: string;
  passed: boolean;
  score?: number;
  violations?: string[];
  error?: string;
  duration: number;
}

// Test suites definition
const testSuites: TestSuite[] = [
  {
    name: 'Security',
    description: 'Security vulnerability detection',
    tests: [
      {
        name: 'Hardcoded secrets detection',
        file: 'scenarios/security/hardcoded-secrets.yml',
        expectedMaxScore: 35,
        expectedViolations: ['HARDCODED_SECRET', 'UNSAFE_TRIGGER']
      },
      {
        name: 'Security bypass detection',
        file: 'scenarios/security/bypass-security-tools.yml',
        expectedMaxScore: 45,
        expectedViolations: ['SECURITY_BYPASS']
      },
      {
        name: 'Missing security stage',
        file: 'scenarios/security/missing-security-stage.yml',
        expectedMaxScore: 55,
        expectedViolations: ['MISSING_SECURITY_STAGE']
      },
      {
        name: 'Exposed secrets in logs',
        file: 'scenarios/security/exposed-secrets-in-logs.yml',
        expectedMaxScore: 40,
        expectedViolations: ['SECRET_EXPOSURE']
      },
      {
        name: 'Minimal insecure pipeline',
        file: 'scenarios/security/minimal-insecure.yml',
        expectedMaxScore: 30
      }
    ]
  },
  {
    name: 'Compliance',
    description: 'Pipeline structure and compliance checks',
    tests: [
      {
        name: 'No stages structure',
        file: 'scenarios/compliance/no-stages-structure.yml',
        expectedMaxScore: 60,
        expectedViolations: ['NO_STAGES']
      },
      {
        name: 'Unsafe trigger',
        file: 'scenarios/compliance/unsafe-trigger.yml',
        expectedMaxScore: 45,
        expectedViolations: ['UNSAFE_TRIGGER']
      },
      {
        name: 'Missing cache',
        file: 'scenarios/compliance/missing-cache.yml',
        expectedMinScore: 60,
        expectedMaxScore: 80
      },
      {
        name: 'No approval gates',
        file: 'scenarios/compliance/no-approval-gates.yml',
        expectedMaxScore: 55
      }
    ]
  },
  {
    name: 'Project Types',
    description: 'Correct configurations for different project types',
    tests: [
      {
        name: 'Node.js TypeScript',
        file: 'scenarios/project-types/node-typescript.yml',
        expectedMinScore: 85
      },
      {
        name: '.NET Web API',
        file: 'scenarios/project-types/dotnet-webapi.yml',
        expectedMinScore: 85
      },
      {
        name: 'Python Django',
        file: 'scenarios/project-types/python-django.yml',
        expectedMinScore: 85
      },
      {
        name: 'Java Maven',
        file: 'scenarios/project-types/java-maven.yml',
        expectedMinScore: 85
      }
    ]
  },
  {
    name: 'Azure Services',
    description: 'Azure service integrations',
    tests: [
      {
        name: 'SQL + Redis',
        file: 'scenarios/azure-services/dotnet-sql-redis.yml',
        expectedMinScore: 80
      },
      {
        name: 'CosmosDB + Functions',
        file: 'scenarios/azure-services/cosmosdb-functions.yml',
        expectedMinScore: 80
      },
      {
        name: 'AKS Deployment',
        file: 'scenarios/azure-services/aks-deployment.yml',
        expectedMinScore: 80
      },
      {
        name: 'Service Bus + Storage',
        file: 'scenarios/azure-services/servicebus-storage.yml',
        expectedMinScore: 80
      }
    ]
  },
  {
    name: 'Environments',
    description: 'Environment-specific configurations',
    tests: [
      {
        name: 'Dev minimal',
        file: 'scenarios/environments/dev-minimal.yml',
        expectedMinScore: 55,
        expectedMaxScore: 75
      },
      {
        name: 'Staging complete',
        file: 'scenarios/environments/staging-complete.yml',
        expectedMinScore: 80
      },
      {
        name: 'Production secure',
        file: 'scenarios/environments/production-secure.yml',
        expectedMinScore: 90
      }
    ]
  },
  {
    name: 'Edge Cases',
    description: 'Error handling and edge cases',
    tests: [
      {
        name: 'Invalid YAML',
        file: 'scenarios/edge-cases/invalid-yaml.yml',
        shouldFail: true
      },
      {
        name: 'Circular dependencies',
        file: 'scenarios/edge-cases/circular-dependencies.yml',
        shouldFail: true
      },
      {
        name: 'Empty pipeline',
        file: 'scenarios/edge-cases/empty-pipeline.yml',
        shouldFail: true
      },
      {
        name: 'Timeout issues',
        file: 'scenarios/edge-cases/timeout-issues.yml',
        expectedMaxScore: 65
      }
    ]
  }
];

class RegressionRunner {
  private analyzer!: PipelineAnalyzer;
  private enforcer!: PolicyEnforcer;
  private basePath: string;
  private results: TestResult[] = [];

  constructor() {
    this.basePath = path.join(__dirname, '..');
  }

  async initialize(): Promise<void> {
    const wikiParser = new WikiParser('./wiki/standards');
    await wikiParser.loadStandards();

    this.analyzer = new PipelineAnalyzer(wikiParser);
    this.enforcer = new PolicyEnforcer(wikiParser);
    await this.enforcer.loadPolicies();
  }

  async runTest(test: TestCase): Promise<TestResult> {
    const startTime = Date.now();
    const filePath = path.join(this.basePath, test.file);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const result = await this.analyzer.analyze(content, {
        projectType: this.detectProjectType(test.file)
      });

      const duration = Date.now() - startTime;

      // Check if test should fail
      if (test.shouldFail) {
        return {
          name: test.name,
          passed: false,
          error: 'Expected analysis to fail but it succeeded',
          duration
        };
      }

      // Validate score
      let scorePassed = true;
      if (test.expectedMinScore !== undefined && result.score < test.expectedMinScore) {
        scorePassed = false;
      }
      if (test.expectedMaxScore !== undefined && result.score > test.expectedMaxScore) {
        scorePassed = false;
      }

      // Validate violations
      let violationsPassed = true;
      if (test.expectedViolations) {
        const foundTypes = result.violations.map((v: any) => v.type);
        violationsPassed = test.expectedViolations.every(expected =>
          foundTypes.some((found: string) => found.includes(expected))
        );
      }

      const passed = scorePassed && violationsPassed;

      return {
        name: test.name,
        passed,
        score: result.score,
        violations: result.violations.map((v: any) => v.type),
        duration,
        error: !passed ? this.getFailureReason(test, result) : undefined
      };

    } catch (error) {
      const duration = Date.now() - startTime;

      if (test.shouldFail) {
        return {
          name: test.name,
          passed: true,
          duration,
          error: undefined
        };
      }

      return {
        name: test.name,
        passed: false,
        error: error instanceof Error ? error.message : String(error),
        duration
      };
    }
  }

  private detectProjectType(file: string): string {
    if (file.includes('node') || file.includes('typescript')) return 'node';
    if (file.includes('dotnet')) return 'dotnet';
    if (file.includes('python')) return 'python';
    if (file.includes('java')) return 'java';
    return 'node';
  }

  private getFailureReason(test: TestCase, result: any): string {
    const reasons: string[] = [];

    if (test.expectedMinScore !== undefined && result.score < test.expectedMinScore) {
      reasons.push(`Score ${result.score}% < expected min ${test.expectedMinScore}%`);
    }
    if (test.expectedMaxScore !== undefined && result.score > test.expectedMaxScore) {
      reasons.push(`Score ${result.score}% > expected max ${test.expectedMaxScore}%`);
    }
    if (test.expectedViolations) {
      const foundTypes = result.violations.map((v: any) => v.type);
      const missing = test.expectedViolations.filter(expected =>
        !foundTypes.some((found: string) => found.includes(expected))
      );
      if (missing.length > 0) {
        reasons.push(`Missing violations: ${missing.join(', ')}`);
      }
    }

    return reasons.join('; ');
  }

  async runSuite(suite: TestSuite): Promise<TestResult[]> {
    const results: TestResult[] = [];

    for (const test of suite.tests) {
      const result = await this.runTest(test);
      results.push(result);
      this.results.push(result);
    }

    return results;
  }

  async runAll(): Promise<void> {
    console.log('\n🧪 Pipeline Assistant - Regression Tests\n');
    console.log('═'.repeat(60));

    await this.initialize();

    let totalPassed = 0;
    let totalFailed = 0;

    for (const suite of testSuites) {
      console.log(`\n📋 ${suite.name}`);
      console.log(`   ${suite.description}`);
      console.log('─'.repeat(60));

      const results = await this.runSuite(suite);

      for (const result of results) {
        const icon = result.passed ? '✅' : '❌';
        const scoreStr = result.score !== undefined ? ` (${result.score}%)` : '';
        const timeStr = ` [${result.duration}ms]`;

        console.log(`${icon} ${result.name}${scoreStr}${timeStr}`);

        if (!result.passed && result.error) {
          console.log(`   └─ ${result.error}`);
        }

        if (result.passed) totalPassed++;
        else totalFailed++;
      }
    }

    // Summary
    console.log('\n' + '═'.repeat(60));
    console.log('\n📊 Summary\n');

    const total = totalPassed + totalFailed;
    const passRate = ((totalPassed / total) * 100).toFixed(1);

    console.log(`   Total:  ${total} tests`);
    console.log(`   Passed: ${totalPassed} (${passRate}%)`);
    console.log(`   Failed: ${totalFailed}`);

    if (totalFailed > 0) {
      console.log('\n❌ Regression tests failed!\n');
      process.exit(1);
    } else {
      console.log('\n✅ All regression tests passed!\n');
      process.exit(0);
    }
  }

  async generateReport(): Promise<void> {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: this.results.length,
        passed: this.results.filter(r => r.passed).length,
        failed: this.results.filter(r => !r.passed).length
      },
      suites: testSuites.map(suite => ({
        name: suite.name,
        tests: this.results.filter(r =>
          suite.tests.some(t => t.name === r.name)
        )
      }))
    };

    const reportPath = path.join(this.basePath, 'regression', 'report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Report saved to: ${reportPath}`);
  }
}

// Run if executed directly
const runner = new RegressionRunner();
runner.runAll().then(() => runner.generateReport());

export { RegressionRunner, testSuites };
