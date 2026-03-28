# MadWorld

A browser-based MMORPG built for co-op exploration. Procedurally generated isometric world, fog-of-war discovery, two-player gathering, party camps, and skill-based progression. No class selection, no pay-to-win. You are what you practice.

## Features

- **Procedural open world** — Infinite terrain generated from layered simplex noise. 12 biomes (ocean, forest, desert, mountains, swamp, tundra, jungle, savanna, and more) derived from elevation, moisture, and temperature noise layers. Chunks generated on demand, persisted to PostgreSQL.
- **Fog-of-war exploration** — The map starts hidden. Walk into new territory to reveal it. Discovery grants XP. Party members share discoveries automatically.
- **Isometric renderer** — 2:1 diamond projection with height map support, depth-sorted entities, elevation side faces, and LOD (near chunks: full tiles, far chunks: biome-colored diamonds).
- **Co-op gathering** — 9 resource node types across mining, woodcutting, and foraging. Some nodes (crystal formations, ancient trees, giant flowers) require two players — one holds, one extracts — for bonus loot and 1.5x XP.
- **Camp system** — Place campfires as respawn points and fast-travel anchors. Upgrade to small camps (shared storage) or full camps (crafting station, cooking fire). Max 3 camps per party, persisted to DB.
- **Combo crafting** — Certain recipes (healing potions, crystal amulets, camp station kits) require two players contributing ingredients simultaneously.
- **Skill-based progression** — 11 skills (melee, ranged, defense, agility, fishing, mining, woodcutting, foraging, cooking, smithing, alchemy), levels 1-99.
- **Real-time multiplayer** — Server-authoritative game loop at 10 ticks/sec, client-side prediction with Gambetta reconciliation, entity interpolation at 60fps.
- **Elite mobs** — 5% chance any mob spawns as Elite (gold name, 3x HP, 2x loot, 2x XP).
- **Parties** — Up to 5 players. Shared XP for nearby kills, cross-zone HP display, map visibility through fog.
- **Instanced dungeons** — Party-based dungeons with boss encounters, telegraph mechanics, and loot.
- **Combat** — Click-to-attack with cooldowns, 7 abilities, status effects, mob AI (patrol, aggro, chase, leash).
- **Equipment** — 10 gear slots, 6 tiers, stat-based progression.

## Tech Stack

| Layer | Tech |
|---|---|
| Client | TypeScript, PixiJS 8 (WebGL 2D isometric), Zustand, Vite |
| Server | TypeScript, Bun, Hono |
| Database | PostgreSQL 16 + Drizzle ORM |
| Cache | Redis 7 |
| Networking | WebSocket (JSON, numeric opcodes) |
| Monorepo | pnpm workspaces |

## Project Structure

```
packages/
  shared/     # Types, constants, formulas, protocol, noise, biomes, isometric math
  server/     # Game loop, entities, systems, world generator, chunk manager, DB, auth
  client/     # Isometric renderer, LOD chunks, fog-of-war, UI panels, input, pathfinding
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) >= 20
- [pnpm](https://pnpm.io/) >= 9
- [Bun](https://bun.sh/) >= 1.0
- [Docker](https://www.docker.com/) (for PostgreSQL and Redis)

### Setup

```bash
git clone https://github.com/allaspectsdev/MadWorld.git
cd MadWorld
pnpm install
docker compose up -d
cp .env.example .env
pnpm db:migrate
pnpm dev
```

Open `http://localhost:3000`, register an account, and start exploring.

### Commands

| Command | Description |
|---|---|
| `pnpm dev` | Start client + server in dev mode |
| `pnpm dev:server` | Start only the game server |
| `pnpm dev:client` | Start only the Vite dev server |
| `pnpm build` | Build all packages for production |
| `pnpm build:shared` | Build shared package (required before server/client) |
| `pnpm test` | Run tests across all packages |
| `pnpm typecheck` | Type-check all packages |
| `pnpm db:generate` | Generate Drizzle migrations from schema changes |
| `pnpm db:migrate` | Apply database migrations |

## Architecture

### Server

10 ticks/sec game loop. All logic is server-authoritative — clients send intents, server validates and broadcasts results.

**Tick order:** rate-limit reset → movement → mob AI → boss AI → instance wipes → combat → abilities → ground items → party HP sync → tick broadcast → persistence (every 30s) → instance cleanup (every 60s).

Spatial partitioning via chunk grid (16x16 tiles). Server broadcasts only to players within 2 chunks. Per-connection WebSocket message rate limiting (20 msgs/tick).

### Procedural World

Layered simplex noise generates terrain on demand. Three noise layers (elevation, moisture, temperature) combine to derive biomes. Each 32x32-tile chunk is deterministic from the world seed. Generated chunks cache in memory (LRU, 512 max) and persist to PostgreSQL.

The `ChunkManager` handles generation, caching, and per-player discovery tracking. The `DiscoverySystem` processes fog-of-war reveals each tick, awards XP, and shares discoveries across party members.

### Client

60fps rendering via PixiJS with 2:1 isometric projection. All coordinate math in `shared/isometric.ts`. LOD system: near chunks get full tile sprites + decorations, far chunks render as single biome-colored diamonds. Fog-of-war overlay hides undiscovered chunks with soft edge fading.

UI is DOM-based with a unified design system (`game-ui.css`) — CSS custom properties, `.game-panel` component pattern, backdrop blur, dark fantasy aesthetic. Not React — vanilla TypeScript DOM components backed by Zustand state.

### Networking

JSON over WebSocket with numeric opcode discriminators (`0x00-0x7F` client→server, `0x80-0xFF` server→client). Full protocol as TypeScript discriminated unions in `shared/net/messages.ts`.

## License

MIT
