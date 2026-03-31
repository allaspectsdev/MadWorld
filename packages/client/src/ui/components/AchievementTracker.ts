/**
 * Client-side achievement tracking system.
 * Monitors game events and shows dramatic popups when milestones are reached.
 * Achievements persist in localStorage so they survive page reloads.
 */
import { useGameStore } from "../../state/GameStore.js";

interface AchievementDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: "combat" | "exploration" | "skills" | "social" | "misc";
}

const ACHIEVEMENTS: AchievementDef[] = [
  // Combat
  { id: "first_blood", name: "First Blood", description: "Defeat your first enemy", icon: "\u2694", category: "combat" },
  { id: "goblin_slayer", name: "Goblin Slayer", description: "Defeat 25 goblins", icon: "\uD83D\uDDE1", category: "combat" },
  { id: "boss_hunter", name: "Boss Hunter", description: "Defeat a boss monster", icon: "\uD83D\uDC80", category: "combat" },
  { id: "untouchable", name: "Untouchable", description: "Dodge 10 attacks with Dodge Roll", icon: "\uD83D\uDCA8", category: "combat" },
  { id: "critical_master", name: "Critical Master", description: "Land 50 critical hits", icon: "\u26A1", category: "combat" },
  { id: "combo_fighter", name: "Combo Fighter", description: "Use 3 abilities within 5 seconds", icon: "\uD83D\uDD25", category: "combat" },
  // Exploration
  { id: "first_steps", name: "First Steps", description: "Discover 5 map chunks", icon: "\uD83D\uDC63", category: "exploration" },
  { id: "cartographer", name: "Cartographer", description: "Discover 50 map chunks", icon: "\uD83D\uDDFA", category: "exploration" },
  { id: "world_explorer", name: "World Explorer", description: "Discover 200 map chunks", icon: "\uD83C\uDF0D", category: "exploration" },
  { id: "dungeon_delver", name: "Dungeon Delver", description: "Enter a dungeon", icon: "\uD83D\uDD73", category: "exploration" },
  // Skills
  { id: "level_5", name: "Getting Started", description: "Reach level 5 in any skill", icon: "\u2B50", category: "skills" },
  { id: "level_10", name: "Apprentice", description: "Reach level 10 in any skill", icon: "\uD83C\uDF1F", category: "skills" },
  { id: "level_25", name: "Journeyman", description: "Reach level 25 in any skill", icon: "\uD83D\uDCAA", category: "skills" },
  { id: "jack_of_trades", name: "Jack of All Trades", description: "Reach level 5 in 3 different skills", icon: "\uD83C\uDFAD", category: "skills" },
  { id: "gone_fishing", name: "Gone Fishing", description: "Catch your first fish", icon: "\uD83C\uDFA3", category: "skills" },
  // Social
  { id: "party_up", name: "Party Up!", description: "Join a party with another player", icon: "\uD83E\uDD1D", category: "social" },
  { id: "chatty", name: "Chatty", description: "Send 10 chat messages", icon: "\uD83D\uDCAC", category: "social" },
  { id: "emote_master", name: "Emote Master", description: "Use 5 different emotes", icon: "\uD83C\uDFAD", category: "social" },
  // Misc
  { id: "equipped", name: "Suited Up", description: "Equip an item for the first time", icon: "\uD83D\uDEE1", category: "misc" },
  { id: "pet_owner", name: "Pet Owner", description: "Tame your first pet", icon: "\uD83D\uDC3E", category: "misc" },
  { id: "shopper", name: "Window Shopper", description: "Buy something from a shop", icon: "\uD83D\uDED2", category: "misc" },
  { id: "survivor", name: "Survivor", description: "Respawn after dying", icon: "\u2764", category: "misc" },
];

const STORAGE_KEY = "madworld_achievements";

export class AchievementTracker {
  private unlocked = new Set<string>();
  private popupQueue: AchievementDef[] = [];
  private showingPopup = false;

  // Tracking counters
  private killCount = 0;
  private goblinKillCount = 0;
  private critCount = 0;
  private dodgeCount = 0;
  private chatCount = 0;
  private emotesUsed = new Set<string>();
  private abilityTimestamps: number[] = [];
  private maxSkillLevels = new Map<string, number>();
  private popupContainer: HTMLElement;

