#!/usr/bin/env node

import * as p from '@clack/prompts';
import { Command } from 'commander';
import pc from 'picocolors';
import { registry, getFramework, getRuntime, getDatabase, getAuth, getCompatibleAuth } from '../core/registry.js';
import { generateProject } from '../core/generator.js';
import type { ProjectConfig, DatabasePlugin, AuthPlugin } from '../core/types.js';

const program = new Command();

program
  .name('stacky')
  .description('Framework-agnostic CLI scaffolding tool')
  .version('0.1.0');

program
  .command('create')
  .description('Create a new project')
  .argument('[name]', 'Project name')
  .option('-f, --framework <framework>', 'Framework (hono, express, fastify)')
  .option('-r, --runtime <runtime>', 'Runtime (node, bun)')
  .option('-d, --database <database>', 'Database (prisma, drizzle)')
  .option('-a, --auth <auth>', 'Auth (better-auth, passport)')
  .option('--no-docker', 'Skip Docker configuration')
  .option('--no-cors', 'Skip CORS middleware')
  .option('--no-logging', 'Skip logging middleware')
  .option('--no-health', 'Skip health check endpoint')
  .action(async (name, options) => {
    await runCreate(name, options);
  });

// Default command (no subcommand) runs create
program
  .argument('[name]', 'Project name')
  .option('-f, --framework <framework>', 'Framework (hono, express, fastify)')
  .option('-r, --runtime <runtime>', 'Runtime (node, bun)')
  .option('-d, --database <database>', 'Database (prisma, drizzle)')
  .option('-a, --auth <auth>', 'Auth (better-auth, passport)')
  .option('--no-docker', 'Skip Docker configuration')
  .option('--no-cors', 'Skip CORS middleware')
  .option('--no-logging', 'Skip logging middleware')
  .option('--no-health', 'Skip health check endpoint')
  .action(async (name, options) => {
    if (name && !name.startsWith('-')) {
      await runCreate(name, options);
    } else {
      await runCreate(undefined, options);
    }
  });

