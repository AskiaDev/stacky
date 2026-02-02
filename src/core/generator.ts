import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ProjectConfig, GenerationContext, Dependency, EnvVar } from './types.js';
import { prismaSchemaTemplate } from '../plugins/databases/prisma/index.js';
import { drizzleSchemaTemplate, drizzleClientTemplate, drizzleConfigTemplate } from '../plugins/databases/drizzle/index.js';
import { betterAuthDrizzleTemplate, betterAuthPrismaTemplate } from '../plugins/auth/better-auth/index.js';
import { passportConfigTemplate } from '../plugins/auth/passport/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function generateProject(config: ProjectConfig): Promise<void> {
  const projectDir = path.resolve(process.cwd(), config.directory);

  // Build generation context
  const context = buildContext(config);

  // Create project directory
  await fs.mkdir(projectDir, { recursive: true });

  // Generate files based on framework
  await generateFrameworkFiles(projectDir, config, context);

  // Generate database files if selected
  if (config.database) {
    await generateDatabaseFiles(projectDir, config, context);
  }

  // Generate auth files if selected
  if (config.auth) {
    await generateAuthFiles(projectDir, config, context);
  }

  // Generate shared files
  await generateSharedFiles(projectDir, config, context);

  // Generate package.json
  await generatePackageJson(projectDir, config, context);

  // Generate tsconfig.json
  await generateTsConfig(projectDir);

  // Generate .env files
  await generateEnvFiles(projectDir, context);

  // Generate Docker files if enabled
  if (config.features.docker) {
    await generateDockerfile(projectDir, config, context);
  }

  // Generate .gitignore
  await generateGitignore(projectDir, config);

  // Generate ESLint config (always included)
  await generateEslintConfig(projectDir);
}

function buildContext(config: ProjectConfig): GenerationContext {
  const frameworkDeps = config.framework.getDependencies(config);
  const runtimeDeps = config.runtime.getRuntimeSpecificDeps();

  // Collect all dependencies
  const deps: Dependency[] = [...frameworkDeps.prod, ...runtimeDeps.prod];
  const devDeps: Dependency[] = [...frameworkDeps.dev, ...runtimeDeps.dev];

  // Add database dependencies
  if (config.database) {
    const dbDeps = config.database.getDependencies();
    deps.push(...dbDeps.prod);
    devDeps.push(...dbDeps.dev);
  }

  // Add auth dependencies
  if (config.auth) {
    const authDeps = config.auth.getDependencies();
    deps.push(...authDeps.prod);
    devDeps.push(...authDeps.dev);
  }

  // Add ESLint dependencies (always included)
  devDeps.push(
    { name: 'eslint', version: '^9.18.0' },
    { name: '@eslint/js', version: '^9.18.0' },
    { name: 'typescript-eslint', version: '^8.20.0' }
  );

  // Collect env vars
  const envVars: EnvVar[] = [
    { key: 'PORT', value: '3000', required: true, description: 'Server port' },
    { key: 'NODE_ENV', value: 'development', required: true, description: 'Environment' }
  ];

  // Add database env vars
  if (config.database) {
    envVars.push(...config.database.getEnvVars());
  }

  // Add auth env vars
  if (config.auth) {
    envVars.push(...config.auth.getEnvVars());
  }

  // Build scripts
  const scripts: Record<string, string> = {
    ...config.framework.getScripts(config.runtime)
  };

  // Add database scripts
  if (config.database) {
    Object.assign(scripts, config.database.getScripts());
  }

  // Add lint script (always included)
  scripts['lint'] = 'eslint src/';
  scripts['lint:fix'] = 'eslint src/ --fix';

  // Build middleware imports and setup
  const imports: string[] = [];
  let middlewareSetup = '';

  if (config.features.cors) {
    const corsSnippet = config.framework.getMiddlewareSnippet?.('cors');
    if (corsSnippet) {
      imports.push(...corsSnippet.imports);
      middlewareSetup += corsSnippet.code + '\n';
    }
  }

  if (config.features.logging) {
    const loggingSnippet = config.framework.getMiddlewareSnippet?.('logging');
    if (loggingSnippet) {
      imports.push(...loggingSnippet.imports);
      middlewareSetup += loggingSnippet.code + '\n';
    }
  }

  return {
    projectName: config.name,
    runtime: config.runtime.name,
    imports,
    middlewareSetup,
    routeSetup: '',
    scripts,
    deps,
    devDeps,
    envVars,
    framework: config.framework.name,
    database: config.database?.name ?? null,
    auth: config.auth?.name ?? null
  };
}

async function generateFrameworkFiles(
  projectDir: string,
  config: ProjectConfig,
  context: GenerationContext
): Promise<void> {
  const srcDir = path.join(projectDir, 'src');
  await fs.mkdir(srcDir, { recursive: true });

  // Generate entry file based on framework
  const entryContent = generateEntryFile(config, context);
  await fs.writeFile(path.join(srcDir, 'index.ts'), entryContent);
}

