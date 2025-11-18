/**
 * Dependency Injection Container
 *
 * Provides centralized management of service instances and their dependencies.
 * Supports lazy initialization and singleton patterns.
 */

import { WikiParser } from './wiki-parser.js';
import { PipelineGenerator } from './pipeline-generator.js';
import { PipelineAnalyzer } from './pipeline-analyzer.js';
import { PolicyEnforcer } from './policy-enforcer.js';
import { createLogger } from './utils/logger.js';
import { WIKI_PATHS } from './utils/constants.js';

const logger = createLogger('Container');

/**
 * Configuration for the DI container
 */
export interface ContainerConfig {
  wikiPath: string;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: ContainerConfig = {
  wikiPath: WIKI_PATHS.STANDARDS,
};

/**
 * Service types available in the container
 */
export type ServiceType =
  | 'wikiParser'
  | 'pipelineGenerator'
  | 'pipelineAnalyzer'
  | 'policyEnforcer';

/**
 * DI Container for managing service instances
 */
export class Container {
  private static instance: Container | null = null;
  private config: ContainerConfig;
  private services: Map<ServiceType, unknown> = new Map();
  private initialized: boolean = false;

  private constructor(config: ContainerConfig) {
    this.config = config;
  }

  /**
   * Get the singleton container instance
   */
  static getInstance(config?: Partial<ContainerConfig>): Container {
    if (!Container.instance) {
      Container.instance = new Container({
        ...DEFAULT_CONFIG,
        ...config,
      });
      logger.debug('Container instance created', { config: Container.instance.config });
    }
    return Container.instance;
  }

  /**
   * Reset the container (useful for testing)
   */
  static reset(): void {
    if (Container.instance) {
      Container.instance.services.clear();
      Container.instance.initialized = false;
      Container.instance = null;
      logger.debug('Container reset');
    }
  }

  /**
   * Configure the container with new settings
   */
  configure(config: Partial<ContainerConfig>): void {
    this.config = { ...this.config, ...config };
    // Clear cached services when config changes
    this.services.clear();
    this.initialized = false;
    logger.debug('Container reconfigured', { config: this.config });
  }

  /**
   * Get the WikiParser singleton
   */
  getWikiParser(): WikiParser {
    if (!this.services.has('wikiParser')) {
      const wikiParser = new WikiParser(this.config.wikiPath);
      this.services.set('wikiParser', wikiParser);
      logger.debug('WikiParser created', { wikiPath: this.config.wikiPath });
    }
    return this.services.get('wikiParser') as WikiParser;
  }

  /**
   * Get the PipelineGenerator singleton
   */
  getPipelineGenerator(): PipelineGenerator {
    if (!this.services.has('pipelineGenerator')) {
      const wikiParser = this.getWikiParser();
      const generator = new PipelineGenerator(wikiParser);
      this.services.set('pipelineGenerator', generator);
      logger.debug('PipelineGenerator created');
    }
    return this.services.get('pipelineGenerator') as PipelineGenerator;
  }

  /**
   * Get the PipelineAnalyzer singleton
   */
  getPipelineAnalyzer(): PipelineAnalyzer {
    if (!this.services.has('pipelineAnalyzer')) {
      const wikiParser = this.getWikiParser();
      const analyzer = new PipelineAnalyzer(wikiParser);
      this.services.set('pipelineAnalyzer', analyzer);
      logger.debug('PipelineAnalyzer created');
    }
    return this.services.get('pipelineAnalyzer') as PipelineAnalyzer;
  }

  /**
   * Get the PolicyEnforcer singleton
   */
  getPolicyEnforcer(): PolicyEnforcer {
    if (!this.services.has('policyEnforcer')) {
      const wikiParser = this.getWikiParser();
      const enforcer = new PolicyEnforcer(wikiParser);
      this.services.set('policyEnforcer', enforcer);
      logger.debug('PolicyEnforcer created');
    }
    return this.services.get('policyEnforcer') as PolicyEnforcer;
  }

  /**
   * Initialize all services and load standards
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    logger.info('Initializing container services');

    const wikiParser = this.getWikiParser();
    await wikiParser.loadStandards();

    // Pre-create all services
    this.getPipelineGenerator();
    this.getPipelineAnalyzer();
    this.getPolicyEnforcer();

    this.initialized = true;
    logger.info('Container initialization complete');
  }

  /**
   * Check if the container is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get current configuration
   */
  getConfig(): ContainerConfig {
    return { ...this.config };
  }

  /**
   * Register a custom service instance (for testing)
   */
  register<T>(serviceType: ServiceType, instance: T): void {
    this.services.set(serviceType, instance);
    logger.debug('Custom service registered', { serviceType });
  }
}

/**
 * Convenience function to get the container instance
 */
export function getContainer(config?: Partial<ContainerConfig>): Container {
  return Container.getInstance(config);
}

/**
 * Convenience functions for getting services directly
 */
export function getWikiParser(): WikiParser {
  return getContainer().getWikiParser();
}

export function getPipelineGenerator(): PipelineGenerator {
  return getContainer().getPipelineGenerator();
}

export function getPipelineAnalyzer(): PipelineAnalyzer {
  return getContainer().getPipelineAnalyzer();
}

export function getPolicyEnforcer(): PolicyEnforcer {
  return getContainer().getPolicyEnforcer();
}
