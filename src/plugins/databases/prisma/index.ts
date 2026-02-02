import type {
  DatabasePlugin,
  CapabilityManifest,
  Dependency,
  EnvVar,
  TemplateFile,
  CodeSnippet
} from '../../../core/types.js';

const manifest: CapabilityManifest = {
  provides: {
    type: 'database',
    features: ['orm', 'migrations', 'studio', 'type-safe']
  },
  compatible: {
    runtimes: ['node', 'bun'],
    auth: '*',
    databases: '*'
  }
};

export const PrismaPlugin: DatabasePlugin = {
  name: 'prisma',
  displayName: 'Prisma',
  manifest,

  getDependencies(): { prod: Dependency[]; dev: Dependency[] } {
    return {
      prod: [
        { name: '@prisma/client', version: '^6.2.1' }
      ],
      dev: [
        { name: 'prisma', version: '^6.2.1' }
      ]
    };
  },

  getEnvVars(): EnvVar[] {
    return [
      {
        key: 'DATABASE_URL',
        value: 'postgresql://user:password@localhost:5432/mydb?schema=public',
        required: true,
        description: 'Database connection string'
      }
    ];
  },

  getConfigFiles(): TemplateFile[] {
    return [
      {
        path: 'prisma/schema.prisma',
        template: 'prisma-schema',
        context: {}
      }
    ];
  },

  getClientSnippet(): CodeSnippet {
    return {
      code: `const prisma = new PrismaClient();`,
      imports: ["import { PrismaClient } from '@prisma/client';"]
    };
  },

  getScripts(): Record<string, string> {
    return {
      'db:generate': 'prisma generate',
      'db:push': 'prisma db push',
      'db:migrate': 'prisma migrate dev',
      'db:studio': 'prisma studio'
    };
  }
};

// Prisma schema template content
export const prismaSchemaTemplate = `// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Example model - customize as needed
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
`;
