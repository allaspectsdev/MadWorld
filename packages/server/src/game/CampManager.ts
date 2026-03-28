/**
 * CampManager — manages player camp placement, storage, furniture, gardens,
 * and NPC visitors.
 *
 * Camp tiers:
 *   - Tier 1 (Campfire): Respawn point + fast-travel anchor
 *   - Tier 2 (Small Camp): + Shared storage chest (8 slots)
 *   - Tier 3 (Full Camp): + Crafting station, cooking fire, 16-slot storage
 *   - Tier 4 (Homestead): + 16x16 buildable plot, furniture, gardens, visitors
 *
 * Rules:
 *   - Max 3 camps per party
 *   - Only party members can interact
 *   - Tier 4 adds furniture grid, garden plots, NPC visitor system
 */

import {
  Op,
  WORLD_CHUNK_SIZE,
  FURNITURE,
  GARDEN_SEEDS,
  VISITORS,
  HOMESTEAD_SIZE,
  HOMESTEAD_MAX_FURNITURE,
  type PlacedFurniture,
  type GardenPlant,
  type VisitorDef,
} from "@madworld/shared";
import { db } from "../db/index.js";
import { partyCamps } from "../db/schema.js";
import { eq } from "drizzle-orm";

export interface Camp {
  id: number;
  partyId: string;
  ownerPlayerId: number;
  name: string;
  worldX: number;
  worldY: number;
  chunkX: number;
  chunkY: number;
  tier: number;
  storage: CampSlot[];
  furniture: PlacedFurniture[];
  gardens: GardenPlotState[];
  visitorId: string | null;
  visitorExpiresAt: number | null; // Unix ms
}

export interface CampSlot {
  itemId: string;
  quantity: number;
}

export interface GardenPlotState {
  gridX: number;
  gridY: number;
  seedId: string;
  plantedAt: number;
  readyAt: number;
}

const MAX_CAMPS_PER_PARTY = 3;
const STORAGE_SLOTS_BY_TIER: Record<number, number> = { 1: 0, 2: 8, 3: 16, 4: 24 };

export class CampManager {
  private campsByParty = new Map<string, Camp[]>();

  async loadPartyCamps(partyId: string): Promise<Camp[]> {
    const cached = this.campsByParty.get(partyId);
    if (cached) return cached;

    const rows = await db
      .select()
      .from(partyCamps)
      .where(eq(partyCamps.partyId, partyId));

    const camps: Camp[] = rows.map((r) => ({
      id: r.id,
      partyId: r.partyId,
      ownerPlayerId: r.ownerPlayerId,
      name: r.name,
      worldX: r.worldX,
      worldY: r.worldY,
      chunkX: r.chunkX,
      chunkY: r.chunkY,
      tier: r.tier,
      storage: (r.storage as CampSlot[]) ?? [],
      furniture: ((r as any).furniture as PlacedFurniture[]) ?? [],
      gardens: ((r as any).gardens as GardenPlotState[]) ?? [],
      visitorId: (r as any).visitorId ?? null,
      visitorExpiresAt: (r as any).visitorExpiresAt ? new Date((r as any).visitorExpiresAt).getTime() : null,
    }));

    this.campsByParty.set(partyId, camps);
    return camps;
  }

  async placeCamp(
    partyId: string,
    ownerPlayerId: number,
    worldX: number,
    worldY: number,
    name = "Camp",
  ): Promise<Camp | { error: string }> {
    const camps = await this.loadPartyCamps(partyId);

    if (camps.length >= MAX_CAMPS_PER_PARTY) {
      return { error: `Maximum ${MAX_CAMPS_PER_PARTY} camps per party.` };
    }

    for (const existing of camps) {
      const dist = Math.sqrt((worldX - existing.worldX) ** 2 + (worldY - existing.worldY) ** 2);
      if (dist < 10) {
        return { error: "Too close to an existing camp." };
      }
    }

    const chunkX = Math.floor(worldX / WORLD_CHUNK_SIZE);
    const chunkY = Math.floor(worldY / WORLD_CHUNK_SIZE);

    const [row] = await db
      .insert(partyCamps)
      .values({
        partyId,
        ownerPlayerId,
        name,
        worldX,
        worldY,
        chunkX,
        chunkY,
        tier: 1,
        storage: [],
        furniture: [],
        gardens: [],
      })
      .returning();

    const camp: Camp = {
      id: row.id,
      partyId: row.partyId,
      ownerPlayerId: row.ownerPlayerId,
      name: row.name,
      worldX: row.worldX,
      worldY: row.worldY,
      chunkX: row.chunkX,
      chunkY: row.chunkY,
      tier: row.tier,
      storage: [],
      furniture: [],
      gardens: [],
      visitorId: null,
      visitorExpiresAt: null,
    };

    camps.push(camp);
    return camp;
  }

