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
    features: ['orm', 'migrations', 'type-safe', 'sql-like']
  },
  compatible: {
    runtimes: ['node', 'bun'],
    auth: '*',
    databases: '*'
  }
};

export const DrizzlePlugin: DatabasePlugin = {
  name: 'drizzle',
  displayName: 'Drizzle',
  manifest,

  getDependencies(): { prod: Dependency[]; dev: Dependency[] } {
    return {
      prod: [
        { name: 'drizzle-orm', version: '^0.38.3' },
        { name: 'postgres', version: '^3.4.5' }
      ],
      dev: [
        { name: 'drizzle-kit', version: '^0.30.1' }
      ]
    };
  },

  getEnvVars(): EnvVar[] {
    return [
      {
        key: 'DATABASE_URL',
        value: 'postgresql://user:password@localhost:5432/mydb',
        required: true,
        description: 'Database connection string'
      }
    ];
  },

  getConfigFiles(): TemplateFile[] {
    return [
      {
        path: 'src/db/schema.ts',
        template: 'drizzle-schema',
        context: {}
      },
      {
        path: 'src/db/index.ts',
        template: 'drizzle-client',
        context: {}
      },
      {
        path: 'drizzle.config.ts',
        template: 'drizzle-config',
        context: {}
      }
    ];
  },

  getClientSnippet(): CodeSnippet {
    return {
      code: `// Database client is exported from src/db/index.ts`,
      imports: ["import { db } from './db/index.js';"]
    };
  },

  getScripts(): Record<string, string> {
    return {
      'db:generate': 'drizzle-kit generate',
      'db:push': 'drizzle-kit push',
      'db:migrate': 'drizzle-kit migrate',
      'db:studio': 'drizzle-kit studio'
    };
  }
};

// Drizzle schema template content
export const drizzleSchemaTemplate = `import { pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});
`;

export const drizzleClientTemplate = `import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);

export const db = drizzle(client, { schema });
`;

export const drizzleConfigTemplate = `import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!
  }
});
`;
