/**
 * PetManager — handles pet taming, summoning, bond XP, and persistence.
 *
 * Pets are stored in player_pets table and cached per-player in memory.
 * Only one pet can be active at a time per player.
 */

import {
  PETS,
  petBondLevel,
  petAbilityValue,
  PET_PASSIVE_BOND_XP_PER_TICK,
  PET_MAX_BOND_LEVEL,
  Op,
  type PetState,
  type ServerMessage,
} from "@madworld/shared";
import { db } from "../db/index.js";
import { playerPets } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { Pet } from "./entities/Pet.js";
import { world } from "./World.js";

class PetManager {
  /** playerId → PetState[] */
  private cache = new Map<number, PetState[]>();
  /** playerEid → Pet entity (active pet in the world) */
  private activePets = new Map<number, Pet>();

  // ---- Load / Save ----

  async loadPlayerPets(playerId: number): Promise<PetState[]> {
    const cached = this.cache.get(playerId);
    if (cached) return cached;

    const rows = await db
      .select()
      .from(playerPets)
      .where(eq(playerPets.playerId, playerId));

    const pets: PetState[] = rows.map((r) => ({
      petId: r.petId,
      name: r.name,
      bondXp: r.bondXp,
      bondLevel: petBondLevel(r.petId, r.bondXp),
      isActive: r.isActive,
    }));

    this.cache.set(playerId, pets);
    return pets;
  }

  private async persistPet(playerId: number, pet: PetState): Promise<void> {
    await db
      .update(playerPets)
      .set({ bondXp: pet.bondXp, isActive: pet.isActive, name: pet.name })
      .where(and(eq(playerPets.playerId, playerId), eq(playerPets.petId, pet.petId)));
  }

  // ---- Tame ----

  async attemptTame(
    playerId: number,
    playerEid: number,
    targetMobId: string,
    playerX: number,
    playerY: number,
    zoneId: string,
    hasTreat: boolean,
    send: (msg: any) => void,
  ): Promise<boolean> {
    // Find pet def that matches this mob
    const petDef = Object.values(PETS).find((p) => p.sourceMobId === targetMobId);
    if (!petDef) {
      send({ op: Op.S_PET_TAME_RESULT, d: { success: false, message: "This creature can't be tamed." } } satisfies ServerMessage);
      return false;
    }

    if (!hasTreat) {
      send({ op: Op.S_PET_TAME_RESULT, d: { success: false, message: `You need ${petDef.treatItemId} to tame this creature.` } } satisfies ServerMessage);
      return false;
    }

    // Check if already owned
    const pets = await this.loadPlayerPets(playerId);
    if (pets.find((p) => p.petId === petDef.id)) {
      send({ op: Op.S_PET_TAME_RESULT, d: { success: false, message: "You already have this pet." } } satisfies ServerMessage);
      return false;
    }

    // Roll tame chance
    if (Math.random() > petDef.tameChance) {
      send({ op: Op.S_PET_TAME_RESULT, d: { success: false, message: `${petDef.name} resisted! Try again.` } } satisfies ServerMessage);
      return false; // Treat consumed anyway
    }

    // Success!
    const name = petDef.name;
    const pet: PetState = {
      petId: petDef.id,
      name,
      bondXp: 0,
      bondLevel: 1,
      isActive: false,
    };

    pets.push(pet);

    await db.insert(playerPets).values({
      playerId,
      petId: petDef.id,
      name,
      bondXp: 0,
      isActive: false,
    }).onConflictDoNothing();

    send({
      op: Op.S_PET_TAME_RESULT,
      d: { success: true, petId: petDef.id, petName: name, message: `You tamed a ${petDef.name}!` },
    } satisfies ServerMessage);

    return true;
  }

  // ---- Summon / Dismiss ----