  async upgradeCamp(campId: number, partyId: string): Promise<Camp | { error: string }> {
    const camps = await this.loadPartyCamps(partyId);
    const camp = camps.find((c) => c.id === campId);
    if (!camp) return { error: "Camp not found." };
    if (camp.tier >= 4) return { error: "Camp already at max tier." };

    camp.tier += 1;
    await db
      .update(partyCamps)
      .set({ tier: camp.tier })
      .where(eq(partyCamps.id, campId));

    return camp;
  }

  // ---- Storage ----

  async storeItem(
    campId: number,
    partyId: string,
    itemId: string,
    quantity: number,
  ): Promise<CampSlot[] | { error: string }> {
    const camps = await this.loadPartyCamps(partyId);
    const camp = camps.find((c) => c.id === campId);
    if (!camp) return { error: "Camp not found." };

    const maxSlots = STORAGE_SLOTS_BY_TIER[camp.tier] ?? 0;
    if (maxSlots === 0) return { error: "This camp has no storage. Upgrade to tier 2." };

    const existing = camp.storage.find((s) => s.itemId === itemId);
    if (existing) {
      existing.quantity += quantity;
    } else {
      if (camp.storage.length >= maxSlots) {
        return { error: "Camp storage is full." };
      }
      camp.storage.push({ itemId, quantity });
    }

    await this.persistField(campId, "storage", camp.storage);
    return camp.storage;
  }

  async withdrawItem(
    campId: number,
    partyId: string,
    itemId: string,
    quantity: number,
  ): Promise<CampSlot[] | { error: string }> {
    const camps = await this.loadPartyCamps(partyId);
    const camp = camps.find((c) => c.id === campId);
    if (!camp) return { error: "Camp not found." };

    const slot = camp.storage.find((s) => s.itemId === itemId);
    if (!slot || slot.quantity < quantity) {
      return { error: "Not enough items in storage." };
    }

    slot.quantity -= quantity;
    if (slot.quantity <= 0) {
      camp.storage = camp.storage.filter((s) => s !== slot);
    }

    await this.persistField(campId, "storage", camp.storage);
    return camp.storage;
  }

  // ---- Furniture (Tier 4) ----

  async placeFurniture(
    campId: number,
    partyId: string,
    furnitureId: string,
    gridX: number,
    gridY: number,
    displayItemId?: string,
  ): Promise<PlacedFurniture | { error: string }> {
    const camps = await this.loadPartyCamps(partyId);
    const camp = camps.find((c) => c.id === campId);
    if (!camp) return { error: "Camp not found." };
    if (camp.tier < 4) return { error: "Upgrade to Homestead (tier 4) to place furniture." };

    const def = FURNITURE[furnitureId];
    if (!def) return { error: "Unknown furniture." };

    if (camp.furniture.length >= HOMESTEAD_MAX_FURNITURE) {
      return { error: "Homestead is full." };
    }

    // Bounds check
    if (gridX < 0 || gridY < 0 ||
        gridX + def.width > HOMESTEAD_SIZE ||
        gridY + def.height > HOMESTEAD_SIZE) {
      return { error: "Out of bounds." };
    }

    // Collision check
    for (const existing of camp.furniture) {
      const eDef = FURNITURE[existing.furnitureId];
      if (!eDef) continue;
      const overlapsX = gridX < existing.gridX + eDef.width && gridX + def.width > existing.gridX;
      const overlapsY = gridY < existing.gridY + eDef.height && gridY + def.height > existing.gridY;
      if (overlapsX && overlapsY) {
        return { error: "Overlaps with existing furniture." };
      }
    }

    const placed: PlacedFurniture = { furnitureId, gridX, gridY };
    if (displayItemId) placed.displayItemId = displayItemId;

    camp.furniture.push(placed);
    await this.persistField(campId, "furniture", camp.furniture);
    return placed;
  }

  async removeFurniture(
    campId: number,
    partyId: string,
    gridX: number,
    gridY: number,
  ): Promise<PlacedFurniture | { error: string }> {
    const camps = await this.loadPartyCamps(partyId);
    const camp = camps.find((c) => c.id === campId);
    if (!camp) return { error: "Camp not found." };

    const idx = camp.furniture.findIndex((f) => f.gridX === gridX && f.gridY === gridY);
    if (idx === -1) return { error: "No furniture at that position." };

    const [removed] = camp.furniture.splice(idx, 1);
    await this.persistField(campId, "furniture", camp.furniture);
    return removed;
  }

  // ---- Gardens (Tier 4) ----

  async plantSeed(
    campId: number,
    partyId: string,
    gridX: number,
    gridY: number,
    seedId: string,
  ): Promise<GardenPlotState | { error: string }> {
    const camps = await this.loadPartyCamps(partyId);
    const camp = camps.find((c) => c.id === campId);
    if (!camp) return { error: "Camp not found." };
    if (camp.tier < 4) return { error: "Requires Homestead (tier 4)." };

    const seedDef = GARDEN_SEEDS[seedId];
    if (!seedDef) return { error: "Unknown seed." };

    // Check that a garden_plot furniture exists at or covering this position
    const gardenFurniture = camp.furniture.find(
      (f) => f.furnitureId === "garden_plot" &&
        gridX >= f.gridX && gridX < f.gridX + (FURNITURE.garden_plot?.width ?? 2) &&
        gridY >= f.gridY && gridY < f.gridY + (FURNITURE.garden_plot?.height ?? 2),
    );
    if (!gardenFurniture) return { error: "No garden plot at this position." };

    // Check not already planted
    const existing = camp.gardens.find((g) => g.gridX === gridX && g.gridY === gridY);
    if (existing) return { error: "Already planted here." };

    const now = Date.now();
    const plant: GardenPlotState = {
      gridX,
      gridY,
      seedId,
      plantedAt: now,
      readyAt: now + seedDef.growTimeSeconds * 1000,
    };

    camp.gardens.push(plant);
    await this.persistField(campId, "gardens", camp.gardens);
    return plant;
  }