async function runCreate(
  projectName: string | undefined,
  options: {
    framework?: string;
    runtime?: string;
    database?: string;
    auth?: string;
    docker?: boolean;
    cors?: boolean;
    logging?: boolean;
    health?: boolean;
  }
) {
  console.clear();

  p.intro(pc.bgCyan(pc.black(' stacky ')));

  // Check if we have all required options from CLI flags
  const hasAllFlags = projectName && options.framework && options.runtime;

  let config: {
    name: string;
    framework: string;
    runtime: string;
    database: string | null;
    auth: string | null;
    docker: boolean;
    cors: boolean;
    logging: boolean;
    health: boolean;
  };

  if (hasAllFlags) {
    // Non-interactive mode
    config = {
      name: projectName,
      framework: options.framework!,
      runtime: options.runtime!,
      database: options.database || null,
      auth: options.auth || null,
      docker: options.docker ?? true,
      cors: options.cors ?? true,
      logging: options.logging ?? true,
      health: options.health ?? true
    };
  } else {
    // Interactive mode
    const answers = await p.group(
      {
        name: () =>
          p.text({
            message: 'What is your project name?',
            placeholder: 'my-app',
            initialValue: projectName || '',
            validate: (value) => {
              if (!value) return 'Project name is required';
              if (!/^[a-z0-9-]+$/.test(value)) {
                return 'Project name can only contain lowercase letters, numbers, and dashes';
              }
            }
          }),

        framework: () =>
          p.select({
            message: 'Which framework would you like to use?',
            initialValue: options.framework || 'hono',
            options: registry.frameworks.map((f) => ({
              value: f.name,
              label: f.displayName,
              hint: f.name === 'hono' ? 'recommended' : undefined
            }))
          }),

        runtime: () =>
          p.select({
            message: 'Which runtime would you like to use?',
            initialValue: options.runtime || 'node',
            options: registry.runtimes.map((r) => ({
              value: r.name,
              label: r.displayName,
              hint: r.name === 'bun' ? 'faster' : 'stable'
            }))
          }),

        database: () =>
          p.select({
            message: 'Which database ORM would you like to use?',
            initialValue: options.database || 'none',
            options: [
              { value: 'none', label: 'None', hint: 'skip database setup' },
              ...registry.databases.map((d) => ({
                value: d.name,
                label: d.displayName,
                hint: d.name === 'drizzle' ? 'lightweight' : 'full-featured'
              }))
            ]
          }),

        auth: ({ results }) => {
          const framework = getFramework(results.framework as string);
          const dbSelected = results.database !== 'none';

          // Auth requires a database
          if (!dbSelected) {
            return Promise.resolve('none');
          }

          const compatibleAuth = framework ? getCompatibleAuth(framework) : registry.auth;

          return p.select({
            message: 'Which authentication would you like to use?',
            initialValue: options.auth || 'none',
            options: [
              { value: 'none', label: 'None', hint: 'skip auth setup' },
              ...compatibleAuth.map((a) => ({
                value: a.name,
                label: a.displayName,
                hint: a.name === 'better-auth' ? 'modern, recommended' : 'classic, flexible'
              }))
            ]
          });
        },

        features: () =>
          p.multiselect({
            message: 'Select features to include:',
            initialValues: ['docker', 'cors', 'logging', 'health'],
            options: [
              { value: 'docker', label: 'Docker', hint: 'Dockerfile + .dockerignore' },
              { value: 'cors', label: 'CORS', hint: 'Cross-origin resource sharing' },
              { value: 'logging', label: 'Logging', hint: 'Request logging middleware' },
              { value: 'health', label: 'Health Check', hint: '/health endpoint' }
            ]
          })
      },
      {
        onCancel: () => {
          p.cancel('Operation cancelled.');
          process.exit(0);
        }
      }
    );

    const features = answers.features as string[];
    const database = answers.database as string;
    const auth = answers.auth as string;

    config = {
      name: answers.name as string,
      framework: answers.framework as string,
      runtime: answers.runtime as string,
      database: database === 'none' ? null : database,
      auth: auth === 'none' ? null : auth,
      docker: features.includes('docker'),
      cors: features.includes('cors'),
      logging: features.includes('logging'),
      health: features.includes('health')
    };
  }

  // Validate selections
  const framework = getFramework(config.framework);
  const runtime = getRuntime(config.runtime);

  if (!framework) {
    p.cancel(`Unknown framework: ${config.framework}`);
    process.exit(1);
  }

  if (!runtime) {
    p.cancel(`Unknown runtime: ${config.runtime}`);
    process.exit(1);
  }

  // Check compatibility
  if (!framework.manifest.compatible.runtimes.includes(runtime.name)) {
    p.cancel(`${framework.displayName} is not compatible with ${runtime.displayName}`);
    process.exit(1);
  }

  // Get database plugin
  let databasePlugin: DatabasePlugin | null = null;
  if (config.database) {
    databasePlugin = getDatabase(config.database) || null;
    if (!databasePlugin) {
      p.cancel(`Unknown database: ${config.database}`);
      process.exit(1);
    }
  }

  // Get auth plugin
  let authPlugin: AuthPlugin | null = null;
  if (config.auth) {
    // Auth requires database
    if (!databasePlugin) {
      p.cancel('Authentication requires a database. Please select a database first.');
      process.exit(1);
    }

    authPlugin = getAuth(config.auth) || null;
    if (!authPlugin) {
      p.cancel(`Unknown auth: ${config.auth}`);
      process.exit(1);
    }
  }

  // Build project config
  const projectConfig: ProjectConfig = {
    name: config.name,
    directory: config.name,
    framework,
    runtime,
    auth: authPlugin,
    database: databasePlugin,
    features: {
      docker: config.docker,
      cors: config.cors,
      logging: config.logging,
      healthCheck: config.health
    }
  };

  // Generate project
  const s = p.spinner();
  s.start('Creating your project...');

  try {
    await generateProject(projectConfig);
    s.stop('Project created successfully!');
  } catch (error) {
    s.stop('Failed to create project');
    p.cancel(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }

  // Build next steps
  let nextSteps = `cd ${config.name}\n${runtime.getInstallCommand([])}`;

  if (databasePlugin) {
    nextSteps += `\n\n# Setup database`;
    if (config.database === 'prisma') {
      nextSteps += `\n${runtime.getRunCommand('db:push')}`;
    } else if (config.database === 'drizzle') {
      nextSteps += `\n${runtime.getRunCommand('db:push')}`;
    }
  }

  nextSteps += `\n\n# Start development\n${runtime.getRunCommand('dev')}`;

  // Success message
  p.note(nextSteps, 'Next steps');

  p.outro(pc.green('Happy coding!'));
}

program.parse();
