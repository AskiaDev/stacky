import type { RuntimeAdapter, Dependency, StaticFile, EnvStrategy } from '../../core/types.js';

export const NodeAdapter: RuntimeAdapter = {
  name: 'node',
  displayName: 'Node.js',

  getInstallCommand(deps: string[]): string {
    if (deps.length === 0) return 'npm install';
    return `npm install ${deps.join(' ')}`;
  },

  getDevInstallCommand(deps: string[]): string {
    if (deps.length === 0) return 'npm install';
    return `npm install -D ${deps.join(' ')}`;
  },

  getLockfileName(): string {
    return 'package-lock.json';
  },

  getRunCommand(script: string): string {
    return `npm run ${script}`;
  },

  getExecutable(): string {
    return 'npx tsx';
  },

  getEnvLoadingStrategy(): EnvStrategy {
    return {
      package: 'dotenv',
      loadSnippet: "import 'dotenv/config';"
    };
  },

  getRuntimeSpecificDeps(): { prod: Dependency[]; dev: Dependency[] } {
    return {
      prod: [],
      dev: [
        { name: '@types/node', version: '^22.10.2' },
        { name: 'tsx', version: '^4.19.2' },
        { name: 'typescript', version: '^5.7.2' }
      ]
    };
  },

  getConfigFiles(): StaticFile[] {
    return [];
  }
};