  /**
   * Harvest a ready plant. Returns the seed def for item/xp granting.
   */
  async harvestPlant(
    campId: number,
    partyId: string,
    gridX: number,
    gridY: number,
  ): Promise<{ seedId: string; harvestItemId: string; quantity: number; xp: number } | { error: string }> {
    const camps = await this.loadPartyCamps(partyId);
    const camp = camps.find((c) => c.id === campId);
    if (!camp) return { error: "Camp not found." };

    const idx = camp.gardens.findIndex((g) => g.gridX === gridX && g.gridY === gridY);
    if (idx === -1) return { error: "Nothing planted here." };

    const plant = camp.gardens[idx];
    if (Date.now() < plant.readyAt) {
      const remaining = Math.ceil((plant.readyAt - Date.now()) / 1000);
      return { error: `Not ready yet. ${remaining}s remaining.` };
    }

    const seedDef = GARDEN_SEEDS[plant.seedId];
    if (!seedDef) return { error: "Unknown seed type." };

    camp.gardens.splice(idx, 1);
    await this.persistField(campId, "gardens", camp.gardens);

    return {
      seedId: plant.seedId,
      harvestItemId: seedDef.harvestItemId,
      quantity: seedDef.harvestQuantity,
      xp: seedDef.xp,
    };
  }

  // ---- NPC Visitors ----

  /**
   * Roll for a visitor arrival. Call periodically (e.g., every 10 min).
   * Returns the visitor if one spawned.
   */
  async rollVisitor(campId: number, partyId: string): Promise<VisitorDef | null> {
    const camps = await this.loadPartyCamps(partyId);
    const camp = camps.find((c) => c.id === campId);
    if (!camp || camp.tier < 4) return null;

    // Already has a visitor that hasn't expired
    if (camp.visitorId && camp.visitorExpiresAt && Date.now() < camp.visitorExpiresAt) {
      return null;
    }

    // 10% chance per roll
    if (Math.random() > 0.10) return null;

    const eligible = VISITORS.filter((v) => v.minTier <= camp.tier);
    if (eligible.length === 0) return null;

    const visitor = eligible[Math.floor(Math.random() * eligible.length)];
    const expiresAt = Date.now() + visitor.stayDuration * 1000;

    camp.visitorId = visitor.id;
    camp.visitorExpiresAt = expiresAt;

    await db
      .update(partyCamps)
      .set({ visitorId: visitor.id, visitorExpiresAt: new Date(expiresAt) })
      .where(eq(partyCamps.id, campId));

    return visitor;
  }

  /** Get the active visitor for a camp (null if expired or none). */
  getActiveVisitor(camp: Camp): VisitorDef | null {
    if (!camp.visitorId || !camp.visitorExpiresAt) return null;
    if (Date.now() >= camp.visitorExpiresAt) {
      camp.visitorId = null;
      camp.visitorExpiresAt = null;
      return null;
    }
    return VISITORS.find((v) => v.id === camp.visitorId) ?? null;
  }

  // ---- Camp CRUD (unchanged) ----

  async removeCamp(campId: number, partyId: string): Promise<boolean> {
    const camps = await this.loadPartyCamps(partyId);
    const idx = camps.findIndex((c) => c.id === campId);
    if (idx === -1) return false;

    camps.splice(idx, 1);
    await db.delete(partyCamps).where(eq(partyCamps.id, campId));
    return true;
  }

  getCamps(partyId: string): Camp[] {
    return this.campsByParty.get(partyId) ?? [];
  }

  findNearestCamp(partyId: string, worldX: number, worldY: number): Camp | null {
    const camps = this.campsByParty.get(partyId);
    if (!camps || camps.length === 0) return null;

    let nearest: Camp | null = null;
    let nearestDist = Infinity;

    for (const camp of camps) {
      const dist = Math.sqrt((worldX - camp.worldX) ** 2 + (worldY - camp.worldY) ** 2);
      if (dist < nearestDist) {
        nearest = camp;
        nearestDist = dist;
      }
    }

    return nearest;
  }

  evictParty(partyId: string): void {
    this.campsByParty.delete(partyId);
  }

  private async persistField(campId: number, field: string, value: unknown): Promise<void> {
    await db
      .update(partyCamps)
      .set({ [field]: value })
      .where(eq(partyCamps.id, campId));
  }
}
