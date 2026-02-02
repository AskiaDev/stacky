#!/usr/bin/env node

import * as p from '@clack/prompts';
import { Command } from 'commander';
import pc from 'picocolors';
import { spawn } from 'node:child_process';
import { registry, getFramework, getRuntime, getDatabase, getAuth, getCompatibleAuth } from '../core/registry.js';
import { generateProject } from '../core/generator.js';
import type { ProjectConfig, DatabasePlugin, AuthPlugin, RuntimeAdapter } from '../core/types.js';

const program = new Command();
const isTTY = process.stdout.isTTY;

// Helper functions for TTY-safe output
function showIntro() {
  if (isTTY) {
    console.clear();
    p.intro(pc.bgCyan(pc.black(' stacky ')));
  } else {
    console.log('stacky - Framework-agnostic CLI scaffolding tool\n');
  }
}

function showError(message: string) {
  if (isTTY) {
    p.cancel(message);
  } else {
    console.error(`Error: ${message}`);
  }
}

function showNote(content: string, title: string) {
  if (isTTY) {
    p.note(content, title);
  } else {
    console.log(`\n${title}:\n${content}\n`);
  }
}

function showOutro(message: string) {
  if (isTTY) {
    p.outro(pc.green(message));
  } else {
    console.log(message);
  }
}

function showWarn(message: string) {
  if (isTTY) {
    p.log.warn(message);
  } else {
    console.warn(`Warning: ${message}`);
  }
}

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
  .option('-i, --install', 'Install dependencies after creation')
  .option('--no-docker', 'Skip Docker configuration')
  .option('--no-cors', 'Skip CORS middleware')
  .option('--no-logging', 'Skip logging middleware')
  .option('--no-health', 'Skip health check endpoint')
  .action(async (name, _options, cmd) => {
    await runCreate(name, cmd.optsWithGlobals());
  });

// Default command (no subcommand) runs create
program
  .argument('[name]', 'Project name')
  .option('-f, --framework <framework>', 'Framework (hono, express, fastify)')
  .option('-r, --runtime <runtime>', 'Runtime (node, bun)')
  .option('-d, --database <database>', 'Database (prisma, drizzle)')
  .option('-a, --auth <auth>', 'Auth (better-auth, passport)')
  .option('-i, --install', 'Install dependencies after creation')
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
    install?: boolean;
    docker?: boolean;
    cors?: boolean;
    logging?: boolean;
    health?: boolean;
  }
) {
  // Check if we have all required options from CLI flags
  const hasAllFlags = projectName && options.framework && options.runtime;

  showIntro();

  let config: {
    name: string;
    framework: string;
    runtime: string;
    database: string | null;
    auth: string | null;
    install: boolean;
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
      install: options.install ?? false,
      docker: options.docker ?? true,
      cors: options.cors ?? true,
      logging: options.logging ?? true,
      health: options.health ?? true
    };
  } else {
    // Interactive mode requires TTY
    if (!isTTY) {
      showError('Interactive mode requires a TTY. Use flags: stacky <name> -f <framework> -r <runtime>');
      process.exit(1);
    }

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
          }),

        install: () =>
          p.confirm({
            message: 'Install dependencies after creation?',
            initialValue: true
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
    const install = answers.install as boolean;

    config = {
      name: answers.name as string,
      framework: answers.framework as string,
      runtime: answers.runtime as string,
      database: database === 'none' ? null : database,
      auth: auth === 'none' ? null : auth,
      install,
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
    showError(`Unknown framework: ${config.framework}`);
    process.exit(1);
  }

  if (!runtime) {
    showError(`Unknown runtime: ${config.runtime}`);
    process.exit(1);
  }

  // Check compatibility
  if (!framework.manifest.compatible.runtimes.includes(runtime.name)) {
    showError(`${framework.displayName} is not compatible with ${runtime.displayName}`);
    process.exit(1);
  }

  // Get database plugin
  let databasePlugin: DatabasePlugin | null = null;
  if (config.database) {
    databasePlugin = getDatabase(config.database) || null;
    if (!databasePlugin) {
      showError(`Unknown database: ${config.database}`);
      process.exit(1);
    }
  }

  // Get auth plugin
  let authPlugin: AuthPlugin | null = null;
  if (config.auth) {
    // Auth requires database
    if (!databasePlugin) {
      showError('Authentication requires a database. Please select a database first.');
      process.exit(1);
    }

    authPlugin = getAuth(config.auth) || null;
    if (!authPlugin) {
      showError(`Unknown auth: ${config.auth}`);
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
  if (isTTY) {
    const s = p.spinner();
    s.start('Creating your project...');

    try {
      await generateProject(projectConfig);
      s.stop('Project created successfully!');
    } catch (error) {
      s.stop('Failed to create project');
      showError(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  } else {
    console.log('Creating your project...');
    try {
      await generateProject(projectConfig);
      console.log('Project created successfully!');
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }

  // Install dependencies if requested
  if (config.install) {
    if (isTTY) {
      const installSpinner = p.spinner();
      installSpinner.start('Installing dependencies...');

      try {
        await runInstall(config.name, runtime);
        installSpinner.stop('Dependencies installed!');
      } catch (error) {
        installSpinner.stop('Failed to install dependencies');
        showWarn('You can install manually with: ' + runtime.getInstallCommand([]));
      }
    } else {
      console.log('Installing dependencies...');
      try {
        await runInstall(config.name, runtime);
        console.log('Dependencies installed!');
      } catch (error) {
        showWarn('You can install manually with: ' + runtime.getInstallCommand([]));
      }
    }
  }

  // Build next steps
  let nextSteps = `cd ${config.name}`;

  if (!config.install) {
    nextSteps += `\n${runtime.getInstallCommand([])}`
  }

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
  showNote(nextSteps, 'Next steps');
  showOutro('Happy coding!');
}

async function runInstall(projectDir: string, runtime: RuntimeAdapter): Promise<void> {
  return new Promise((resolve, reject) => {
    const cmd = runtime.name === 'bun' ? 'bun' : 'npm';
    const args = ['install'];

    const child = spawn(cmd, args, {
      cwd: projectDir,
      stdio: 'pipe'
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Install failed with code ${code}`));
      }
    });

    child.on('error', reject);
  });
}

program.parse();
