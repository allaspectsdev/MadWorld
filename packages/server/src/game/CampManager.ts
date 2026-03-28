/**
 * CampManager — manages player camp placement, storage, and fast-travel.
 *
 * Camps are per-party persistent structures in the world:
 *   - Tier 1 (Campfire): Respawn point + fast-travel anchor
 *   - Tier 2 (Small Camp): + Shared storage chest (8 slots)
 *   - Tier 3 (Full Camp): + Crafting station, cooking fire, 16-slot storage
 *
 * Rules:
 *   - Max 3 camps per party
 *   - Camps persist in PostgreSQL (party_camps table)
 *   - Only party members can interact with a party's camps
 *   - Camp placement requires a campfire_kit item
 *   - Upgrades require crafting materials
 */

import { Op, WORLD_CHUNK_SIZE } from "@madworld/shared";
import { db } from "../db/index.js";
import { partyCamps } from "../db/schema.js";
import { eq, and } from "drizzle-orm";

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
}

export interface CampSlot {
  itemId: string;
  quantity: number;
}

const MAX_CAMPS_PER_PARTY = 3;
const STORAGE_SLOTS_BY_TIER: Record<number, number> = { 1: 0, 2: 8, 3: 16 };

export class CampManager {
  /** In-memory cache: partyId → Camp[] */
  private campsByParty = new Map<string, Camp[]>();

  /**
   * Load all camps for a party from DB.
   */
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
    }));

    this.campsByParty.set(partyId, camps);
    return camps;
  }

  /**
   * Place a new camp at the given world position.
   */
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

    // Check minimum distance between camps (10 tiles)
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
    };

    camps.push(camp);
    return camp;
  }

  /**
   * Upgrade a camp to the next tier.
   */
  async upgradeCamp(campId: number, partyId: string): Promise<Camp | { error: string }> {
    const camps = await this.loadPartyCamps(partyId);
    const camp = camps.find((c) => c.id === campId);
    if (!camp) return { error: "Camp not found." };
    if (camp.tier >= 3) return { error: "Camp already at max tier." };

    camp.tier += 1;
    await db
      .update(partyCamps)
      .set({ tier: camp.tier })
      .where(eq(partyCamps.id, campId));

    return camp;
  }

  /**
   * Store an item in camp storage.
   */
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

    // Try to stack with existing
    const existing = camp.storage.find((s) => s.itemId === itemId);
    if (existing) {
      existing.quantity += quantity;
    } else {
      if (camp.storage.length >= maxSlots) {
        return { error: "Camp storage is full." };
      }
      camp.storage.push({ itemId, quantity });
    }

    await this.persistStorage(campId, camp.storage);
    return camp.storage;
  }

  /**
   * Withdraw an item from camp storage.
   */
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

    await this.persistStorage(campId, camp.storage);
    return camp.storage;
  }

  /**
   * Remove a camp (e.g., party leader demolishes it).
   */
  async removeCamp(campId: number, partyId: string): Promise<boolean> {
    const camps = await this.loadPartyCamps(partyId);
    const idx = camps.findIndex((c) => c.id === campId);
    if (idx === -1) return false;

    camps.splice(idx, 1);
    await db.delete(partyCamps).where(eq(partyCamps.id, campId));
    return true;
  }

  /**
   * Get all camps for a party (from cache).
   */
  getCamps(partyId: string): Camp[] {
    return this.campsByParty.get(partyId) ?? [];
  }

  /**
   * Find the nearest camp to a position (for respawn).
   */
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

  /** Evict cache when party dissolves. */
  evictParty(partyId: string): void {
    this.campsByParty.delete(partyId);
  }

  private async persistStorage(campId: number, storage: CampSlot[]): Promise<void> {
    await db
      .update(partyCamps)
      .set({ storage })
      .where(eq(partyCamps.id, campId));
  }
}