  async summonPet(
    playerId: number,
    playerEid: number,
    petId: string,
    playerX: number,
    playerY: number,
    zoneId: string,
    send: (msg: any) => void,
  ): Promise<void> {
    const pets = await this.loadPlayerPets(playerId);
    const petState = pets.find((p) => p.petId === petId);
    if (!petState) {
      send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "You don't have that pet." } } satisfies ServerMessage);
      return;
    }

    // Dismiss current active pet first
    this.dismissActivePet(playerEid, zoneId);

    if (petState.isActive) {
      // Toggle off
      petState.isActive = false;
      await this.persistPet(playerId, petState);
      send({ op: Op.S_PET_UPDATE, d: { petId, name: petState.name, bondXp: petState.bondXp, bondLevel: petState.bondLevel, isActive: false } } satisfies ServerMessage);
      return;
    }

    // Deactivate all others
    for (const p of pets) {
      if (p.isActive) {
        p.isActive = false;
        await this.persistPet(playerId, p);
      }
    }

    // Activate
    petState.isActive = true;
    await this.persistPet(playerId, petState);

    // Spawn pet entity in the world
    const def = PETS[petId];
    if (def) {
      const petEntity = new Pet(def, playerEid, petState.name, petState.bondXp, zoneId, playerX + 1, playerY);
      const zone = world.getZone(zoneId);
      if (zone) {
        zone.addEntity(petEntity);
        this.activePets.set(playerEid, petEntity);
      }
    }

    send({ op: Op.S_PET_UPDATE, d: { petId, name: petState.name, bondXp: petState.bondXp, bondLevel: petState.bondLevel, isActive: true } } satisfies ServerMessage);
  }

  private dismissActivePet(playerEid: number, zoneId: string): void {
    const existing = this.activePets.get(playerEid);
    if (existing) {
      const zone = world.getZone(existing.zoneId);
      if (zone) zone.removeEntity(existing.eid);
      this.activePets.delete(playerEid);
    }
  }

  // ---- Bond XP ----

  /**
   * Award passive bond XP to all active pets. Call every tick.
   */
  processTickBondXp(): void {
    for (const [playerEid, petEntity] of this.activePets) {
      petEntity.bondXp += PET_PASSIVE_BOND_XP_PER_TICK;
    }
  }

  /**
   * Award bonus bond XP for an event. Returns new bond level if leveled up.
   */
  awardBondXp(playerEid: number, amount: number): number | null {
    const pet = this.activePets.get(playerEid);
    if (!pet) return null;

    const oldLevel = petBondLevel(pet.def.id, pet.bondXp);
    pet.bondXp += amount;
    const newLevel = petBondLevel(pet.def.id, pet.bondXp);

    if (newLevel > oldLevel) return newLevel;
    return null;
  }

  /**
   * Move active pet to follow player. Call each tick after movement.
   */
  updatePetPositions(): void {
    for (const [playerEid, pet] of this.activePets) {
      const player = world.getPlayer(playerEid);
      if (!player) {
        this.dismissActivePet(playerEid, pet.zoneId);
        continue;
      }

      // Follow player — lerp toward player position
      const dx = player.x - pet.x;
      const dy = player.y - pet.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 1.5) {
        // Move toward player
        const moveSpeed = pet.speed * 0.1; // dt = 0.1 (100ms tick)
        const mx = (dx / dist) * Math.min(moveSpeed, dist - 1);
        const my = (dy / dist) * Math.min(moveSpeed, dist - 1);
        pet.x += mx;
        pet.y += my;

        // Update zone spatial
        const zone = world.getZone(pet.zoneId);
        if (zone) zone.moveEntity(pet.eid, pet.x, pet.y);
      }
    }
  }

  /** Get the active pet for a player (if any). */
  getActivePet(playerEid: number): Pet | undefined {
    return this.activePets.get(playerEid);
  }

  /** Get the pet ability value for a player. */
  getAbilityValue(playerEid: number, ability: string): number {
    const pet = this.activePets.get(playerEid);
    if (!pet || pet.def.ability !== ability) return 0;
    const level = petBondLevel(pet.def.id, pet.bondXp);
    return petAbilityValue(pet.def.id, level);
  }

  // ---- Rename ----

  async renamePet(playerId: number, petId: string, newName: string, send: (msg: any) => void): Promise<void> {
    const pets = await this.loadPlayerPets(playerId);
    const pet = pets.find((p) => p.petId === petId);
    if (!pet) return;

    const sanitized = newName.replace(/<[^>]*>/g, "").trim().slice(0, 24);
    if (!sanitized) return;

    pet.name = sanitized;
    await this.persistPet(playerId, pet);
    send({ op: Op.S_PET_UPDATE, d: { petId, name: sanitized, bondXp: pet.bondXp, bondLevel: pet.bondLevel, isActive: pet.isActive } } satisfies ServerMessage);
  }

  // ---- Cleanup ----

  async saveAndCleanup(playerEid: number, playerId: number): Promise<void> {
    const pet = this.activePets.get(playerEid);
    if (pet) {
      // Persist final bond XP
      const pets = this.cache.get(playerId);
      const state = pets?.find((p) => p.petId === pet.def.id);
      if (state) {
        state.bondXp = Math.floor(pet.bondXp);
        await this.persistPet(playerId, state);
      }
      this.dismissActivePet(playerEid, pet.zoneId);
    }
    this.cache.delete(playerId);
  }
}

export const petManager = new PetManager();
