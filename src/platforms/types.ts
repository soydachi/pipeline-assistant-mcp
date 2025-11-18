/**
 * Platform abstraction types for multi-platform CI/CD support
 */

export type PlatformType = 'azure-devops' | 'github-actions' | 'gitlab-ci';

export interface PlatformTask {
  /** Task identifier (e.g., 'NodeTool@0' for Azure, 'actions/setup-node@v4' for GitHub) */
  id: string;
  /** Display name for the task */
  displayName: string;
  /** Task inputs/parameters */
  inputs?: Record<string, string | boolean | number>;
  /** Environment variables */
  env?: Record<string, string>;
  /** Condition for running this task */
  condition?: string;
  /** Whether to continue on error */
  continueOnError?: boolean;
}

export interface PlatformScript {
  /** Shell script to execute */
  script: string;
  /** Display name */
  displayName: string;
  /** Working directory */
  workingDirectory?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Whether to continue on error */
  continueOnError?: boolean;
  /** Condition for running */
  condition?: string;
}

export type PlatformStep = PlatformTask | PlatformScript;

export interface PlatformJob {
  /** Job identifier */
  id: string;
  /** Display name */
  displayName: string;
  /** Steps in the job */
  steps: PlatformStep[];
  /** Job dependencies */
  dependsOn?: string[];
  /** Condition for running */
  condition?: string;
  /** Pool/runner configuration */
  pool?: {
    vmImage?: string;
    name?: string;
  };
  /** Environment variables */
  env?: Record<string, string>;
  /** Services/containers for the job */
  services?: Record<string, ServiceContainer>;
}

export interface ServiceContainer {
  image: string;
  ports?: string[];
  env?: Record<string, string>;
  options?: string;
}

export interface PlatformStage {
  /** Stage identifier */
  id: string;
  /** Display name */
  displayName: string;
  /** Jobs in the stage */
  jobs: PlatformJob[];
  /** Stage dependencies */
  dependsOn?: string[];
  /** Condition for running */
  condition?: string;
}

export interface PlatformVariable {
  name?: string;
  value?: string;
  /** Variable group name (Azure DevOps) */
  group?: string;
  /** Secret reference */
  secret?: boolean;
}

export interface PlatformTrigger {
  branches?: {
    include?: string[];
    exclude?: string[];
  };
  paths?: {
    include?: string[];
    exclude?: string[];
  };
  /** PR trigger configuration */
  pr?: {
    branches?: string[];
    paths?: string[];
  };
}

export interface PlatformPipeline {
  /** Platform type */
  platform: PlatformType;
  /** Pipeline name */
  name?: string;
  /** Trigger configuration */
  trigger?: PlatformTrigger;
  /** Variables */
  variables?: PlatformVariable[];
  /** Stages (for multi-stage pipelines) */
  stages?: PlatformStage[];
  /** Jobs (for single-stage pipelines) */
  jobs?: PlatformJob[];
  /** Default pool/runner */
  pool?: {
    vmImage?: string;
    name?: string;
  };
}

/**
 * Platform adapter interface - each platform implements this
 */
export interface PlatformAdapter {
  /** Platform identifier */
  readonly platform: PlatformType;

  /** Convert abstract pipeline to platform-specific YAML */
  generateYaml(pipeline: PlatformPipeline): string;

  /** Get Node.js setup task */
  getNodeSetupTask(version: string): PlatformStep;

  /** Get .NET setup task */
  getDotNetSetupTask(version: string): PlatformStep;

  /** Get Python setup task */
  getPythonSetupTask(version: string): PlatformStep;

  /** Get cache task */
  getCacheTask(key: string, path: string, restoreKeys?: string[]): PlatformStep;

  /** Get Docker build task */
  getDockerBuildTask(options: DockerBuildOptions): PlatformStep;

  /** Get Docker push task */
  getDockerPushTask(options: DockerPushOptions): PlatformStep | PlatformStep[];

  /** Get secret scanning step (TruffleHog) */
  getSecretScanningStep(): PlatformStep;

  /** Get SAST step (SonarQube) */
  getSastStep(projectType: string, options?: SastOptions): PlatformStep[];

  /** Get dependency scanning step (Snyk) */
  getDependencyScanningStep(options?: DependencyScanOptions): PlatformStep;

  /** Get container scanning step (Trivy) */
  getContainerScanningStep(image: string): PlatformStep;

  /** Get artifact publish task */
  getPublishArtifactTask(name: string, path: string): PlatformStep;

  /** Get test results publish task */
  getPublishTestResultsTask(format: string, files: string): PlatformStep;

  /** Get code coverage publish task */
  getPublishCodeCoverageTask(format: string, summaryFile: string): PlatformStep;

  /** Get Key Vault secrets step */
  getKeyVaultStep(vaultName: string): PlatformStep;
}

export interface DockerBuildOptions {
  repository: string;
  dockerfile: string;
  tags: string[];
  context?: string;
  buildArgs?: Record<string, string>;
}

export interface DockerPushOptions {
  repository: string;
  tags: string[];
  registry?: string;
  serviceConnection?: string;
}

export interface SastOptions {
  projectKey?: string;
  organization?: string;
  extraProperties?: Record<string, string>;
  serviceConnection?: string;
}

export interface DependencyScanOptions {
  severityThreshold?: 'low' | 'medium' | 'high' | 'critical';
  failOnIssues?: boolean;
  serviceConnection?: string;
}

/**
 * Platform-specific configuration
 */
export interface PlatformConfig {
  platform: PlatformType;
  /** Default VM image / runner */
  defaultRunner: string;
  /** Service connection names */
  serviceConnections?: {
    docker?: string;
    sonarqube?: string;
    snyk?: string;
    azure?: string;
  };
  /** Variable groups to include */
  variableGroups?: string[];
}
