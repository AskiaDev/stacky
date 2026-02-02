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
  framework: string;
  database: string | null;
  auth: string | null;
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
  getDependencies(config: ProjectConfig): { prod: Dependency[]; dev: Dependency[] };
  getScripts(runtime: RuntimeAdapter): Record<string, string>;
  getMiddlewareSnippet?(type: string): CodeSnippet | null;
  getEntryFile(): string;
  postGenerate?(ctx: GenerationContext): Promise<void>;
}

export interface AuthPlugin {
  readonly name: string;
  readonly displayName: string;
  readonly manifest: CapabilityManifest;

  getDependencies(): { prod: Dependency[]; dev: Dependency[] };
  getEnvVars(): EnvVar[];
  getTemplateContext(framework: FrameworkPlugin): Record<string, unknown>;
  getSetupSnippet(framework: FrameworkPlugin): CodeSnippet;
  getFiles(): TemplateFile[];
}

export interface DatabasePlugin {
  readonly name: string;
  readonly displayName: string;
  readonly manifest: CapabilityManifest;

  getDependencies(): { prod: Dependency[]; dev: Dependency[] };
  getEnvVars(): EnvVar[];
  getConfigFiles(): TemplateFile[];
  getClientSnippet(): CodeSnippet;
  getScripts(): Record<string, string>;
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
  getRuntimeSpecificDeps(): { prod: Dependency[]; dev: Dependency[] };
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
  content: string;
}

export interface EnvStrategy {
  package: string | null;
  loadSnippet: string | null;
}

// ============== REGISTRY TYPES ==============

export interface PluginRegistry {
  frameworks: FrameworkPlugin[];
  auth: AuthPlugin[];
  databases: DatabasePlugin[];
  runtimes: RuntimeAdapter[];
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