  constructor() {
    // Load from localStorage
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.unlocked) this.unlocked = new Set(data.unlocked);
        if (data.killCount) this.killCount = data.killCount;
        if (data.goblinKillCount) this.goblinKillCount = data.goblinKillCount;
        if (data.critCount) this.critCount = data.critCount;
        if (data.dodgeCount) this.dodgeCount = data.dodgeCount;
        if (data.chatCount) this.chatCount = data.chatCount;
        if (data.emotesUsed) this.emotesUsed = new Set(data.emotesUsed);
      }
    } catch { /* ignore */ }

    // Create popup container
    this.popupContainer = document.createElement("div");
    this.popupContainer.id = "achievement-popups";
    document.getElementById("ui-root")?.appendChild(this.popupContainer);
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        unlocked: [...this.unlocked],
        killCount: this.killCount,
        goblinKillCount: this.goblinKillCount,
        critCount: this.critCount,
        dodgeCount: this.dodgeCount,
        chatCount: this.chatCount,
        emotesUsed: [...this.emotesUsed],
      }));
    } catch { /* ignore */ }
  }

  private tryUnlock(id: string): void {
    if (this.unlocked.has(id)) return;
    const def = ACHIEVEMENTS.find(a => a.id === id);
    if (!def) return;
    this.unlocked.add(id);
    this.save();
    this.popupQueue.push(def);
    this.processQueue();
  }

  private processQueue(): void {
    if (this.showingPopup || this.popupQueue.length === 0) return;
    this.showingPopup = true;
    const achievement = this.popupQueue.shift()!;
    this.showPopup(achievement);
  }

  private showPopup(achievement: AchievementDef): void {
    const popup = document.createElement("div");
    popup.className = "achievement-popup";
    popup.innerHTML = `
      <div class="achievement-popup-icon">${achievement.icon}</div>
      <div class="achievement-popup-content">
        <div class="achievement-popup-title">Achievement Unlocked!</div>
        <div class="achievement-popup-name">${achievement.name}</div>
        <div class="achievement-popup-desc">${achievement.description}</div>
      </div>
    `;
    this.popupContainer.appendChild(popup);

    // Entrance animation
    requestAnimationFrame(() => popup.classList.add("visible"));

    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      popup.classList.remove("visible");
      popup.classList.add("exiting");
      setTimeout(() => {
        popup.remove();
        this.showingPopup = false;
        this.processQueue();
      }, 500);
    }, 4000);
  }

  // --- Event Hooks (call these from Dispatcher) ---

  onMobKill(mobName: string, isBoss: boolean): void {
    this.killCount++;
    if (this.killCount === 1) this.tryUnlock("first_blood");
    if (isBoss) this.tryUnlock("boss_hunter");

    if (mobName.toLowerCase().includes("goblin")) {
      this.goblinKillCount++;
      if (this.goblinKillCount >= 25) this.tryUnlock("goblin_slayer");
    }
    this.save();
  }

  onCriticalHit(): void {
    this.critCount++;
    if (this.critCount >= 50) this.tryUnlock("critical_master");
    this.save();
  }

  onDodgeRoll(): void {
    this.dodgeCount++;
    if (this.dodgeCount >= 10) this.tryUnlock("untouchable");
    this.save();
  }

  onAbilityUse(): void {
    const now = Date.now();
    this.abilityTimestamps.push(now);
    // Keep only last 5 seconds
    this.abilityTimestamps = this.abilityTimestamps.filter(t => now - t < 5000);
    if (this.abilityTimestamps.length >= 3) this.tryUnlock("combo_fighter");
  }

  onDiscovery(totalChunks: number): void {
    if (totalChunks >= 5) this.tryUnlock("first_steps");
    if (totalChunks >= 50) this.tryUnlock("cartographer");
    if (totalChunks >= 200) this.tryUnlock("world_explorer");
  }

  onEnterDungeon(): void {
    this.tryUnlock("dungeon_delver");
  }

  onLevelUp(skillId: string, level: number): void {
    this.maxSkillLevels.set(skillId, Math.max(this.maxSkillLevels.get(skillId) ?? 0, level));
    if (level >= 5) this.tryUnlock("level_5");
    if (level >= 10) this.tryUnlock("level_10");
    if (level >= 25) this.tryUnlock("level_25");

    // Jack of all trades: 3 skills at level 5+
    let count = 0;
    for (const [, lv] of this.maxSkillLevels) {
      if (lv >= 5) count++;
    }
    if (count >= 3) this.tryUnlock("jack_of_trades");
  }

  onFishCaught(): void {
    this.tryUnlock("gone_fishing");
  }

  onPartyJoin(): void {
    this.tryUnlock("party_up");
  }

  onChatSend(): void {
    this.chatCount++;
    if (this.chatCount >= 10) this.tryUnlock("chatty");
    this.save();
  }

  onEmoteUse(emoteId: string): void {
    this.emotesUsed.add(emoteId);
    if (this.emotesUsed.size >= 5) this.tryUnlock("emote_master");
    this.save();
  }

  onEquip(): void {
    this.tryUnlock("equipped");
  }

  onPetTame(): void {
    this.tryUnlock("pet_owner");
  }

  onShopBuy(): void {
    this.tryUnlock("shopper");
  }

  onRespawn(): void {
    this.tryUnlock("survivor");
  }
}
