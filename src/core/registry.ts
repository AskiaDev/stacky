import type { PluginRegistry, FrameworkPlugin, AuthPlugin, DatabasePlugin, RuntimeAdapter } from './types.js';
import { HonoPlugin, ExpressPlugin, FastifyPlugin } from '../plugins/frameworks/index.js';
import { NodeAdapter, BunAdapter } from '../adapters/runtime/index.js';
import { PrismaPlugin } from '../plugins/databases/prisma/index.js';
import { DrizzlePlugin } from '../plugins/databases/drizzle/index.js';
import { BetterAuthPlugin } from '../plugins/auth/better-auth/index.js';
import { PassportPlugin } from '../plugins/auth/passport/index.js';

// Framework plugins registry
const frameworks: FrameworkPlugin[] = [
  HonoPlugin,
  ExpressPlugin,
  FastifyPlugin
];

// Auth plugins registry
const auth: AuthPlugin[] = [
  BetterAuthPlugin,
  PassportPlugin
];

// Database plugins registry
const databases: DatabasePlugin[] = [
  PrismaPlugin,
  DrizzlePlugin
];

// Runtime adapters registry
const runtimes: RuntimeAdapter[] = [
  NodeAdapter,
  BunAdapter
];

export const registry: PluginRegistry = {
  frameworks,
  auth,
  databases,
  runtimes
};

// Helper functions for plugin lookup
export function getFramework(name: string): FrameworkPlugin | undefined {
  return frameworks.find(f => f.name === name);
}

export function getRuntime(name: string): RuntimeAdapter | undefined {
  return runtimes.find(r => r.name === name);
}

export function getAuth(name: string): AuthPlugin | undefined {
  return auth.find(a => a.name === name);
}

export function getDatabase(name: string): DatabasePlugin | undefined {
  return databases.find(d => d.name === name);
}

// Compatibility checking
export function isCompatible(
  framework: FrameworkPlugin,
  runtime: RuntimeAdapter
): boolean {
  return framework.manifest.compatible.runtimes.includes(runtime.name);
}

export function getCompatibleAuth(framework: FrameworkPlugin): AuthPlugin[] {
  const compatible = framework.manifest.compatible.auth;
  if (compatible === '*') return auth;
  return auth.filter(a => compatible.includes(a.name));
}

export function getCompatibleDatabases(framework: FrameworkPlugin): DatabasePlugin[] {
  const compatible = framework.manifest.compatible.databases;
  if (compatible === '*') return databases;
  return databases.filter(d => compatible.includes(d.name));
}
