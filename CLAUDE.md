# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MadWorld is a browser-based MMORPG. Skill-based progression (11 skills, levels 1-99), server-authoritative game loop at 10 ticks/sec, client rendering at 60fps with PixiJS, WebSocket networking with JSON messages.

## Commands

```bash
pnpm install              # Install all dependencies
docker compose up -d      # Start PostgreSQL + Redis
cp .env.example .env      # First-time env setup
pnpm db:migrate           # Apply database migrations
pnpm dev                  # Start all packages in dev mode (client :3000, server :4000)
pnpm dev:server           # Server only (bun --watch)
pnpm dev:client           # Client only (vite)
pnpm build                # Build all (shared first, then server & client)
pnpm build:shared         # Build shared only (required before server/client)
pnpm test                 # Run tests across all packages (vitest for client/shared, bun test for server)
pnpm typecheck            # Type-check all packages
pnpm db:generate          # Generate Drizzle migration from schema changes
pnpm db:migrate           # Apply migrations
```

No ESLint or Prettier configured. No lint command.

## Architecture

**pnpm monorepo** with three packages under `packages/`:

```
shared (tsc)  <---  server (bun)
              <---  client (vite + pixi.js + zustand)
```

- **@madworld/shared** — Pure TypeScript, zero runtime deps. Types, constants (items, mobs, quests, abilities), formulas (combat, skills), and the networking protocol (opcodes + message types as discriminated unions).
- **@madworld/server** — Bun runtime + Hono. Game loop, entity system, ECS-like tick systems, WebSocket message handler, Drizzle ORM with PostgreSQL, JWT auth (jose), Redis for sessions.
- **@madworld/client** — Vite dev server (proxies `/api` and `/ws` to `:4000`). PixiJS rendering, Zustand state store, DOM-based UI panels, keyboard + touch input, client-side pathfinding.

**Build order matters**: shared must build before server or client (it compiles to `dist/` via tsc, consumed as ESM).

### Server Game Loop

10 ticks/sec, processes in order: movement -> mob AI -> boss AI -> combat -> abilities -> fishing timers -> gathering timers -> pet follow + bond XP -> weather tick -> chunk discovery (every 5 ticks) -> ground items -> party HP sync -> tick broadcast -> persistence (every 30s) -> instance cleanup (every 60s).

Key files: `GameLoop.ts`, `World.ts` (global state + ChunkManager), `Zone.ts` (per-zone entities + spatial grid).

### Message Handler Architecture

`MessageHandler.ts` (~170 lines) is a pure opcode router. All handler logic lives in `net/handlers/`:

```
handlers/
  auth.ts           — Login, disconnect, god commands
  movement.ts       — C_MOVE, C_STOP, C_GOD_TELEPORT
  combat.ts         — C_ATTACK
  ability.ts        — C_USE_SKILL (heal, enemy target, dash, party buff)
  party.ts          — C_PARTY_* (invite, accept, decline, leave, kick)
  dungeon.ts        — C_DUNGEON_ENTER
  chat.ts           — C_CHAT_SEND (zone, global, whisper)
  inventory.ts      — C_PICKUP, C_INV_MOVE/DROP/USE, C_EQUIP, C_UNEQUIP
  npc.ts            — C_NPC_INTERACT, C_QUEST_ACCEPT/TURN_IN
  shop.ts           — C_SHOP_BUY, C_SHOP_SELL
  fishing.ts        — C_FISH_CAST, C_FISH_REEL
  boat.ts           — C_BOAT_PLACE/ENTER/EXIT
  camp.ts           — C_PLACE_CAMP, C_INTERACT_CAMP, C_CAMP_STORE/WITHDRAW, C_FAST_TRAVEL
  homestead.ts      — C_PLACE_FURNITURE, C_REMOVE_FURNITURE, C_GARDEN_PLANT
  gathering.ts      — C_GATHER_START/ASSIST, C_CRAFT_START/CONTRIBUTE
  pets.ts           — C_PET_TAME/SUMMON/RENAME
  specialization.ts — C_SPEC_CHOOSE
  context.ts        — Shared helpers: sendInventory, giveItem
```

### Client Architecture

`Game.ts` (~850 lines) orchestrates all systems. `GameStore.ts` is the Zustand store for all client state. `Dispatcher.ts` routes incoming WebSocket messages to handlers. Rendering is split across `TilemapRenderer`, `EntityRenderer`, `ParticleSystem`, `LightingSystem`, etc.

UI panels are vanilla TypeScript DOM components (not React), located in `ui/components/`. All panels use a unified design system defined in `ui/styles/game-ui.css` with CSS custom properties (`--ui-bg`, `--ui-border`, `--color-gold`, etc.). Panels use the `.game-panel` class with `.panel-header` / `.panel-title` / `.panel-close` / `.panel-body` chrome pattern. Mobile styles in `ui/styles/mobile.css`. No inline styles in index.html — all styling lives in the external CSS files.

### Networking Protocol