async function generateDatabaseFiles(
  projectDir: string,
  config: ProjectConfig,
  context: GenerationContext
): Promise<void> {
  if (!config.database) return;

  if (config.database.name === 'prisma') {
    // Create prisma directory and schema
    const prismaDir = path.join(projectDir, 'prisma');
    await fs.mkdir(prismaDir, { recursive: true });
    await fs.writeFile(path.join(prismaDir, 'schema.prisma'), prismaSchemaTemplate);
  } else if (config.database.name === 'drizzle') {
    // Create db directory with schema and client
    const dbDir = path.join(projectDir, 'src', 'db');
    await fs.mkdir(dbDir, { recursive: true });
    await fs.writeFile(path.join(dbDir, 'schema.ts'), drizzleSchemaTemplate);
    await fs.writeFile(path.join(dbDir, 'index.ts'), drizzleClientTemplate);

    // Create drizzle config at root
    await fs.writeFile(path.join(projectDir, 'drizzle.config.ts'), drizzleConfigTemplate);
  }
}

async function generateAuthFiles(
  projectDir: string,
  config: ProjectConfig,
  context: GenerationContext
): Promise<void> {
  if (!config.auth) return;

  // Create lib directory
  const libDir = path.join(projectDir, 'src', 'lib');
  await fs.mkdir(libDir, { recursive: true });

  if (config.auth.name === 'better-auth') {
    // Generate Better Auth config based on database
    const authTemplate = config.database?.name === 'drizzle'
      ? betterAuthDrizzleTemplate
      : betterAuthPrismaTemplate;
    await fs.writeFile(path.join(libDir, 'auth.ts'), authTemplate);
  } else if (config.auth.name === 'passport') {
    await fs.writeFile(path.join(libDir, 'passport.ts'), passportConfigTemplate);
  }
}

function generateEntryFile(config: ProjectConfig, context: GenerationContext): string {
  const envLoadSnippet = config.runtime.getEnvLoadingStrategy().loadSnippet;

  switch (config.framework.name) {
    case 'hono':
      return generateHonoEntry(config, context, envLoadSnippet);
    case 'express':
      return generateExpressEntry(config, context, envLoadSnippet);
    case 'fastify':
      return generateFastifyEntry(config, context, envLoadSnippet);
    default:
      throw new Error(`Unknown framework: ${config.framework.name}`);
  }
}

function generateHonoEntry(
  config: ProjectConfig,
  context: GenerationContext,
  envLoadSnippet: string | null
): string {
  const imports: string[] = [];

  if (envLoadSnippet) {
    imports.push(envLoadSnippet);
  }

  imports.push("import { Hono } from 'hono';");

  if (config.runtime.name === 'node') {
    imports.push("import { serve } from '@hono/node-server';");
  }

  if (config.features.cors) {
    imports.push("import { cors } from 'hono/cors';");
  }

  if (config.features.logging) {
    imports.push("import { logger } from 'hono/logger';");
  }

  // Add auth imports
  if (config.auth?.name === 'better-auth') {
    imports.push("import { auth } from './lib/auth.js';");
  }

  let middleware = '';
  if (config.features.cors) {
    middleware += "\napp.use('*', cors());";
  }
  if (config.features.logging) {
    middleware += "\napp.use('*', logger());";
  }

  // Add auth route
  let authRoute = '';
  if (config.auth?.name === 'better-auth') {
    authRoute = "\n\n// Auth routes\napp.on(['POST', 'GET'], '/api/auth/*', (c) => auth.handler(c.req.raw));";
  }

  const healthRoute = config.features.healthCheck
    ? "\n\napp.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));"
    : '';

  const serverSetup = config.runtime.name === 'node'
    ? `
const port = Number(process.env.PORT) || 3000;

serve({
  fetch: app.fetch,
  port
}, (info) => {
  console.log(\`Server running at http://localhost:\${info.port}\`);
});`
    : `
const port = Number(process.env.PORT) || 3000;

export default {
  port,
  fetch: app.fetch
};

console.log(\`Server running at http://localhost:\${port}\`);`;

  return `${imports.join('\n')}

const app = new Hono();
${middleware}

app.get('/', (c) => {
  return c.json({
    message: 'Welcome to ${context.projectName}',
    framework: 'Hono',
    runtime: '${config.runtime.displayName}'
  });
});${authRoute}${healthRoute}
${serverSetup}
`;
}

