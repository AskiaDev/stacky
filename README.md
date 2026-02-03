<div align="center">
  <h1>Stacky</h1>
  <p>
    <strong>Framework-agnostic CLI scaffolding tool for backend applications</strong>
  </p>
  <p>
    <a href="#installation">Installation</a> •
    <a href="#usage">Usage</a> •
    <a href="#features">Features</a> •
    <a href="#roadmap">Roadmap</a> •
    <a href="#contributing">Contributing</a>
  </p>
</div>

---

## About The Project

Stacky is a CLI tool that scaffolds production-ready backend projects with your choice of framework, runtime, database, and authentication. It uses a plugin-based architecture following the Strategy Pattern for extreme modularity.

**Why Stacky?**
- Start projects in seconds, not hours
- Production-ready setup with Docker, CORS, logging, and health checks
- Mix and match frameworks, runtimes, databases, and auth providers
- Consistent project structure across different tech stacks

### Built With

- [Commander.js](https://github.com/tj/commander.js) - CLI framework
- [Clack](https://github.com/natemoo-re/clack) - Beautiful CLI prompts
- [TypeScript](https://www.typescriptlang.org/) - Type safety

---

## Installation

```bash
npm install -g stacky-cli
```

Or use directly with npx:

```bash
npx stacky-cli my-app
```

---

## Usage

### Interactive Mode

Simply run stacky and follow the prompts:

```bash
stacky
```

### CLI Flags Mode

Skip the prompts with flags:

```bash
stacky my-app -f hono -r bun -d drizzle -a better-auth -i
```

### Available Options

| Flag | Description | Values |
|------|-------------|--------|
| `-f, --framework` | Web framework | `hono`, `express`, `fastify` |
| `-r, --runtime` | JavaScript runtime | `node`, `bun` |
| `-d, --database` | Database ORM | `prisma`, `drizzle` |
| `-a, --auth` | Authentication | `better-auth`, `passport` |
| `-i, --install` | Auto-install dependencies | - |
| `--no-docker` | Skip Docker setup | - |
| `--no-cors` | Skip CORS middleware | - |
| `--no-logging` | Skip request logging | - |
| `--no-health` | Skip health endpoint | - |

### Examples

**Hono + Bun + Drizzle + Better Auth:**
```bash
stacky my-api -f hono -r bun -d drizzle -a better-auth -i
```

**Express + Node (minimal):**
```bash
stacky my-api -f express -r node --no-docker
```

**Fastify + Prisma:**
```bash
stacky my-api -f fastify -r node -d prisma -i
```

---

## Features

### Frameworks

| Framework | Description |
|-----------|-------------|
| **Hono** | Ultra-fast, lightweight, Web Standards |
| **Express** | Classic, mature ecosystem |
| **Fastify** | High performance, schema validation |

### Runtimes

| Runtime | Description |
|---------|-------------|
| **Node.js** | Stable, widely supported |
| **Bun** | Fast, modern, batteries included |

### Databases

| ORM | Description |
|-----|-------------|
| **Drizzle** | Lightweight, SQL-like, type-safe |
| **Prisma** | Full-featured, migrations, studio |

### Authentication

| Provider | Description |
|----------|-------------|
| **Better Auth** | Modern, session-based, easy setup |
| **Passport** | Classic, 500+ strategies |

### Generated Project Structure

```
my-app/
├── src/
│   ├── index.ts        # App entry point
│   ├── db/             # Database (Drizzle)
│   │   ├── index.ts
│   │   └── schema.ts
│   └── lib/
│       └── auth.ts     # Auth config
├── prisma/             # Database (Prisma)
│   └── schema.prisma
├── .env
├── .env.example
├── .gitignore
├── .dockerignore
├── Dockerfile
├── drizzle.config.ts
├── eslint.config.js
├── package.json
├── tsconfig.json
└── README.md
```

### Included by Default

- **TypeScript** - Strict mode enabled
- **ESLint** - ESLint 9 flat config with TypeScript support
- **Docker** - Production-ready Dockerfile
- **Environment** - `.env` and `.env.example` files
- **Health Check** - `/health` endpoint
- **CORS** - Cross-origin resource sharing
- **Logging** - Request logging middleware

---

## Roadmap

- [x] Core CLI with interactive prompts
- [x] Hono, Express, Fastify frameworks
- [x] Node.js and Bun runtimes
- [x] Prisma and Drizzle ORMs
- [x] Better Auth and Passport authentication
- [x] Docker support
- [x] ESLint configuration
- [ ] Testing setup (Vitest)
- [ ] CI/CD templates (GitHub Actions)
- [ ] More auth providers (Lucia, Auth.js)
- [ ] Redis/caching support
- [ ] OpenAPI/Swagger generation
- [ ] Monorepo support

---

## Contributing

Contributions are welcome! Here's how:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Adding a New Plugin

Plugins follow the Strategy Pattern. See existing plugins in:
- `src/plugins/frameworks/` - Framework plugins
- `src/plugins/databases/` - Database plugins
- `src/plugins/auth/` - Auth plugins

---

## License

Distributed under the MIT License. See `LICENSE` for more information.

---

## Acknowledgments

- [create-t3-app](https://create.t3.gg/) - Inspiration for interactive CLI
- [Hono](https://hono.dev/) - Amazing web framework
- [Drizzle](https://orm.drizzle.team/) - TypeScript ORM
- [Better Auth](https://www.better-auth.com/) - Modern authentication

---

<div align="center">
  <sub>Built with by <a href="https://github.com/AskiaDev">AskiaDev</a></sub>
</div>