All messages: `{ op: number, d?: any }` over WebSocket.
- Client->Server opcodes: `0x00-0x7F` (e.g., `C_MOVE=0x10`, `C_ATTACK=0x20`)
- Server->Client opcodes: `0x80-0xFF` (e.g., `S_ENTITY_SPAWN=0x91`, `S_DAMAGE=0xa0`)
- Protocol defined in `packages/shared/src/net/opcodes.ts` and `messages.ts`
- Auth flow: client sends `C_AUTH_LOGIN`/`C_AUTH_REGISTER` first, server responds with `S_AUTH_OK` containing JWT + player data

### Database

PostgreSQL 16 via Docker. Drizzle ORM with schema in `packages/server/src/db/schema.ts`, migrations in `src/db/migrations/`. Tables: users, players, skills, inventory, equipment, questProgress, worldChunks, playerDiscovery, skillSpecializations, playerPets, partyCamps.

Schema change workflow: edit `schema.ts` -> `pnpm db:generate` -> review migration -> `pnpm db:migrate`.

### Isometric Projection

The client uses a 2:1 isometric (diamond) projection. All coordinate math lives in `packages/shared/src/isometric.ts`:
- **ISO_TILE_W=64, ISO_TILE_H=32** — diamond tile dimensions on screen
- **cartToIso(cx, cy, elevation?)** — world tiles to iso screen pixels
- **isoToCart(ix, iy, elevation?)** — inverse
- **isoDepth(cx, cy, elevation?)** — returns `x + y` for painter's algorithm depth sorting
- **isoViewBounds(...)** — viewport culling: converts iso-pixel screen rect to cartesian tile bounds

The server remains purely cartesian (unchanged). The projection is client-only. All renderers (`TilemapRenderer`, `EntityRenderer`, `HitSplatRenderer`, `TelegraphRenderer`, `DecorationRenderer`, `ParticleSystem` calls, `LightingSystem`, `ChatBubbleRenderer`, `Dispatcher` particle effects) use `cartToIso()` for positioning and `isoToCart()` for input hit-detection.

`Camera.setTarget()` converts cart->iso internally. `Camera.screenToWorld()` returns cartesian world tiles (undoing iso projection). Height map support: `MOUNTAIN` and `FENCE` tiles render at elevation 1 with visible side faces.

### Spatial System

Chunk-based grid (16x16 tiles, 32px per tile). `SpatialGrid.ts` handles efficient nearby-entity queries. Server broadcasts only to players within 2 chunks. Server logic is purely cartesian and unaware of the isometric projection.

### Procedural World Generation

The world is procedurally generated using layered simplex noise. Key components:

**Shared** (`packages/shared/src/`):
- `noise.ts` — Seeded 2D simplex noise with octave/fBm layering (`createNoise2D`, `octaveNoise`)
- `biome.ts` — Biome enum (12 biomes), `deriveBiome(elevation, moisture, temperature)`, biome-to-tile and biome-to-color mappings. World chunk size = 32×32 tiles (`WORLD_CHUNK_SIZE`). Terrain noise scales in `TERRAIN_SCALES`.

**Server** (`packages/server/src/game/`):
- `WorldGenerator.ts` — Generates 32×32 tile chunks from world seed. Pipeline: sample 3 noise layers → derive biome → map to tiles with detail variation → smooth water edges → place mob spawns and lights. Deterministic: same seed + chunk coords = same output.
- `ChunkManager.ts` — On-demand chunk generation with LRU memory cache (512 chunks), DB persistence (`worldChunks` table), and per-player discovery tracking (`playerDiscovery` table). Main API: `getChunk(cx, cy)`, `discoverChunks(playerId, chunks)`, `loadPlayerDiscoveries(playerId)`.
- `systems/DiscoverySystem.ts` — Per-tick fog-of-war processing. Reveal radius = 1 chunk around player (+ fox pet bonus). Awards discovery XP (15/chunk, +50 for new biome, scaled by discovery_xp_mult spec). Party members share discoveries. Called every 5 ticks from GameLoop.

**Client** (`packages/client/src/renderer/`):
- `ChunkRenderer.ts` — LOD system: near chunks (≤2 away) get full TilemapRenderer + DecorationRenderer, far chunks (3-5 away) get single biome-colored diamond. Auto-manages load/unload as player moves.
- `FogOfWar.ts` — Dark overlay with holes cut for discovered chunks. Soft edge fading at discovery boundaries.

**Protocol**: `S_CHUNK_DATA` (0xe0), `S_CHUNK_UNLOAD` (0xe1), `S_DISCOVERY_UPDATE` (0xe2), `S_DISCOVERY_INIT` (0xe3). Client GameStore tracks `discoveredChunks` (Set) and `loadedChunks` (Map).

### Co-op Mechanics

**Gathering System** (`packages/shared/src/constants/gathering.ts`, `packages/server/src/game/systems/GatheringSystem.ts`):
- 9 resource node types across 3 skills (mining, woodcutting, foraging) with biome-specific spawning
- **Co-op nodes**: crystal_formation, ancient_tree, giant_flower require two players (one holds, one extracts via `C_GATHER_ASSIST`). Co-op grants bonus items + 1.5x XP
- Solo flow: `C_GATHER_START` → `S_GATHER_START` → (wait ticks) → `S_GATHER_RESULT`
- Co-op flow: `C_GATHER_START` → `S_GATHER_ASSIST_REQ` (to party) → partner sends `C_GATHER_ASSIST` → both get `S_GATHER_RESULT`