function generateExpressEntry(
  config: ProjectConfig,
  context: GenerationContext,
  envLoadSnippet: string | null
): string {
  const imports: string[] = [];

  if (envLoadSnippet) {
    imports.push(envLoadSnippet);
  }

  imports.push("import express from 'express';");

  if (config.features.cors) {
    imports.push("import cors from 'cors';");
  }

  if (config.features.logging) {
    imports.push("import morgan from 'morgan';");
  }

  // Add auth imports
  if (config.auth?.name === 'better-auth') {
    imports.push("import { toNodeHandler } from 'better-auth/node';");
    imports.push("import { auth } from './lib/auth.js';");
  } else if (config.auth?.name === 'passport') {
    imports.push("import passport from 'passport';");
    imports.push("import session from 'express-session';");
    imports.push("import './lib/passport.js';");
  }

  let middleware = '\napp.use(express.json());';
  if (config.features.cors) {
    middleware += '\napp.use(cors());';
  }
  if (config.features.logging) {
    middleware += "\napp.use(morgan('dev'));";
  }

  // Add auth middleware
  if (config.auth?.name === 'passport') {
    middleware += `\napp.use(session({
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());`;
  }

  // Add auth route
  let authRoute = '';
  if (config.auth?.name === 'better-auth') {
    authRoute = "\n\n// Auth routes - must be before express.json()\napp.all('/api/auth/*', toNodeHandler(auth));";
  }

  const healthRoute = config.features.healthCheck
    ? "\n\napp.get('/health', (req, res) => {\n  res.json({ status: 'ok', timestamp: new Date().toISOString() });\n});"
    : '';

  return `${imports.join('\n')}

const app = express();
const port = Number(process.env.PORT) || 3000;
${middleware}${authRoute}

app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to ${context.projectName}',
    framework: 'Express',
    runtime: '${config.runtime.displayName}'
  });
});${healthRoute}

app.listen(port, () => {
  console.log(\`Server running at http://localhost:\${port}\`);
});
`;
}

function generateFastifyEntry(
  config: ProjectConfig,
  context: GenerationContext,
  envLoadSnippet: string | null
): string {
  const imports: string[] = [];

  if (envLoadSnippet) {
    imports.push(envLoadSnippet);
  }

  imports.push("import Fastify from 'fastify';");

  if (config.features.cors) {
    imports.push("import cors from '@fastify/cors';");
  }

  // Add auth imports
  if (config.auth?.name === 'better-auth') {
    imports.push("import { auth } from './lib/auth.js';");
  }

  let middleware = '';
  if (config.features.cors) {
    middleware = '\n    await fastify.register(cors, { origin: true });';
  }

  // Add auth route
  let authRoute = '';
  if (config.auth?.name === 'better-auth') {
    authRoute = `\n\n    // Auth routes
    fastify.all('/api/auth/*', async (request, reply) => {
      return auth.handler(request.raw);
    });`;
  }

  const healthRoute = config.features.healthCheck
    ? "\n\n    fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));"
    : '';

  return `${imports.join('\n')}

const fastify = Fastify({
  logger: ${config.features.logging}
});

const port = Number(process.env.PORT) || 3000;

async function start() {
  try {${middleware}

    fastify.get('/', async () => ({
      message: 'Welcome to ${context.projectName}',
      framework: 'Fastify',
      runtime: '${config.runtime.displayName}'
    }));${authRoute}${healthRoute}

    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(\`Server running at http://localhost:\${port}\`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
`;
}

async function generateSharedFiles(
  projectDir: string,
  config: ProjectConfig,
  context: GenerationContext
): Promise<void> {
  // Build project structure for README
  let structure = `${context.projectName}/
├── src/
│   └── index.ts    # Application entry point`;

  if (config.database?.name === 'drizzle') {
    structure += `
│   └── db/
│       ├── index.ts   # Database client
│       └── schema.ts  # Database schema`;
  }

  if (config.auth) {
    structure += `
│   └── lib/
│       └── auth.ts    # Auth configuration`;
  }

  if (config.database?.name === 'prisma') {
    structure += `
├── prisma/
│   └── schema.prisma  # Prisma schema`;
  }

  structure += `
├── .env            # Environment variables
├── .env.example    # Example environment file
├── package.json
└── tsconfig.json`;

  // Generate README
  const readme = `# ${context.projectName}

A ${config.framework.displayName} application running on ${config.runtime.displayName}.
${config.database ? `\n**Database:** ${config.database.displayName}` : ''}
${config.auth ? `**Auth:** ${config.auth.displayName}` : ''}

## Getting Started

### Install dependencies

\`\`\`bash
${config.runtime.getInstallCommand([])}
\`\`\`
${config.database?.name === 'prisma' ? `
### Setup Database (Prisma)

\`\`\`bash
# Generate Prisma client
${config.runtime.getRunCommand('db:generate')}

# Push schema to database
${config.runtime.getRunCommand('db:push')}
\`\`\`
` : ''}${config.database?.name === 'drizzle' ? `
### Setup Database (Drizzle)

\`\`\`bash
# Push schema to database
${config.runtime.getRunCommand('db:push')}
\`\`\`
` : ''}
### Development

