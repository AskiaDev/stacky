import type { CapabilityManifest } from '../../../core/types.js';

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
