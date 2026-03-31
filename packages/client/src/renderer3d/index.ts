// Phase 0: Foundation
export { ThreeApp } from "./ThreeApp.js";
export { Camera3D } from "./Camera3D.js";
export {
  initSpriteBakery,
  getMobTexture3D,
  getPlayerTexture3D,
  getGroundItemTexture3D,
  getEntityTexture3D,
  invalidatePlayerTexture,
  isBossMob,
  getMobSize,
} from "./SpriteBakery.js";

// Phase 1: Terrain + Sky
export { TerrainChunk, createFarLODMesh } from "./TerrainChunk.js";
export { TerrainManager } from "./TerrainManager.js";
export { createWaterMesh, type WaterMesh } from "./WaterShader.js";
export { SkyDome } from "./SkyDome.js";

// Phase 2: Entities
export { EntityRenderer3D } from "./EntityRenderer3D.js";
export {
  createNameLabel,
  createHPBar,
  createChatBubble,
  createHitSplat,
  createQuestMarker,
  type HPBarOverlay,
  type ChatBubbleOverlay,
  type HitSplatOverlay,
} from "./EntityOverlays.js";

// Phase 3: Decorations + Fog
export { DecorationRenderer3D } from "./DecorationRenderer3D.js";
export { FogOfWar3D } from "./FogOfWar3D.js";

// Phase 4: Lighting + Post-processing
export { LightingManager } from "./LightingManager.js";
export { PostProcessing } from "./PostProcessing.js";

// Phase 5: Particles + Effects
export { ParticleSystem3D, type EmitConfig } from "./ParticleSystem3D.js";
export { AmbientParticles3D, type ZoneType } from "./AmbientParticles3D.js";
export { TelegraphRenderer3D } from "./TelegraphRenderer3D.js";