\`\`\`bash
${config.runtime.getRunCommand('dev')}
\`\`\`

### Production

\`\`\`bash
${config.runtime.getRunCommand('start')}
\`\`\`

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
${context.envVars.map(v => `| \`${v.key}\` | ${v.description || ''} | \`${v.value}\` |`).join('\n')}

## Project Structure

\`\`\`
${structure}
\`\`\`

## Built with

- [${config.framework.displayName}](https://${config.framework.name === 'hono' ? 'hono.dev' : config.framework.name === 'fastify' ? 'fastify.dev' : 'expressjs.com'})
- [${config.runtime.displayName}](https://${config.runtime.name === 'bun' ? 'bun.sh' : 'nodejs.org'})
- [TypeScript](https://www.typescriptlang.org/)
${config.database ? `- [${config.database.displayName}](https://${config.database.name === 'prisma' ? 'www.prisma.io' : 'orm.drizzle.team'})` : ''}
${config.auth ? `- [${config.auth.displayName}](https://${config.auth.name === 'better-auth' ? 'www.better-auth.com' : 'www.passportjs.org'})` : ''}
`;

  await fs.writeFile(path.join(projectDir, 'README.md'), readme);
}

async function generatePackageJson(
  projectDir: string,
  config: ProjectConfig,
  context: GenerationContext
): Promise<void> {
  const packageJson = {
    name: context.projectName,
    version: '0.1.0',
    type: 'module',
    scripts: context.scripts,
    dependencies: Object.fromEntries(
      context.deps.map(d => [d.name, d.version])
    ),
    devDependencies: Object.fromEntries(
      context.devDeps.map(d => [d.name, d.version])
    )
  };

  await fs.writeFile(
    path.join(projectDir, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );
}

async function generateTsConfig(projectDir: string): Promise<void> {
  const tsConfig = {
    compilerOptions: {
      target: 'ES2022',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      outDir: 'dist',
      rootDir: 'src',
      declaration: true
    },
    include: ['src/**/*'],
    exclude: ['node_modules', 'dist']
  };

  await fs.writeFile(
    path.join(projectDir, 'tsconfig.json'),
    JSON.stringify(tsConfig, null, 2)
  );
}

async function generateEnvFiles(
  projectDir: string,
  context: GenerationContext
): Promise<void> {
  const envContent = context.envVars
    .map(v => `${v.key}=${v.value}`)
    .join('\n');

  const envExampleContent = context.envVars
    .map(v => `# ${v.description || v.key}\n${v.key}=${v.value}`)
    .join('\n\n');

  await fs.writeFile(path.join(projectDir, '.env'), envContent);
  await fs.writeFile(path.join(projectDir, '.env.example'), envExampleContent);
}

async function generateDockerfile(
  projectDir: string,
  config: ProjectConfig,
  context: GenerationContext
): Promise<void> {
  let dockerfile: string;

  if (config.runtime.name === 'bun') {
    dockerfile = `FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile
${config.database?.name === 'prisma' ? '\n# Generate Prisma client\nCOPY prisma ./prisma\nRUN bunx prisma generate' : ''}

# Copy source
COPY . .

# Expose port
EXPOSE 3000

# Start the application
CMD ["bun", "src/index.ts"]
`;
  } else {
    dockerfile = `FROM node:22-alpine AS base
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --only=production
${config.database?.name === 'prisma' ? '\n# Generate Prisma client\nCOPY prisma ./prisma\nRUN npx prisma generate' : ''}

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "dist/index.js"]
`;
  }

  await fs.writeFile(path.join(projectDir, 'Dockerfile'), dockerfile);

  // Generate .dockerignore
  const dockerignore = `node_modules
dist
.env
.git
*.log
${config.database?.name === 'drizzle' ? 'drizzle/' : ''}
`;

  await fs.writeFile(path.join(projectDir, '.dockerignore'), dockerignore);
}

async function generateGitignore(
  projectDir: string,
  config: ProjectConfig
): Promise<void> {
  const gitignore = `# Dependencies
node_modules/

# Build output
dist/

# Environment files
.env
.env.local
.env.*.local

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*

# Database
${config.database?.name === 'drizzle' ? 'drizzle/' : ''}
${config.database?.name === 'prisma' ? 'prisma/migrations/' : ''}

# Runtime files
${config.runtime.name === 'bun' ? 'bun.lockb' : 'package-lock.json'}
`;

  await fs.writeFile(path.join(projectDir, '.gitignore'), gitignore);
}

async function generateEslintConfig(projectDir: string): Promise<void> {
  const eslintConfig = `import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['dist/', 'node_modules/']
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn'
    }
  }
);
`;

  await fs.writeFile(path.join(projectDir, 'eslint.config.js'), eslintConfig);
}
