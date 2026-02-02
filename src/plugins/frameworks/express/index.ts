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
    features: ['middleware', 'routing', 'static-files']
  },
  compatible: {
    runtimes: ['node', 'bun'],
    auth: ['passport', 'better-auth'],
    databases: ['prisma', 'drizzle']
  }
};

export const ExpressPlugin: FrameworkPlugin = {
  name: 'express',
  displayName: 'Express',
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
      { name: 'express', version: '^5.0.1' }
    ];

    // Add cors if enabled
    if (config.features.cors) {
      prod.push({ name: 'cors', version: '^2.8.5' });
    }

    // Add morgan for logging
    if (config.features.logging) {
      prod.push({ name: 'morgan', version: '^1.10.0' });
    }

    // Add dotenv for Node.js
    const envStrategy = config.runtime.getEnvLoadingStrategy();
    if (envStrategy.package) {
      prod.push({ name: envStrategy.package, version: '^16.4.7' });
    }

    const dev: Dependency[] = [
      { name: '@types/express', version: '^5.0.0' }
    ];

    if (config.features.cors) {
      dev.push({ name: '@types/cors', version: '^2.8.17' });
    }

    if (config.features.logging) {
      dev.push({ name: '@types/morgan', version: '^1.9.9' });
    }

    return { prod, dev };
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
        code: `app.use(cors());`,
        imports: ["import cors from 'cors';"]
      },
      logging: {
        code: `app.use(morgan('dev'));`,
        imports: ["import morgan from 'morgan';"]
      },
      json: {
        code: `app.use(express.json());`,
        imports: []
      }
    };
    return snippets[type] || null;
  },

  getEntryFile(): string {
    return 'src/index.ts';
  }
};
