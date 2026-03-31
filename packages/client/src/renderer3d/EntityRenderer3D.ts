import * as THREE from "three";
import { TILE_SIZE, EntityType } from "@madworld/shared";
import { useGameStore, type RemoteEntity } from "../state/GameStore.js";
import { getEntityTexture3D, isBossMob, getMobSize } from "./SpriteBakery.js";
import {
  createAnimState,
  updateAnimation,
  triggerAttack,
  triggerDeath,
  getAnimName,
  type AnimState,
} from "../renderer/AnimationController.js";
import {
  createNameLabel,
  createHPBar,
  createQuestMarker,
  type HPBarOverlay,
} from "./EntityOverlays.js";
import type { ThreeApp } from "./ThreeApp.js";

interface Entity3D {
  group: THREE.Group; // root group in scene
  sprite: THREE.Sprite;
  shadow: THREE.Mesh;
  nameLabel: THREE.Object3D;
  hpBar: HPBarOverlay | null;
  questMarker: THREE.Object3D | null;
  targetRing: THREE.Mesh | null;
  animState: AnimState;
  isLocal: boolean;
  isBoss: boolean;
  isGod: boolean;
  entityType: EntityType;
  lastX: number;
  lastY: number;
}

// Shadow geometry (shared across all entities)
let sharedShadowGeo: THREE.CircleGeometry | null = null;
let sharedShadowMat: THREE.MeshBasicMaterial | null = null;

function getShadowGeo(): THREE.CircleGeometry {
  if (!sharedShadowGeo) {
    sharedShadowGeo = new THREE.CircleGeometry(0.35, 12);
    sharedShadowGeo.rotateX(-Math.PI / 2);
  }
  return sharedShadowGeo;
}

function getShadowMat(): THREE.MeshBasicMaterial {
  if (!sharedShadowMat) {
    sharedShadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
    });
  }
  return sharedShadowMat;
}

// Target ring geometry (shared)
let sharedRingGeo: THREE.RingGeometry | null = null;

function getRingGeo(): THREE.RingGeometry {
  if (!sharedRingGeo) {
    sharedRingGeo = new THREE.RingGeometry(0.6, 0.75, 32);
    sharedRingGeo.rotateX(-Math.PI / 2);
  }
  return sharedRingGeo;
}

/**
 * Three.js entity renderer. Manages billboarded sprites for all entities
 * (players, mobs, NPCs, pets, ground items) with CSS2D overlays for text.
 */
export class EntityRenderer3D {
  private app: ThreeApp;
  private entities = new Map<number, Entity3D>();
  private globalTimer = 0;
  private hoveredEid: number | null = null;
  private selectedEid: number | null = null;

  // Sun angle for shadow projection (0=dawn, 0.5=noon, 1=dusk)
  private sunAngle = 0.5;

  constructor(app: ThreeApp) {
    this.app = app;
  }

  /** Set the current sun position for shadow projection */
  setSunTime(t: number): void {
    this.sunAngle = t;
  }

  /** Set which entity is currently hovered */
  setHovered(eid: number | null): void {
    this.hoveredEid = eid;
  }

  /** Set which entity is currently selected/targeted */
  setSelected(eid: number | null): void {
    // Remove old target ring
    if (this.selectedEid !== null && this.selectedEid !== eid) {
      const old = this.entities.get(this.selectedEid);
      if (old?.targetRing) {
        old.group.remove(old.targetRing);
        old.targetRing = null;
      }
    }
    this.selectedEid = eid;
  }

