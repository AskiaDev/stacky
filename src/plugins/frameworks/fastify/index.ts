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
    features: ['middleware', 'routing', 'hooks', 'validation', 'serialization']
  },
  compatible: {
    runtimes: ['node', 'bun'],
    auth: ['passport', 'better-auth'],
    databases: ['prisma', 'drizzle']
  }
};

export const FastifyPlugin: FrameworkPlugin = {
  name: 'fastify',
  displayName: 'Fastify',
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
      { name: 'fastify', version: '^5.2.0' }
    ];

    // Add cors plugin if enabled
    if (config.features.cors) {
      prod.push({ name: '@fastify/cors', version: '^10.0.1' });
    }

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
        code: `await fastify.register(cors, { origin: true });`,
        imports: ["import cors from '@fastify/cors';"]
      }
    };
    return snippets[type] || null;
  },

  getEntryFile(): string {
    return 'src/index.ts';
  }
};
