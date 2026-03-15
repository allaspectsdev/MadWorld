import { MAX_SKILL_LEVEL } from "../types/skill.js";

function computeXpTable(): number[] {
  const table: number[] = [0];
  let total = 0;
  for (let level = 1; level < MAX_SKILL_LEVEL; level++) {
    total += Math.floor(level + 300 * Math.pow(2, level / 7));
    table.push(Math.floor(total / 4));
  }
  return table;
}

/** XP_TABLE[level - 1] = total XP required to reach that level. XP_TABLE[0] = 0 (level 1). */
export const XP_TABLE = computeXpTable();

export function xpForLevel(level: number): number {
  if (level < 1) return 0;
  if (level > MAX_SKILL_LEVEL) return XP_TABLE[MAX_SKILL_LEVEL - 1];
  return XP_TABLE[level - 1];
}

export function levelForXp(xp: number): number {
  let low = 1;
  let high = MAX_SKILL_LEVEL;
  while (low < high) {
    const mid = Math.floor((low + high + 1) / 2);
    if (XP_TABLE[mid - 1] <= xp) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return low;
}
