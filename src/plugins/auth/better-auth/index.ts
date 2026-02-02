import type {
  AuthPlugin,
  CapabilityManifest,
  Dependency,
  EnvVar,
  TemplateFile,
  CodeSnippet,
  FrameworkPlugin
} from '../../../core/types.js';

const manifest: CapabilityManifest = {
  provides: {
    type: 'auth',
    features: ['session', 'oauth', 'email-password', 'magic-link']
  },
  compatible: {
    runtimes: ['node', 'bun'],
    auth: '*',
    databases: ['prisma', 'drizzle']
  },
  requires: {
    features: ['middleware']
  }
};

export const BetterAuthPlugin: AuthPlugin = {
  name: 'better-auth',
  displayName: 'Better Auth',
  manifest,

  getDependencies(): { prod: Dependency[]; dev: Dependency[] } {
    return {
      prod: [
        { name: 'better-auth', version: '^1.2.5' }
      ],
      dev: []
    };
  },

  getEnvVars(): EnvVar[] {
    return [
      {
        key: 'BETTER_AUTH_SECRET',
        value: 'your-secret-key-change-in-production',
        required: true,
        description: 'Secret key for Better Auth sessions'
      },
      {
        key: 'BETTER_AUTH_URL',
        value: 'http://localhost:3000',
        required: true,
        description: 'Base URL for authentication'
      }
    ];
  },

  getTemplateContext(framework: FrameworkPlugin): Record<string, unknown> {
    return {
      framework: framework.name
    };
  },

  getSetupSnippet(framework: FrameworkPlugin): CodeSnippet {
    switch (framework.name) {
      case 'hono':
        return {
          code: `app.on(['POST', 'GET'], '/api/auth/*', (c) => auth.handler(c.req.raw));`,
          imports: ["import { auth } from './lib/auth.js';"]
        };
      case 'express':
        return {
          code: `app.all('/api/auth/*splat', toNodeHandler(auth));`,
          imports: [
            "import { toNodeHandler } from 'better-auth/node';",
            "import { auth } from './lib/auth.js';"
          ]
        };
      case 'fastify':
        return {
          code: `fastify.all('/api/auth/*', async (request, reply) => {\n    return auth.handler(request.raw);\n  });`,
          imports: ["import { auth } from './lib/auth.js';"]
        };
      default:
        return { code: '', imports: [] };
    }
  },

  getFiles(): TemplateFile[] {
    return [
      {
        path: 'src/lib/auth.ts',
        template: 'better-auth-config',
        context: {}
      }
    ];
  }
};

// Better Auth config template for Drizzle
export const betterAuthDrizzleTemplate = `import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '../db/index.js';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg'
  }),
  emailAndPassword: {
    enabled: true
  }
});
`;

// Better Auth config template for Prisma
export const betterAuthPrismaTemplate = `import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql'
  }),
  emailAndPassword: {
    enabled: true
  }
});
`;
