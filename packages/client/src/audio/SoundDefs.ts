/** Maps logical sound names to asset paths */
export const SOUND_DEFS: Record<string, string> = {
  // Combat
  hit_melee: "/audio/sfx/hit_melee.ogg",
  hit_crit: "/audio/sfx/hit_crit.ogg",
  miss: "/audio/sfx/miss.ogg",
  player_death: "/audio/sfx/player_death.ogg",
  mob_death: "/audio/sfx/mob_death.ogg",

  swing: "/audio/sfx/swing.ogg",
  whoosh: "/audio/sfx/whoosh.ogg",

  // Feedback
  level_up: "/audio/sfx/level_up.ogg",
  xp_gain: "/audio/sfx/xp_tick.ogg",
  portal_enter: "/audio/sfx/portal_enter.ogg",
  chat_blip: "/audio/sfx/chat_blip.ogg",

  // Ambient loops
  ambient_village: "/audio/ambient/village_loop.ogg",
  ambient_forest: "/audio/ambient/forest_loop.ogg",
  ambient_dungeon: "/audio/ambient/dungeon_loop.ogg",
  ambient_fields: "/audio/ambient/fields_loop.ogg",

  // Music
  music_overworld: "/audio/music/overworld.ogg",
  music_dungeon: "/audio/music/dungeon.ogg",
  music_boss: "/audio/music/boss.ogg",
};

/** Zone name pattern → music track */
export const ZONE_MUSIC: Record<string, string> = {
  forest: "music_dungeon",
  darkwood: "music_dungeon",
};

/** Zone name pattern → ambient loop */
export const ZONE_AMBIENT: Record<string, string> = {
  forest: "ambient_forest",
  darkwood: "ambient_forest",
  field: "ambient_fields",
  greendale: "ambient_village",
  village: "ambient_village",
};
