# Framework-Agnostic CLI Scaffolding Tool

## Architecture Specification

**Project:** Stacky
**Version:** 1.0
**Date:** 2026-02-03

---

## Table of Contents

1. [Overview](#overview)
2. [Design Decisions](#design-decisions)
3. [Core Architecture & Plugin Interface](#core-architecture--plugin-interface)
4. [Runtime Abstraction Layer](#runtime-abstraction-layer)
5. [Capabilities Manifest System](#capabilities-manifest-system)
6. [Folder Structure](#folder-structure)
7. [Adapter Layer](#adapter-layer)
8. [Module Interaction Diagram](#module-interaction-diagram)
9. [Complete Type Definitions](#complete-type-definitions)
10. [How to Add a New Framework in 3 Steps](#how-to-add-a-new-framework-in-3-steps)

---

## Overview

Stacky is a framework-agnostic CLI scaffolding tool designed for extreme modularity and extensibility using the Strategy Pattern. It generates production-ready backend projects with configurable frameworks, runtimes, authentication, and database integrations.

**Key Principles:**
- **Open/Closed Principle:** Add new frameworks by adding files, not modifying core
- **Strategy Pattern:** Interchangeable plugins for frameworks, runtimes, auth, databases
- **Separation of Concerns:** Logic isolated from templates
- **Capability-Based Compatibility:** Automatic detection of valid plugin combinations

---

## Design Decisions

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| **Interaction** | Interactive wizard + CLI flags | Best DX: exploration for new users, automation for power users |
| **Frameworks** | Hono, Express, Fastify | Moderate range validates architecture without over-engineering |
| **Runtimes** | Node, Bun | Covers 95% of use cases, similar enough for clean abstraction |
| **Auth** | Passport, Better-Auth | Focused scope, different patterns (middleware vs integrated) |
| **Databases** | Prisma, Drizzle | ORM-focused for cleaner plugin boundaries |
| **Output** | Production-ready | Env handling, Docker, middleware, health endpoint |
| **CLI Stack** | Node + Clack | Beautiful interactive UX, lightweight |
| **Templates** | Hybrid (static + EJS) | Simple files stay clean, complex files get templating |
| **Plugins** | Bundled, designed for external | Simple now, extensible later |

---

## Core Architecture & Plugin Interface

The system follows the **Strategy Pattern** with a central orchestrator that delegates to interchangeable plugins.

```
┌─────────────────────────────────────────────────────────┐
│                      CLI Layer                          │
│   (Clack prompts + argument parser)                     │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│                   Orchestrator                          │
│   - Loads plugins from registry                         │
│   - Validates compatibility via manifests               │
│   - Delegates to adapters                               │
└───────┬─────────────────┬─────────────────┬─────────────┘
        │                 │                 │
        ▼                 ▼                 ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│ FrameworkPlugin│ │ RuntimeAdapter│ │CapabilityPlugin│
│  (Strategy)    │   (Strategy)  │ │   (Strategy)   │
└───────────────┘ └───────────────┘ └───────────────┘
```

### Plugin Interface Contract

```typescript
interface FrameworkPlugin {
  readonly name: string;           // 'hono' | 'express' | 'fastify'
  readonly displayName: string;    // 'Hono'
  readonly manifest: CapabilityManifest;

  // Lifecycle hooks
  getTemplateContext(config: ProjectConfig): TemplateContext;
  getDependencies(config: ProjectConfig): Dependencies;
  getScripts(runtime: RuntimeAdapter): Scripts;

  // Optional customization points
  postGenerate?(ctx: GenerationContext): Promise<void>;
}
```

Each framework implements this interface. Adding a new framework means creating one file that satisfies the contract.

---

## Runtime Abstraction Layer

The runtime layer abstracts execution differences between Node and Bun through a **RuntimeAdapter** interface.

### RuntimeAdapter Interface

```typescript
interface RuntimeAdapter {
  readonly name: 'node' | 'bun';
  readonly displayName: string;

  // Package management
  getInstallCommand(deps: string[]): string;
  getDevInstallCommand(deps: string[]): string;
  getLockfileName(): string;

  // Execution
  getRunCommand(script: string): string;
  getExecutable(): string;

  // Environment
  getEnvLoadingStrategy(): EnvStrategy;
  getRuntimeSpecificDeps(): Dependencies;

  // Config files
  getConfigFiles(): StaticFile[];
}
```

### Node Adapter Implementation

```typescript
export const NodeAdapter: RuntimeAdapter = {
  name: 'node',
  displayName: 'Node.js',

  getInstallCommand: (deps) => `npm install ${deps.join(' ')}`,
  getLockfileName: () => 'package-lock.json',
  getRunCommand: (script) => `npm run ${script}`,
  getExecutable: () => 'node',

  getEnvLoadingStrategy: () => ({
    package: 'dotenv',
    loadSnippet: "import 'dotenv/config';"
  }),

  getRuntimeSpecificDeps: () => ({
    dev: ['@types/node', 'tsx']
  }),

  getConfigFiles: () => []
};
```

### Bun Adapter Implementation

```typescript
export const BunAdapter: RuntimeAdapter = {
  name: 'bun',
  displayName: 'Bun',

  getInstallCommand: (deps) => `bun add ${deps.join(' ')}`,
  getLockfileName: () => 'bun.lockb',
  getRunCommand: (script) => `bun run ${script}`,
  getExecutable: () => 'bun',

  getEnvLoadingStrategy: () => ({
    package: null,  // Bun loads .env automatically
    loadSnippet: null
  }),

  getRuntimeSpecificDeps: () => ({
    dev: ['@types/bun']
  }),

  getConfigFiles: () => [{
    path: 'bunfig.toml',
    template: 'bunfig.toml'
  }]
};
```

The orchestrator injects the selected runtime adapter into framework plugins, keeping frameworks runtime-agnostic.

---

## Capabilities Manifest System

Each plugin declares what it supports. The CLI uses these manifests to filter options and validate combinations.

### Manifest Interface

```typescript
interface CapabilityManifest {
  // What this plugin provides
  provides: {
    type: 'framework' | 'auth' | 'database';
    features: string[];  // ['middleware', 'routing', 'websockets']
  };

  // Compatibility constraints
  compatible: {
    runtimes: ('node' | 'bun')[];
    auth: string[];       // ['passport', 'better-auth'] or '*'
    databases: string[];  // ['prisma', 'drizzle'] or '*'
  };

  // What this plugin requires from others
  requires?: {
    features?: string[];  // e.g., ['middleware'] for auth plugins
  };
}
```

### Example: Hono Plugin Manifest

```typescript
export const manifest: CapabilityManifest = {
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
```

### Example: Better-Auth Manifest (with constraint)

```typescript
export const manifest: CapabilityManifest = {
  provides: {
    type: 'auth',
    features: ['session', 'oauth', 'magic-link']
  },
  compatible: {
    runtimes: ['node', 'bun'],
    auth: ['*'],
    databases: ['prisma', 'drizzle']  // Better-Auth needs an ORM
  },
  requires: {
    features: ['middleware']  // Needs framework middleware support
  }
};
```

### Compatibility Resolution

```typescript
function getCompatibleOptions(
  selectedFramework: FrameworkPlugin,
  registry: PluginRegistry
): { auth: AuthPlugin[]; databases: DatabasePlugin[] } {
  const frameworkManifest = selectedFramework.manifest;

  return {
    auth: registry.auth.filter(auth =>
      intersects(frameworkManifest.compatible.auth, [auth.name, '*']) &&
      auth.manifest.requires?.features?.every(f =>
        frameworkManifest.provides.features.includes(f)
      )
    ),
    databases: registry.databases.filter(db =>
      intersects(frameworkManifest.compatible.databases, [db.name, '*'])
    )
  };
}
```

The CLI dynamically shows only valid combinations during the interactive flow.

---

## Folder Structure

The project structure enforces strict separation between orchestration logic, plugin implementations, and template assets.

```
stacky/
├── src/
│   ├── cli/                      # CLI Layer
│   │   ├── index.ts              # Entry point
│   │   ├── prompts.ts            # Clack interactive flows
│   │   └── args.ts               # Flag parsing
│   │
│   ├── core/                     # Orchestration (framework-agnostic)
│   │   ├── orchestrator.ts       # Main coordination logic
│   │   ├── registry.ts           # Plugin discovery & loading
│   │   ├── resolver.ts           # Compatibility resolution
│   │   └── generator.ts          # File generation engine
│   │
│   ├── adapters/                 # Adapter Layer
│   │   ├── runtime/
│   │   │   ├── types.ts          # RuntimeAdapter interface
│   │   │   ├── node.ts
│   │   │   └── bun.ts
│   │   └── env/
│   │       └── normalizer.ts     # Cross-tech env injection
│   │
│   ├── plugins/                  # Plugin Implementations
│   │   ├── types.ts              # Shared interfaces
│   │   ├── frameworks/
│   │   │   ├── hono/
│   │   │   │   ├── index.ts      # Plugin implementation
│   │   │   │   └── manifest.ts   # Capability manifest
│   │   │   ├── express/
│   │   │   └── fastify/
│   │   ├── auth/
│   │   │   ├── passport/
│   │   │   └── better-auth/
│   │   └── databases/
│   │       ├── prisma/
│   │       └── drizzle/
│   │
│   └── utils/                    # Shared utilities
│       ├── fs.ts
│       └── template.ts           # EJS rendering wrapper
│
├── templates/                    # Template Assets (ISOLATED)
│   ├── shared/                   # Cross-framework static files
│   │   ├── .gitignore
│   │   ├── .env.example
│   │   ├── Dockerfile.ejs
│   │   └── README.md.ejs
│   │
│   ├── frameworks/
│   │   ├── hono/
│   │   │   ├── static/           # Copy as-is
│   │   │   │   └── tsconfig.json
│   │   │   └── dynamic/          # EJS templates
│   │   │       ├── src/
│   │   │       │   └── index.ts.ejs
│   │   │       └── package.json.ejs
│   │   ├── express/
│   │   └── fastify/
│   │
│   ├── auth/
│   │   ├── passport/
│   │   └── better-auth/
│   │
│   └── databases/
│       ├── prisma/
│       │   └── schema.prisma.ejs
│       └── drizzle/
│
└── package.json
```

### Key Principles

- `src/plugins/` contains **logic only** (TypeScript)
- `templates/` contains **assets only** (static files + EJS)
- Plugin index.ts references templates by path, never embeds content
- `shared/` templates are composed by the generator, not duplicated

---

## Adapter Layer

The adapter layer provides a uniform interface for operations that vary across technologies. Each "concern" gets a normalizer.

### Environment Normalizer

```typescript
interface EnvNormalizer {
  getEnvFiles(config: ProjectConfig): FileOutput[];
  getLoadSnippet(runtime: RuntimeAdapter, framework: FrameworkPlugin): string;
  getEnvType(): string;  // TypeScript env declaration
}

export const envNormalizer: EnvNormalizer = {
  getEnvFiles(config) {
    const vars = this.collectEnvVars(config);
    return [
      { path: '.env.example', content: this.formatEnvExample(vars) },
      { path: '.env', content: this.formatEnvExample(vars) }
    ];
  },

  getLoadSnippet(runtime, framework) {
    // Bun loads .env automatically
    if (runtime.name === 'bun') return '';

    // Hono/Express/Fastify all use dotenv the same way
    return "import 'dotenv/config';";
  },

  collectEnvVars(config): EnvVar[] {
    return [
      // Core
      { key: 'PORT', value: '3000', required: true },
      { key: 'NODE_ENV', value: 'development', required: true },

      // Database (if selected)
      ...config.database?.getEnvVars() ?? [],

      // Auth (if selected)
      ...config.auth?.getEnvVars() ?? []
    ];
  }
};
```

### Middleware Normalizer

```typescript
interface MiddlewareNormalizer {
  getCorsSetup(framework: FrameworkPlugin): CodeSnippet;
  getLoggingSetup(framework: FrameworkPlugin): CodeSnippet;
  getHealthEndpoint(framework: FrameworkPlugin): CodeSnippet;
}

export const middlewareNormalizer: MiddlewareNormalizer = {
  getCorsSetup(framework) {
    return framework.getMiddlewareSnippet('cors');
  },

  getHealthEndpoint(framework) {
    const patterns: Record<string, CodeSnippet> = {
      hono: {
        code: `app.get('/health', (c) => c.json({ status: 'ok' }));`,
        imports: []
      },
      express: {
        code: `app.get('/health', (req, res) => res.json({ status: 'ok' }));`,
        imports: []
      },
      fastify: {
        code: `fastify.get('/health', async () => ({ status: 'ok' }));`,
        imports: []
      }
    };
    return patterns[framework.name];
  }
};
```

### Dependency Normalizer

```typescript
interface DependencyNormalizer {
  resolve(config: ProjectConfig): { deps: string[]; devDeps: string[] };
}

export const depsNormalizer: DependencyNormalizer = {
  resolve(config) {
    return {
      deps: [
        ...config.framework.getDependencies(config).prod,
        ...config.runtime.getRuntimeSpecificDeps().prod ?? [],
        ...config.auth?.getDependencies().prod ?? [],
        ...config.database?.getDependencies().prod ?? []
      ],
      devDeps: [
        ...config.framework.getDependencies(config).dev,
        ...config.runtime.getRuntimeSpecificDeps().dev ?? [],
        'typescript'
      ]
    };
  }
};
```

The orchestrator calls normalizers to build a unified `GenerationContext` that templates consume.

---

## Module Interaction Diagram

### Full System Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER INPUT                                      │
│            (Interactive prompts OR CLI flags)                                │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLI LAYER                                       │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐                  │
│  │  args.ts    │───▶│ prompts.ts  │───▶│  ProjectConfig  │                  │
│  │ (parse flags)    │  (Clack)    │    │    (output)     │                  │
│  └─────────────┘    └─────────────┘    └────────┬────────┘                  │
└─────────────────────────────────────────────────┼───────────────────────────┘
                                                  │
                                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            ORCHESTRATOR                                      │
│                                                                              │
│   1. Load plugins ──────▶ PluginRegistry                                    │
│                                                                              │
│   2. Validate ──────────▶ Resolver.checkCompatibility(config)               │
│                                │                                             │
│                                ▼                                             │
│   3. Build context ─────▶ ┌────────────────────────────────────┐            │
│                           │      ADAPTER LAYER                  │            │
│                           │  ┌──────────┐ ┌──────────┐         │            │
│                           │  │  EnvNorm │ │ DepsNorm │         │            │
│                           │  └────┬─────┘ └────┬─────┘         │            │
│                           │       │            │                │            │
│                           │  ┌────┴────────────┴────┐          │            │
│                           │  │   GenerationContext   │          │            │
│                           │  └──────────┬───────────┘          │            │
│                           └─────────────┼───────────────────────┘            │
│                                         │                                    │
│   4. Generate ──────────────────────────┼───────────────────────────────────│
└─────────────────────────────────────────┼───────────────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          GENERATOR ENGINE                                    │
│                                                                              │
│   ┌─────────────────────┐      ┌─────────────────────────────────┐          │
│   │   PLUGIN LOGIC      │      │        TEMPLATES                 │          │
│   │  (src/plugins/)     │      │      (templates/)                │          │
│   │                     │      │                                  │          │
│   │  hono/index.ts ─────┼─────▶│  hono/dynamic/index.ts.ejs      │          │
│   │  getTemplateContext()      │  hono/static/tsconfig.json      │          │
│   │                     │      │  shared/Dockerfile.ejs          │          │
│   └─────────────────────┘      └─────────────────────────────────┘          │
│                                          │                                   │
│   For each template:                     │                                   │
│   ├─ static/  → copy directly            │                                   │
│   └─ dynamic/ → render EJS with context  │                                   │
└──────────────────────────────────────────┼──────────────────────────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          OUTPUT (Generated Project)                          │
│                                                                              │
│   my-app/                                                                    │
│   ├── src/index.ts          (framework entry)                               │
│   ├── package.json          (merged deps from all plugins)                  │
│   ├── tsconfig.json         (framework-specific)                            │
│   ├── .env.example          (collected env vars)                            │
│   ├── Dockerfile            (runtime-aware)                                 │
│   └── [auth/db files]       (if selected)                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Example Sequence: Fastify + Bun + Better-Auth + Drizzle

```
1. CLI: User selects fastify, bun, better-auth, drizzle
2. Orchestrator: Loads FastifyPlugin, BunAdapter, BetterAuthPlugin, DrizzlePlugin
3. Resolver: Checks all manifests → all compatible ✓
4. Adapters:
   - EnvNorm collects: PORT, DATABASE_URL, AUTH_SECRET
   - DepsNorm merges: fastify + drizzle-orm + better-auth + @types/bun
5. Generator:
   - Renders fastify/dynamic/* with context
   - Copies fastify/static/*
   - Renders drizzle/schema.ts.ejs
   - Renders better-auth/auth.ts.ejs
   - Renders shared/Dockerfile.ejs (uses BunAdapter values)
6. Output: Complete runnable project
```

---

## Complete Type Definitions

```typescript
// src/plugins/types.ts

// ============== CORE TYPES ==============

export interface ProjectConfig {
  name: string;
  directory: string;
  framework: FrameworkPlugin;
  runtime: RuntimeAdapter;
  auth: AuthPlugin | null;
  database: DatabasePlugin | null;
  features: {
    docker: boolean;
    cors: boolean;
    logging: boolean;
    healthCheck: boolean;
  };
}

export interface GenerationContext {
  projectName: string;
  runtime: 'node' | 'bun';
  imports: string[];
  middlewareSetup: string;
  routeSetup: string;
  scripts: Record<string, string>;
  deps: Dependency[];
  devDeps: Dependency[];
  envVars: EnvVar[];
}

export interface Dependency {
  name: string;
  version: string;
}

export interface EnvVar {
  key: string;
  value: string;
  required: boolean;
  description?: string;
}

// ============== PLUGIN INTERFACES ==============

export interface FrameworkPlugin {
  readonly name: string;
  readonly displayName: string;
  readonly manifest: CapabilityManifest;

  getTemplateContext(config: ProjectConfig): Record<string, unknown>;
  getDependencies(config: ProjectConfig): { prod: string[]; dev: string[] };
  getScripts(runtime: RuntimeAdapter): Record<string, string>;
  getMiddlewareSnippet?(type: string): CodeSnippet | null;
  postGenerate?(ctx: GenerationContext): Promise<void>;
}

export interface AuthPlugin {
  readonly name: string;
  readonly displayName: string;
  readonly manifest: CapabilityManifest;

  getDependencies(): { prod: string[]; dev: string[] };
  getEnvVars(): EnvVar[];
  getTemplateContext(framework: FrameworkPlugin): Record<string, unknown>;
  getSetupSnippet(framework: FrameworkPlugin): CodeSnippet;
}

export interface DatabasePlugin {
  readonly name: string;
  readonly displayName: string;
  readonly manifest: CapabilityManifest;

  getDependencies(): { prod: string[]; dev: string[] };
  getEnvVars(): EnvVar[];
  getConfigFiles(): TemplateFile[];
  getClientSnippet(): CodeSnippet;
}

export interface RuntimeAdapter {
  readonly name: 'node' | 'bun';
  readonly displayName: string;

  getInstallCommand(deps: string[]): string;
  getDevInstallCommand(deps: string[]): string;
  getLockfileName(): string;
  getRunCommand(script: string): string;
  getExecutable(): string;
  getEnvLoadingStrategy(): EnvStrategy;
  getRuntimeSpecificDeps(): { prod?: string[]; dev: string[] };
  getConfigFiles(): StaticFile[];
}

// ============== SUPPORTING TYPES ==============

export interface CapabilityManifest {
  provides: {
    type: 'framework' | 'auth' | 'database';
    features: string[];
  };
  compatible: {
    runtimes: ('node' | 'bun')[];
    auth: string[] | '*';
    databases: string[] | '*';
  };
  requires?: {
    features?: string[];
  };
}

export interface CodeSnippet {
  code: string;
  imports: string[];
}

export interface TemplateFile {
  path: string;
  template: string;
  context?: Record<string, unknown>;
}

export interface StaticFile {
  path: string;
  source: string;
}

export interface EnvStrategy {
  package: string | null;
  loadSnippet: string | null;
}

// ============== ERROR TYPES ==============

export class CompatibilityError extends Error {
  constructor(
    public plugin: string,
    public incompatibleWith: string,
    public reason: string
  ) {
    super(`${plugin} is incompatible with ${incompatibleWith}: ${reason}`);
    this.name = 'CompatibilityError';
  }
}

export class TemplateError extends Error {
  constructor(
    public templatePath: string,
    public originalError: Error
  ) {
    super(`Failed to render ${templatePath}: ${originalError.message}`);
    this.name = 'TemplateError';
  }
}

export class PluginValidationError extends Error {
  constructor(
    public pluginName: string,
    public missingFields: string[]
  ) {
    super(`Plugin ${pluginName} missing required fields: ${missingFields.join(', ')}`);
    this.name = 'PluginValidationError';
  }
}
```

---

## How to Add a New Framework in 3 Steps

This guide demonstrates the Open/Closed Principle in action — extend without modifying core.

### Step 1: Create the Plugin Directory

```bash
mkdir -p src/plugins/frameworks/fastify
mkdir -p templates/frameworks/fastify/{static,dynamic/src}
```

### Step 2: Implement the Plugin Interface

**Plugin Implementation:**

```typescript
// src/plugins/frameworks/fastify/index.ts
import type { FrameworkPlugin, ProjectConfig, RuntimeAdapter } from '../../types';
import { manifest } from './manifest';

export const FastifyPlugin: FrameworkPlugin = {
  name: 'fastify',
  displayName: 'Fastify',
  manifest,

  getTemplateContext(config: ProjectConfig) {
    return {
      projectName: config.name,
      useTypeScript: true,
      features: {
        cors: true,
        logging: true,
        healthCheck: true
      }
    };
  },

  getDependencies(config: ProjectConfig) {
    return {
      prod: ['fastify', '@fastify/cors'],
      dev: []
    };
  },

  getScripts(runtime: RuntimeAdapter) {
    const exec = runtime.getExecutable();
    return {
      dev: `${exec} --watch src/index.ts`,
      start: `${exec} src/index.ts`,
      build: 'tsc'
    };
  },

  getMiddlewareSnippet(type: string) {
    const snippets = {
      cors: {
        code: "await fastify.register(cors, { origin: true });",
        imports: ["import cors from '@fastify/cors';"]
      }
    };
    return snippets[type];
  }
};
```

**Manifest:**

```typescript
// src/plugins/frameworks/fastify/manifest.ts
import type { CapabilityManifest } from '../../types';

export const manifest: CapabilityManifest = {
  provides: {
    type: 'framework',
    features: ['middleware', 'routing', 'hooks', 'validation']
  },
  compatible: {
    runtimes: ['node', 'bun'],
    auth: ['passport', 'better-auth'],
    databases: ['prisma', 'drizzle']
  }
};
```

### Step 3: Add Templates

**Entry Point Template:**

```typescript
// templates/frameworks/fastify/dynamic/src/index.ts.ejs
<% if (runtime === 'node') { %>import 'dotenv/config';<% } %>
import Fastify from 'fastify';
<%= imports.join('\n') %>

const fastify = Fastify({
  logger: true
});

<%= middlewareSetup %>

fastify.get('/health', async () => ({ status: 'ok' }));

<%= routeSetup %>

const start = async () => {
  try {
    await fastify.listen({
      port: Number(process.env.PORT) || 3000,
      host: '0.0.0.0'
    });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
```

**Package.json Template:**

```json
// templates/frameworks/fastify/dynamic/package.json.ejs
{
  "name": "<%= projectName %>",
  "type": "module",
  "scripts": {
    <%- Object.entries(scripts).map(([k,v]) => `"${k}": "${v}"`).join(',\n    ') %>
  },
  "dependencies": {
    <%- deps.map(d => `"${d.name}": "${d.version}"`).join(',\n    ') %>
  },
  "devDependencies": {
    <%- devDeps.map(d => `"${d.name}": "${d.version}"`).join(',\n    ') %>
  }
}
```

**Static Config:**

```json
// templates/frameworks/fastify/static/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "outDir": "dist"
  },
  "include": ["src"]
}
```

### Register the Plugin

```typescript
// src/core/registry.ts
import { HonoPlugin } from '../plugins/frameworks/hono';
import { ExpressPlugin } from '../plugins/frameworks/express';
import { FastifyPlugin } from '../plugins/frameworks/fastify'; // ← Add import

export const frameworkRegistry: FrameworkPlugin[] = [
  HonoPlugin,
  ExpressPlugin,
  FastifyPlugin  // ← Register
];
```

### Future: Zero-Touch Discovery

For true auto-discovery without manual registration:

```typescript
const pluginFiles = await glob('src/plugins/frameworks/*/index.ts');
const plugins = await Promise.all(
  pluginFiles.map(f => import(f).then(m => m.default))
);
```

---

## Summary

This architecture provides:

1. **Extreme Modularity** — Each concern (framework, runtime, auth, database) is isolated
2. **Open/Closed Compliance** — New frameworks added via files, not core changes
3. **Type Safety** — Full TypeScript interfaces enforce plugin contracts
4. **Automatic Compatibility** — Manifests declare and resolve valid combinations
5. **Clean Separation** — Logic in `src/plugins/`, templates in `templates/`
6. **Normalized Adapters** — Cross-technology operations standardized

The Strategy Pattern enables swapping any component without affecting others, while the Capability Manifest system ensures users only see valid configuration options.