**Camp System** (`packages/server/src/game/CampManager.ts`, DB table `party_camps`):
- 3 tiers: Campfire (respawn + fast-travel), Small Camp (+8-slot shared storage), Full Camp (+crafting station, 16-slot storage)
- Max 3 camps per party, min 10 tiles between camps
- Storage shared between party members, persisted to DB as JSONB
- Placement: use `campfire_kit` item → `C_PLACE_CAMP` → `S_CAMP_PLACED`
- Fast-travel to camps via `C_FAST_TRAVEL`

**Crafting** (`packages/shared/src/constants/camps.ts`):
- `CraftRecipe` extends `RecipeDef` with `combo: boolean` flag for two-player recipes
- Combo crafting: Camp Station Kit, Healing Potion, Crystal Amulet require two players contributing ingredients simultaneously
- Basic solo recipes: campfire kit, smelting (copper/iron bars), cooking

**Party enhancements**: `PartyMemberInfo` now includes `worldX`/`worldY` for map display through fog. Discovery sharing already wired in `DiscoverySystem.sharePartyDiscovery()`.

### Skill Specializations

Binary choice nodes at levels 25, 50, and 75 for all 11 skills (33 nodes total). Defined in `packages/shared/src/constants/specializations.ts`. Persisted in `skill_specializations` table. Loaded into `Player.specEffects[]` on login by `PlayerService`. `Player.getSpecBonus(type, skill?)` sums all matching effects.

12 effect types, all integrated into runtime systems:
- **Combat**: `damage_mult`, `crit_chance` (CombatSystem player attack), `defense_mult` (CombatSystem mob→player)
- **Stats**: `hp_mult` (maxHp on login), `speed_mult` (movement speed on login)
- **XP**: `xp_mult` per-skill (grantXp), `discovery_xp_mult` (DiscoverySystem)
- **Gathering**: `yield_mult` (output quantities), `gather_speed` (timer reduction)
- **Fishing**: `fish_catch_mult` (success window width)
- **Crafting**: `cook_burn_reduce` (burn chance), `potion_power` (heal amount)

Protocol: `C_SPEC_CHOOSE` (0x3d), `S_SPEC_PROMPT` (0xed), `S_SPEC_LIST` (0xee).

### Pet System

5 tameable pets, each with a unique ability. Defined in `packages/shared/src/constants/pets.ts`. Managed by `PetManager.ts` (singleton). Persisted in `player_pets` table. Bond XP grows passively each tick; `petAbilityValue(petId, bondLevel)` scales with bond level.

| Pet | Ability | Integration |
|-----|---------|-------------|
| Fox | `discovery_radius` | DiscoverySystem reveal radius |
| Wolf | `auto_aggro` | AISystem mob aggro range expansion |
| Cat | `loot_bonus` | CombatSystem handleMobDeath drop chance |
| Rabbit | `xp_bonus` | CombatSystem grantXp multiplier |
| Owl | `resource_reveal` | Deferred (needs new opcode + client UI) |

### Weather System

Per-region weather (4x4 chunks). `WeatherManager.ts` re-rolls weather every 5 minutes per region. 8 weather types with gameplay effects:
- `speedMultiplier` — applied in MovementSystem via `getSpeedMultiplier()`
- `fishingMultiplier` — applied in fishing handler (rain 1.3x, thunderstorm 1.8x, sandstorm blocks)
- `damagePerTick` — blizzard/sandstorm hurt exposed players
- `visibilityMultiplier` — affects fog-of-war reveal

### Gathering Timers

Gathering is tick-based, not instant. `handleGatherStart` sets `Player.gatheringState` with a `completeTick` based on node's `gatherTicks` (reduced by `gather_speed` spec). `processGathering()` in GameLoop checks completion each tick. Movement cancels gathering. On completion, items are awarded with `yield_mult` spec bonus applied.

### World Map

Full-screen overlay toggled with M key (`WorldMap.ts`). Renders all discovered chunks as biome-colored rectangles. Party members shown as blue dots. `GameStore.chunkBiomes` persists biome data across chunk unloads so distant chunks render correctly.

## Key Patterns

- **Server-authoritative**: client sends intents, server validates and broadcasts results
- **Client-side prediction**: local player movement is predicted immediately, reconciled on server response (Gambetta model)
- **Entity interpolation**: remote entities smoothly interpolated between server snapshots
- **Game constants** (items, mobs, quests, abilities, shops) are defined in `packages/shared/src/constants/` and shared between client and server
- **Formulas** (combat damage, hit chance, XP curves) live in `packages/shared/src/formulas/`

## Deployment

`./deploy.sh` SSHs to production (139.144.52.228), pulls main, installs deps, builds shared+client, restarts the `madworld` systemd service. Server runs from source via bun (no build step needed). Client static assets served by nginx.
