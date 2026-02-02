import type {
  AuthPlugin,
  CapabilityManifest,
  Dependency,
  EnvVar,
  TemplateFile,
  CodeSnippet,
  FrameworkPlugin
} from '../../../core/types.js';

const manifest: CapabilityManifest = {
  provides: {
    type: 'auth',
    features: ['session', 'oauth', 'local-strategy', 'jwt']
  },
  compatible: {
    runtimes: ['node', 'bun'],
    auth: '*',
    databases: ['prisma', 'drizzle']
  },
  requires: {
    features: ['middleware']
  }
};

export const PassportPlugin: AuthPlugin = {
  name: 'passport',
  displayName: 'Passport.js',
  manifest,

  getDependencies(): { prod: Dependency[]; dev: Dependency[] } {
    return {
      prod: [
        { name: 'passport', version: '^0.7.0' },
        { name: 'passport-local', version: '^1.0.0' },
        { name: 'express-session', version: '^1.18.1' }
      ],
      dev: [
        { name: '@types/passport', version: '^1.0.17' },
        { name: '@types/passport-local', version: '^1.0.38' },
        { name: '@types/express-session', version: '^1.18.1' }
      ]
    };
  },

  getEnvVars(): EnvVar[] {
    return [
      {
        key: 'SESSION_SECRET',
        value: 'your-session-secret-change-in-production',
        required: true,
        description: 'Secret key for session encryption'
      }
    ];
  },

  getTemplateContext(framework: FrameworkPlugin): Record<string, unknown> {
    return {
      framework: framework.name
    };
  },

  getSetupSnippet(framework: FrameworkPlugin): CodeSnippet {
    if (framework.name === 'express') {
      return {
        code: `app.use(session({\n  secret: process.env.SESSION_SECRET!,\n  resave: false,\n  saveUninitialized: false\n}));\napp.use(passport.initialize());\napp.use(passport.session());`,
        imports: [
          "import passport from 'passport';",
          "import session from 'express-session';",
          "import './lib/passport.js';"
        ]
      };
    }

    // Passport works best with Express, other frameworks need adapters
    return {
      code: `// Note: Passport.js works best with Express. Consider using Better Auth for ${framework.displayName}.`,
      imports: []
    };
  },

  getFiles(): TemplateFile[] {
    return [
      {
        path: 'src/lib/passport.ts',
        template: 'passport-config',
        context: {}
      }
    ];
  }
};

// Passport config template
export const passportConfigTemplate = `import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';

// Configure local strategy
passport.use(new LocalStrategy(
  { usernameField: 'email' },
  async (email, password, done) => {
    try {
      // TODO: Implement user lookup from database
      // const user = await findUserByEmail(email);
      // if (!user) return done(null, false, { message: 'User not found' });
      // if (!await verifyPassword(password, user.password)) {
      //   return done(null, false, { message: 'Invalid password' });
      // }
      // return done(null, user);

      return done(null, false, { message: 'Not implemented' });
    } catch (err) {
      return done(err);
    }
  }
));

// Serialize user for session
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id: string, done) => {
  try {
    // TODO: Implement user lookup by ID
    // const user = await findUserById(id);
    // done(null, user);
    done(null, null);
  } catch (err) {
    done(err);
  }
});

export default passport;
`;
