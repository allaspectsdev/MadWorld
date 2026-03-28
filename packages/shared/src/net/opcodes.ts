export enum Op {
  // ---- Client -> Server (0x00 - 0x7F) ----
  C_AUTH_LOGIN = 0x01,
  C_AUTH_REGISTER = 0x02,

  C_MOVE = 0x10,
  C_STOP = 0x11,
  C_GOD_TELEPORT = 0x12,

  C_ATTACK = 0x20,
  C_USE_SKILL = 0x21,
  C_PARTY_INVITE = 0x22,
  C_PARTY_ACCEPT = 0x23,
  C_PARTY_DECLINE = 0x24,
  C_PARTY_LEAVE = 0x25,
  C_PARTY_KICK = 0x26,
  C_DUNGEON_ENTER = 0x27,
  C_NPC_INTERACT = 0x28,
  C_QUEST_ACCEPT = 0x29,
  C_QUEST_TURN_IN = 0x2a,

  C_FISH_CAST = 0x30,
  C_FISH_REEL = 0x31,
  C_COOK_START = 0x32,
  C_GATHER_START = 0x33,    // Begin gathering at a resource node
  C_GATHER_ASSIST = 0x34,   // Assist another player at a co-op node
  C_CRAFT_START = 0x35,     // Begin crafting a recipe
  C_CRAFT_CONTRIBUTE = 0x36,// Contribute ingredient to combo craft

  C_INV_MOVE = 0x40,
  C_INV_DROP = 0x41,
  C_INV_USE = 0x42,
  C_EQUIP = 0x43,
  C_UNEQUIP = 0x44,
  C_PICKUP = 0x45,
  C_SHOP_BUY = 0x46,
  C_SHOP_SELL = 0x47,

  C_CHAT_SEND = 0x50,

  C_TRADE_REQUEST = 0x60,
  C_TRADE_ACCEPT = 0x61,
  C_TRADE_CANCEL = 0x62,
  C_TRADE_SET_ITEM = 0x63,
  C_TRADE_CONFIRM = 0x64,

  C_PLACE_CAMP = 0x68,       // Place a campfire/camp structure
  C_INTERACT_CAMP = 0x69,    // Open camp storage/crafting
  C_CAMP_STORE = 0x6a,       // Store item in camp chest
  C_CAMP_WITHDRAW = 0x6b,    // Withdraw item from camp chest
  C_FAST_TRAVEL = 0x6c,      // Fast-travel to a camp
  C_PLACE_FURNITURE = 0x6d,  // Place furniture in homestead
  C_REMOVE_FURNITURE = 0x6e, // Remove furniture from homestead
  C_GARDEN_PLANT = 0x6f,     // Plant a seed in a garden plot

  C_PING = 0x70,

  // ---- Server -> Client (0x80 - 0xFF) ----
  S_AUTH_OK = 0x81,
  S_AUTH_ERROR = 0x82,

  S_ENTER_ZONE = 0x90,
  S_ENTITY_SPAWN = 0x91,
  S_ENTITY_DESPAWN = 0x92,
  S_ENTITY_MOVE = 0x93,
  S_ENTITY_STOP = 0x94,
  S_PLAYER_STATS = 0x95,

  S_DAMAGE = 0xa0,
  S_DEATH = 0xa1,
  S_RESPAWN = 0xa2,

  S_FISH_BITE = 0xa8,
  S_FISH_RESULT = 0xa9,
  S_COOK_RESULT = 0xaa,
  S_GATHER_START = 0xab,     // Gathering progress started
  S_GATHER_RESULT = 0xac,    // Gathering success/fail + loot
  S_GATHER_ASSIST_REQ = 0xad,// Node needs a second player
  S_CRAFT_RESULT = 0xae,     // Crafting result

  S_INV_UPDATE = 0xb0,
  S_EQUIP_UPDATE = 0xb1,

  S_XP_GAIN = 0xb8,
  S_LEVEL_UP = 0xb9,
  S_SKILL_COOLDOWN = 0xba,
  S_STATUS_EFFECT = 0xbb,
  S_ABILITY_LIST = 0xbc,
  S_SHOP_OPEN = 0xbd,

  S_CHAT_MESSAGE = 0xc0,
  S_SYSTEM_MESSAGE = 0xc1,

  S_TRADE_INCOMING = 0xc8,
  S_TRADE_START = 0xc9,
  S_TRADE_UPDATE = 0xca,
  S_TRADE_COMPLETE = 0xcb,
  S_TRADE_CANCELLED = 0xcc,

  S_PARTY_INVITE = 0xd0,
  S_PARTY_UPDATE = 0xd1,
  S_PARTY_DISSOLVED = 0xd2,
  S_PARTY_MEMBER_HP = 0xd3,
  S_DUNGEON_ENTER = 0xd4,
  S_DUNGEON_COMPLETE = 0xd5,
  S_DUNGEON_WIPE = 0xd6,
  S_DUNGEON_EXIT = 0xd7,
  S_BOSS_ABILITY = 0xd8,
  S_NPC_DIALOG = 0xd9,
  S_QUEST_UPDATE = 0xda,
  S_QUEST_COMPLETE = 0xdb,
  S_QUEST_LIST = 0xdc,

  // Camp / homestead system
  S_CAMP_LIST = 0xbe,         // All camps owned by party
  S_CAMP_STORAGE = 0xbf,      // Camp chest contents
  S_CAMP_PLACED = 0xc2,       // Confirm camp placement
  S_HOMESTEAD_STATE = 0xc3,   // Full homestead state (furniture, gardens, visitor)
  S_FURNITURE_UPDATE = 0xc4,  // Furniture placed/removed
  S_GARDEN_UPDATE = 0xc5,     // Garden plant state changed
  S_VISITOR_ARRIVED = 0xc6,   // NPC visitor arrived at homestead

  // Procedural world / chunk streaming
  S_CHUNK_DATA = 0xe0,         // Server sends chunk tile data
  S_CHUNK_UNLOAD = 0xe1,       // Server tells client to unload a chunk
  S_DISCOVERY_UPDATE = 0xe2,   // New chunks discovered (fog reveal)
  S_DISCOVERY_INIT = 0xe3,     // Initial discovered chunk list on login

  S_TICK = 0xf0,
  S_PONG = 0xf1,
}
