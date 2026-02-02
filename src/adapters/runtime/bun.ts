import type { RuntimeAdapter, Dependency, StaticFile, EnvStrategy } from '../../core/types.js';

export const BunAdapter: RuntimeAdapter = {
  name: 'bun',
  displayName: 'Bun',

  getInstallCommand(deps: string[]): string {
    if (deps.length === 0) return 'bun install';
    return `bun add ${deps.join(' ')}`;
  },

  getDevInstallCommand(deps: string[]): string {
    if (deps.length === 0) return 'bun install';
    return `bun add -D ${deps.join(' ')}`;
  },

  getLockfileName(): string {
    return 'bun.lockb';
  },

  getRunCommand(script: string): string {
    return `bun run ${script}`;
  },

  getExecutable(): string {
    return 'bun';
  },

  getEnvLoadingStrategy(): EnvStrategy {
    return {
      package: null,
      loadSnippet: null  // Bun loads .env automatically
    };
  },

  getRuntimeSpecificDeps(): { prod: Dependency[]; dev: Dependency[] } {
    return {
      prod: [],
      dev: [
        { name: '@types/bun', version: '^1.1.14' },
        { name: 'typescript', version: '^5.7.2' }
      ]
    };
  },

  getConfigFiles(): StaticFile[] {
    return [];
  }
};