  /** Create or update an entity at the given world position */
  updateEntity(
    eid: number,
    worldX: number,
    worldY: number,
    entity: RemoteEntity,
    dt: number,
  ): void {
    let e = this.entities.get(eid);
    if (!e) {
      e = this.createEntity(eid, entity);
    }

    // Update texture if needed (e.g. equipment change)
    // (For now, texture is set on creation only)

    // Position in 3D world (game Y -> Three.js Z)
    e.group.position.set(worldX, 0, worldY);

    // Animation
    const anim = updateAnimation(e.animState, dt, worldX, worldY);

    // Apply animation to sprite
    const baseScale = this.getEntityScale(entity, e.isBoss, e.isGod);
    e.sprite.scale.set(
      baseScale.x * anim.scaleX * (e.animState.facingLeft ? -1 : 1),
      baseScale.y * anim.scaleY,
      1,
    );
    e.sprite.position.set(
      anim.offsetX * 0.03, // Scale down offsets from pixel space to world units
      baseScale.y / 2 + anim.offsetY * 0.03,
      0,
    );
    e.sprite.material.opacity = anim.alpha;
    e.sprite.material.rotation = anim.rotation;

    // Hover highlight
    if (eid === this.hoveredEid) {
      e.sprite.material.opacity = Math.min(1, anim.alpha + 0.15);
    }

    // Shadow
    const shadowScale = e.isBoss ? 1.5 : e.entityType === EntityType.NPC ? 0.7 : 0.6;
    e.shadow.scale.set(shadowScale, shadowScale, shadowScale);
    // Shadow offset based on sun angle
    const sunX = Math.cos(this.sunAngle * Math.PI) * 0.3;
    const sunZ = 0.15;
    e.shadow.position.set(sunX, 0.02, sunZ);
    (e.shadow.material as THREE.MeshBasicMaterial).opacity = 0.25 + Math.sin(this.sunAngle * Math.PI) * 0.1;

    // HP bar
    if (e.hpBar && entity.hp !== undefined && entity.maxHp !== undefined) {
      e.hpBar.update(entity.hp, entity.maxHp);
      // Hide HP bar if full health (for mobs/pets)
      const isFullHp = entity.hp >= entity.maxHp;
      e.hpBar.object.visible = !isFullHp || e.entityType === EntityType.PLAYER;
    }

    // Target ring
    if (eid === this.selectedEid) {
      if (!e.targetRing) {
        const ringMat = new THREE.MeshBasicMaterial({
          color: e.entityType === EntityType.NPC ? 0xffd700 :
                 e.entityType === EntityType.MOB ? 0xff4444 : 0x44ff44,
          transparent: true,
          opacity: 0.5,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        e.targetRing = new THREE.Mesh(getRingGeo(), ringMat);
        e.targetRing.position.y = 0.03;
        e.group.add(e.targetRing);
      }
      // Pulse opacity
      const pulse = 0.3 + Math.sin(this.globalTimer * 4) * 0.2;
      (e.targetRing.material as THREE.MeshBasicMaterial).opacity = pulse;
    } else if (e.targetRing) {
      e.group.remove(e.targetRing);
      e.targetRing = null;
    }

    // Quest marker bob animation
    if (e.questMarker) {
      e.questMarker.position.y = 3.0 + Math.sin(this.globalTimer * 2) * 0.15;
    }

    e.lastX = worldX;
    e.lastY = worldY;
  }

  /** Trigger attack animation on an entity */
  attackEntity(eid: number): void {
    const e = this.entities.get(eid);
    if (e) triggerAttack(e.animState);
  }

  /** Trigger death animation on an entity */
  killEntity(eid: number): void {
    const e = this.entities.get(eid);
    if (e) triggerDeath(e.animState);
  }

  /** Remove an entity */
  removeEntity(eid: number): void {
    const e = this.entities.get(eid);
    if (!e) return;

    this.app.entityGroup.remove(e.group);
    e.sprite.material.dispose();
    if (e.hpBar) e.hpBar.dispose();
    this.entities.delete(eid);
  }

  /** Update global timer (call once per frame) */
  update(dt: number): void {
    this.globalTimer += dt;
  }

  /** Prune entities not in the active set */
  pruneStale(activeEids: Set<number>): void {
    for (const [eid, _e] of this.entities) {
      if (!activeEids.has(eid)) {
        this.removeEntity(eid);
      }
    }
  }

  /**
   * Get entity at screen position (for click/tap detection).
   * Uses distance-based check in world coordinates.
   */
  getEntityAtScreen(
    worldX: number,
    worldY: number,
    maxDist = 1.5,
  ): number | null {
    let closest: number | null = null;
    let closestDist = maxDist;

    for (const [eid, e] of this.entities) {
      if (e.isLocal) continue;
      const dx = e.lastX - worldX;
      const dy = e.lastY - worldY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < closestDist) {
        closestDist = dist;
        closest = eid;
      }
    }
    return closest;
  }

  /** Get the world position of an entity (for overlays, particles) */
  getEntityPos(eid: number): { x: number; y: number } | null {
    const e = this.entities.get(eid);
    if (!e) return null;
    return { x: e.lastX, y: e.lastY };
  }

  // ── Private helpers ──

  private createEntity(eid: number, entity: RemoteEntity): Entity3D {
    const state = useGameStore.getState();
    const isLocal = state.localPlayer?.eid === eid;
    const isBoss = entity.type === EntityType.MOB && isBossMob(entity.name ?? "");
    const isGod = entity.isGod ?? false;

    // Root group
    const group = new THREE.Group();

    // Get texture from sprite bakery
    const texture = getEntityTexture3D(
      entity.type,
      entity.name,
      entity.appearance,
      entity.equipment,
    );

    // Billboard sprite
    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: true,
      alphaTest: 0.1,
    });
    const sprite = new THREE.Sprite(spriteMat);
    const baseScale = this.getEntityScale(entity, isBoss, isGod);
    sprite.scale.set(baseScale.x, baseScale.y, 1);
    sprite.position.y = baseScale.y / 2; // Bottom of sprite at ground level
    group.add(sprite);

