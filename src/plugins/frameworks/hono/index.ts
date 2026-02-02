import type {
  FrameworkPlugin,
  ProjectConfig,
  RuntimeAdapter,
  CapabilityManifest,
  Dependency,
  CodeSnippet
} from '../../../core/types.js';

const manifest: CapabilityManifest = {
  provides: {
    type: 'framework',
    features: ['middleware', 'routing', 'context', 'websockets']
  },
  compatible: {
    runtimes: ['node', 'bun'],
    auth: ['passport', 'better-auth'],
    databases: ['prisma', 'drizzle']
  }
};

export const HonoPlugin: FrameworkPlugin = {
  name: 'hono',
  displayName: 'Hono',
  manifest,

  getTemplateContext(config: ProjectConfig): Record<string, unknown> {
    const envStrategy = config.runtime.getEnvLoadingStrategy();

    return {
      projectName: config.name,
      runtime: config.runtime.name,
      useTypeScript: true,
      envLoadSnippet: envStrategy.loadSnippet || '',
      features: {
        cors: config.features.cors,
        logging: config.features.logging,
        healthCheck: config.features.healthCheck
      },
      hasAuth: config.auth !== null,
      hasDatabase: config.database !== null
    };
  },

  getDependencies(config: ProjectConfig): { prod: Dependency[]; dev: Dependency[] } {
    const prod: Dependency[] = [
      { name: 'hono', version: '^4.6.14' }
    ];

    // Add node server adapter for Node.js runtime
    if (config.runtime.name === 'node') {
      prod.push({ name: '@hono/node-server', version: '^1.13.7' });
    }

    // Add cors middleware if enabled
    // Note: Hono has built-in cors middleware, no extra package needed

    // Add dotenv for Node.js
    const envStrategy = config.runtime.getEnvLoadingStrategy();
    if (envStrategy.package) {
      prod.push({ name: envStrategy.package, version: '^16.4.7' });
    }

    return {
      prod,
      dev: []
    };
  },

  getScripts(runtime: RuntimeAdapter): Record<string, string> {
    const exec = runtime.getExecutable();

    if (runtime.name === 'bun') {
      return {
        dev: 'bun --watch src/index.ts',
        start: 'bun src/index.ts',
        build: 'bun build src/index.ts --outdir dist --target node'
      };
    }

    return {
      dev: `${exec} watch src/index.ts`,
      start: `${exec} src/index.ts`,
      build: 'tsc'
    };
  },

  getMiddlewareSnippet(type: string): CodeSnippet | null {
    const snippets: Record<string, CodeSnippet> = {
      cors: {
        code: `app.use('*', cors());`,
        imports: ["import { cors } from 'hono/cors';"]
      },
      logging: {
        code: `app.use('*', logger());`,
        imports: ["import { logger } from 'hono/logger';"]
      }
    };
    return snippets[type] || null;
  },

  getEntryFile(): string {
    return 'src/index.ts';
  }
};
