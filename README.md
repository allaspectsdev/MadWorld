# MadWorld

A lightweight browser-based MMORPG where every player starts equal and progresses by actually doing things in the world. No class selection, no pay-to-win. You are what you practice.

Traverse an open map of roads, wilderness, and cities. Fight, fish, cook, craft, trade, and explore.

## Features

- **Skill-based progression** — 11 skills (melee, ranged, defense, agility, fishing, mining, woodcutting, foraging, cooking, smithing, alchemy), all starting at level 1 with a cap of 99
- **Real-time multiplayer** — Server-authoritative game loop at 10 ticks/sec with client-side prediction and entity interpolation
- **Tile-based world** — Multiple zones with distinct themes, mobs, and resources connected by portals
- **Combat** — Click-to-attack with cooldowns, mob AI (patrol, aggro, chase, leash), damage rolls, and XP rewards
- **Gathering & crafting** — Fish at water spots, mine ore veins, chop trees, cook food, smith weapons, brew potions
- **Equipment** — 10 gear slots, 6 tiers of equipment, stat-based progression
- **Persistent world** — Player state saved to PostgreSQL, sessions managed with Redis

## Tech Stack

| Layer | Tech |
|---|---|
| Client | TypeScript, PixiJS (WebGL 2D), Zustand, Vite |
| Server | TypeScript, Bun, Hono |
| Database | PostgreSQL + Drizzle ORM |
| Cache | Redis |
| Networking | WebSocket (JSON protocol) |
| Monorepo | pnpm workspaces |

## Project Structure

```
packages/
  shared/     # Types, constants, formulas, protocol — shared by client & server
  server/     # Bun game server — game loop, entities, systems, DB, auth
  client/     # Browser client — PixiJS renderer, input, UI, state management
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) >= 20
- [pnpm](https://pnpm.io/) >= 9
- [Bun](https://bun.sh/) >= 1.0
- [Docker](https://www.docker.com/) (for PostgreSQL and Redis)

### Setup

```bash
# Clone the repo
git clone https://github.com/allaspectsdev/MadWorld.git
cd MadWorld

# Install dependencies
pnpm install

# Start PostgreSQL and Redis
docker compose up -d

# Copy environment variables
cp .env.example .env

# Run database migrations
pnpm db:migrate

# Start development servers (client on :3000, server on :4000)
pnpm dev
```

Open `http://localhost:3000` in your browser, register an account, and start playing.

### Commands

| Command | Description |
|---|---|
| `pnpm dev` | Start client + server in dev mode |
| `pnpm dev:server` | Start only the game server |
| `pnpm dev:client` | Start only the Vite dev server |
| `pnpm build` | Build all packages for production |
| `pnpm test` | Run tests across all packages |
| `pnpm typecheck` | Type-check all packages |
| `pnpm db:generate` | Generate Drizzle migrations |
| `pnpm db:migrate` | Apply database migrations |

## Architecture

### Server

The server runs a fixed-rate game loop at 10 ticks/second. All game logic is server-authoritative — the client sends intents (move, attack, fish) and the server validates and broadcasts results.

**Systems processed each tick:** movement → mob AI → combat → XP/skills → respawns → state broadcast → periodic DB persistence

Spatial partitioning uses a chunk-based grid (16x16 tiles per chunk) for efficient "nearby entity" queries and viewport-scoped broadcasting.

### Client

The client renders at 60fps using PixiJS. Movement uses client-side prediction with server reconciliation (Gambetta model). Remote entities are interpolated between server snapshots for smooth animation.

UI is DOM-based (HTML/CSS overlays on top of the game canvas) for panels like inventory, skills, chat, and shops.

### Networking

All messages are JSON over WebSocket with a numeric opcode discriminator:
- Opcodes `0x00-0x7F` = client-to-server
- Opcodes `0x80-0xFF` = server-to-client

The full protocol is defined as TypeScript discriminated unions in `packages/shared/src/net/messages.ts`.

## World

The game currently includes three zones:

- **Greendale Village** — Starter town with shops, a pond, chickens, and cows
- **Darkwood Forest** — Dense forest with goblins, spiders, and skeletons
- **Open Fields** — Grasslands with a river crossing, more mobs, and gathering spots

Zones are connected by portal tiles at their edges.

## License

MIT