    // Shadow
    const shadow = new THREE.Mesh(getShadowGeo(), getShadowMat().clone());
    shadow.position.y = 0.02;
    shadow.renderOrder = -1;
    group.add(shadow);

    // Name label (CSS2D)
    const nameLabel = createNameLabel(
      entity.name ?? "Unknown",
      entity.type,
      isLocal,
      isGod,
      entity.level,
    );
    group.add(nameLabel);

    // HP bar
    let hpBar: HPBarOverlay | null = null;
    if (entity.type !== EntityType.GROUND_ITEM) {
      hpBar = createHPBar();
      group.add(hpBar.object);
      if (entity.hp !== undefined && entity.maxHp !== undefined) {
        hpBar.update(entity.hp, entity.maxHp);
      }
    }

    // Quest marker for NPCs
    let questMarker: THREE.Object3D | null = null;
    if (entity.type === EntityType.NPC) {
      questMarker = createQuestMarker();
      group.add(questMarker);
    }

    // NPC golden shadow tint
    if (entity.type === EntityType.NPC) {
      (shadow.material as THREE.MeshBasicMaterial).color.set(0x8b6914);
      (shadow.material as THREE.MeshBasicMaterial).opacity = 0.2;
    }

    // Add to scene
    group.position.set(entity.x, 0, entity.y);
    this.app.entityGroup.add(group);

    const e: Entity3D = {
      group,
      sprite,
      shadow,
      nameLabel,
      hpBar,
      questMarker,
      targetRing: null,
      animState: createAnimState(),
      isLocal,
      isBoss,
      isGod,
      entityType: entity.type,
      lastX: entity.x,
      lastY: entity.y,
    };

    this.entities.set(entity.eid, e);
    return e;
  }

  private getEntityScale(
    entity: RemoteEntity,
    isBoss: boolean,
    isGod: boolean,
  ): { x: number; y: number } {
    switch (entity.type) {
      case EntityType.PLAYER:
        return isGod ? { x: 2.5, y: 3.2 } : { x: 1.8, y: 2.3 };
      case EntityType.MOB: {
        const size = getMobSize(entity.name ?? "");
        const baseScale = isBoss ? 3.0 : 1.8;
        return {
          x: (size.w / 28) * baseScale,
          y: (size.h / 28) * baseScale,
        };
      }
      case EntityType.NPC:
        return { x: 1.8, y: 2.2 };
      case EntityType.PET:
        return { x: 1.3, y: 1.3 };
      case EntityType.GROUND_ITEM:
        return { x: 0.8, y: 0.8 };
      default:
        return { x: 1.5, y: 1.5 };
    }
  }

  dispose(): void {
    for (const eid of [...this.entities.keys()]) {
      this.removeEntity(eid);
    }
  }
}
