import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  Container,
  getContainer,
  getWikiParser,
  getPipelineGenerator,
  getPipelineAnalyzer,
  getPolicyEnforcer,
  DEFAULT_CONFIG,
} from '../src/container';
import { WikiParser } from '../src/wiki-parser';
import { PipelineGenerator } from '../src/pipeline-generator';
import { PipelineAnalyzer } from '../src/pipeline-analyzer';
import { PolicyEnforcer } from '../src/policy-enforcer';

describe('Container', () => {
  beforeEach(() => {
    Container.reset();
  });

  afterEach(() => {
    Container.reset();
  });

  describe('getInstance', () => {
    it('should return the same instance', () => {
      const instance1 = Container.getInstance();
      const instance2 = Container.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should use default config', () => {
      const container = Container.getInstance();
      expect(container.getConfig()).toEqual(DEFAULT_CONFIG);
    });

    it('should accept custom config', () => {
      const container = Container.getInstance({ wikiPath: './custom/path' });
      expect(container.getConfig().wikiPath).toBe('./custom/path');
    });
  });

  describe('reset', () => {
    it('should reset the singleton instance', () => {
      const instance1 = Container.getInstance();
      Container.reset();
      const instance2 = Container.getInstance();
      expect(instance1).not.toBe(instance2);
    });

    it('should clear services on reset', () => {
      const container = Container.getInstance();
      container.getWikiParser();
      expect(container.isInitialized()).toBe(false);

      Container.reset();
      const newContainer = Container.getInstance();
      expect(newContainer.isInitialized()).toBe(false);
    });
  });

  describe('configure', () => {
    it('should update config', () => {
      const container = Container.getInstance();
      container.configure({ wikiPath: './new/path' });
      expect(container.getConfig().wikiPath).toBe('./new/path');
    });

    it('should clear cached services when reconfigured', () => {
      const container = Container.getInstance();
      const parser1 = container.getWikiParser();
      container.configure({ wikiPath: './new/path' });
      const parser2 = container.getWikiParser();
      expect(parser1).not.toBe(parser2);
    });
  });

  describe('getWikiParser', () => {
    it('should return WikiParser instance', () => {
      const container = Container.getInstance();
      const parser = container.getWikiParser();
      expect(parser).toBeInstanceOf(WikiParser);
    });

    it('should return the same instance (singleton)', () => {
      const container = Container.getInstance();
      const parser1 = container.getWikiParser();
      const parser2 = container.getWikiParser();
      expect(parser1).toBe(parser2);
    });
  });

  describe('getPipelineGenerator', () => {
    it('should return PipelineGenerator instance', () => {
      const container = Container.getInstance();
      const generator = container.getPipelineGenerator();
      expect(generator).toBeInstanceOf(PipelineGenerator);
    });

    it('should return the same instance (singleton)', () => {
      const container = Container.getInstance();
      const gen1 = container.getPipelineGenerator();
      const gen2 = container.getPipelineGenerator();
      expect(gen1).toBe(gen2);
    });
  });

  describe('getPipelineAnalyzer', () => {
    it('should return PipelineAnalyzer instance', () => {
      const container = Container.getInstance();
      const analyzer = container.getPipelineAnalyzer();
      expect(analyzer).toBeInstanceOf(PipelineAnalyzer);
    });

    it('should return the same instance (singleton)', () => {
      const container = Container.getInstance();
      const ana1 = container.getPipelineAnalyzer();
      const ana2 = container.getPipelineAnalyzer();
      expect(ana1).toBe(ana2);
    });
  });

  describe('getPolicyEnforcer', () => {
    it('should return PolicyEnforcer instance', () => {
      const container = Container.getInstance();
      const enforcer = container.getPolicyEnforcer();
      expect(enforcer).toBeInstanceOf(PolicyEnforcer);
    });

    it('should return the same instance (singleton)', () => {
      const container = Container.getInstance();
      const enf1 = container.getPolicyEnforcer();
      const enf2 = container.getPolicyEnforcer();
      expect(enf1).toBe(enf2);
    });
  });

  describe('register', () => {
    it('should register custom service instance', () => {
      const container = Container.getInstance();
      const mockParser = new WikiParser('./mock/path');
      container.register('wikiParser', mockParser);

      const parser = container.getWikiParser();
      expect(parser).toBe(mockParser);
    });
  });

  describe('initialize', () => {
    it('should set initialized flag', async () => {
      const container = Container.getInstance();
      expect(container.isInitialized()).toBe(false);

      await container.initialize();
      expect(container.isInitialized()).toBe(true);
    });

    it('should only initialize once', async () => {
      const container = Container.getInstance();
      await container.initialize();
      await container.initialize(); // Should be no-op
      expect(container.isInitialized()).toBe(true);
    });
  });
});

describe('Convenience functions', () => {
  beforeEach(() => {
    Container.reset();
  });

  afterEach(() => {
    Container.reset();
  });

  it('getContainer should return container instance', () => {
    const container = getContainer();
    expect(container).toBeInstanceOf(Container);
  });

  it('getWikiParser should return WikiParser', () => {
    const parser = getWikiParser();
    expect(parser).toBeInstanceOf(WikiParser);
  });

  it('getPipelineGenerator should return PipelineGenerator', () => {
    const generator = getPipelineGenerator();
    expect(generator).toBeInstanceOf(PipelineGenerator);
  });

  it('getPipelineAnalyzer should return PipelineAnalyzer', () => {
    const analyzer = getPipelineAnalyzer();
    expect(analyzer).toBeInstanceOf(PipelineAnalyzer);
  });

  it('getPolicyEnforcer should return PolicyEnforcer', () => {
    const enforcer = getPolicyEnforcer();
    expect(enforcer).toBeInstanceOf(PolicyEnforcer);
  });

  it('convenience functions should use same container', () => {
    const parser1 = getWikiParser();
    const parser2 = getContainer().getWikiParser();
    expect(parser1).toBe(parser2);
  });
});
