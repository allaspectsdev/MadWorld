/**
 * GatheringSystem — handles resource node interaction including co-op gathering.
 *
 * Resource nodes are spawned by the ChunkManager in each chunk based on biome.
 * Players interact with nodes via C_GATHER_START. Co-op nodes require a second
 * player to send C_GATHER_ASSIST before the first player can complete.
 *
 * Flow:
 *   Solo node:
 *     1. Player sends C_GATHER_START { nodeEid }
 *     2. Server validates (skill level, proximity, node not depleted)
 *     3. Server sets player gathering state, sends S_GATHER_START
 *     4. After gatherTicks, server sends S_GATHER_RESULT with loot + XP
 *
 *   Co-op node:
 *     1. Player A sends C_GATHER_START { nodeEid }
 *     2. Server sends S_GATHER_ASSIST_REQ to nearby party members
 *     3. Player B sends C_GATHER_ASSIST { nodeEid }
 *     4. Server starts the gather timer for both
 *     5. After gatherTicks, both get S_GATHER_RESULT with enhanced loot
 */

import { Op, RESOURCE_NODES, type ResourceNodeDef } from "@madworld/shared";

/** Active gathering state for a player. */
export interface GatheringState {
  nodeId: string;           // Resource node definition ID
  nodeEid: number;          // Entity ID of the node being gathered
  startTick: number;        // Tick when gathering started
  completeTick: number;     // Tick when gathering completes
  isAssisting: boolean;     // Is this player the assistant (co-op)?
  partnerEid: number | null;// EID of co-op partner (if any)
}

/** Active resource node in the world. */
export interface ActiveNode {
  eid: number;
  nodeId: string;
  def: ResourceNodeDef;
  worldX: number;
  worldY: number;
  depleted: boolean;
  depletedAt: number;       // Tick when depleted
  /** EID of player currently gathering (null if free). */
  gatheringBy: number | null;
  /** EID of co-op assistant (null if not being assisted). */
  assistedBy: number | null;
  /** Whether the co-op requirement has been met. */
  coopReady: boolean;
}

/** Manages all active resource nodes and gathering state. */
export class GatheringSystem {
  /** All active resource nodes by EID. */
  private nodes = new Map<number, ActiveNode>();
  /** Player gathering states by player EID. */
  private playerStates = new Map<number, GatheringState>();
  private nextNodeEid = 100000; // Offset to avoid collision with entity EIDs

  /** Register a resource node in the world. */
  addNode(nodeId: string, worldX: number, worldY: number): number {
    const def = RESOURCE_NODES[nodeId];
    if (!def) return -1;

    const eid = this.nextNodeEid++;
    this.nodes.set(eid, {
      eid,
      nodeId,
      def,
      worldX,
      worldY,
      depleted: false,
      depletedAt: 0,
      gatheringBy: null,
      assistedBy: null,
      coopReady: false,
    });
    return eid;
  }

  /** Process a player starting to gather at a node. */
  startGather(
    playerEid: number,
    nodeEid: number,
    playerSkillLevel: number,
    playerX: number,
    playerY: number,
    currentTick: number,
    send: (msg: any) => void,
  ): GatheringState | null {
    const node = this.nodes.get(nodeEid);
    if (!node || node.depleted) {
      send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "This resource is depleted." } });
      return null;
    }

    // Check proximity (within 2 tiles)
    const dist = Math.sqrt((playerX - node.worldX) ** 2 + (playerY - node.worldY) ** 2);
    if (dist > 2.5) {
      send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "Too far away." } });
      return null;
    }

    // Check skill level
    if (playerSkillLevel < node.def.levelRequired) {
      send({ op: Op.S_SYSTEM_MESSAGE, d: { message: `Requires ${node.def.skill} level ${node.def.levelRequired}.` } });
      return null;
    }

    // Check if already being gathered by someone else (solo)
    if (node.gatheringBy !== null && node.gatheringBy !== playerEid) {
      if (!node.def.coopRequired) {
        send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "Someone else is gathering here." } });
        return null;
      }
      // For co-op nodes, this player becomes the assistant
      return this.assistGather(playerEid, nodeEid, currentTick, send);
    }

    // Start gathering
    node.gatheringBy = playerEid;

    if (node.def.coopRequired && !node.coopReady) {
      // Co-op node — need an assistant before timer starts
      send({
        op: Op.S_GATHER_START,
        d: { nodeEid, nodeId: node.nodeId, waitingForAssist: true, ticks: node.def.gatherTicks },
      });
      // Don't set a complete tick yet — waiting for assistant
      const state: GatheringState = {
        nodeId: node.nodeId,
        nodeEid,
        startTick: currentTick,
        completeTick: 0, // Will be set when assistant joins
        isAssisting: false,
        partnerEid: null,
      };
      this.playerStates.set(playerEid, state);
      return state;
    }

    // Solo node or co-op already has assist — start timer
    const completeTick = currentTick + node.def.gatherTicks;
    send({
      op: Op.S_GATHER_START,
      d: { nodeEid, nodeId: node.nodeId, waitingForAssist: false, ticks: node.def.gatherTicks },
    });

    const state: GatheringState = {
      nodeId: node.nodeId,
      nodeEid,
      startTick: currentTick,
      completeTick,
      isAssisting: false,
      partnerEid: null,
    };
    this.playerStates.set(playerEid, state);
    return state;
  }

  /** Process a player assisting at a co-op node. */
  assistGather(
    assistantEid: number,
    nodeEid: number,
    currentTick: number,
    send: (msg: any) => void,
  ): GatheringState | null {
    const node = this.nodes.get(nodeEid);
    if (!node || node.depleted || !node.def.coopRequired) return null;
    if (node.gatheringBy === null) return null;
    if (node.assistedBy !== null) {
      send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "Already being assisted." } });
      return null;
    }

    node.assistedBy = assistantEid;
    node.coopReady = true;

    // Now start the actual gathering timer for both players
    const completeTick = currentTick + node.def.gatherTicks;

    // Update the primary gatherer's state
    const primaryState = this.playerStates.get(node.gatheringBy);
    if (primaryState) {
      primaryState.completeTick = completeTick;
      primaryState.partnerEid = assistantEid;
    }

    // Create assistant's state
    const assistState: GatheringState = {
      nodeId: node.nodeId,
      nodeEid,
      startTick: currentTick,
      completeTick,
      isAssisting: true,
      partnerEid: node.gatheringBy,
    };
    this.playerStates.set(assistantEid, assistState);

    send({
      op: Op.S_GATHER_START,
      d: { nodeEid, nodeId: node.nodeId, waitingForAssist: false, ticks: node.def.gatherTicks },
    });

    return assistState;
  }

  /**
   * Process gathering completion each tick.
   * Returns array of { playerEid, results } for completed gathers.
   */
  processTick(
    currentTick: number,
  ): Array<{
    playerEid: number;
    nodeId: string;
    items: Array<{ itemId: string; quantity: number }>;
    xp: number;
    skill: string;
    coopCompleted: boolean;
  }> {
    const completed: Array<{
      playerEid: number;
      nodeId: string;
      items: Array<{ itemId: string; quantity: number }>;
      xp: number;
      skill: string;
      coopCompleted: boolean;
    }> = [];

    for (const [playerEid, state] of this.playerStates) {
      if (state.completeTick === 0) continue; // Waiting for co-op assist
      if (currentTick < state.completeTick) continue;

      const node = this.nodes.get(state.nodeEid);
      if (!node) {
        this.playerStates.delete(playerEid);
        continue;
      }

      const def = node.def;
      const isCoop = state.partnerEid !== null;

      // Calculate loot
      const items: Array<{ itemId: string; quantity: number }> = [];
      for (const y of def.yields) {
        const chance = y.chance ?? 1.0;
        if (Math.random() < chance) {
          items.push({ itemId: y.itemId, quantity: y.quantity });
        }
      }

      // Co-op bonus loot
      if (isCoop && def.coopBonus?.extraYield) {
        items.push({
          itemId: def.coopBonus.extraYield.itemId,
          quantity: def.coopBonus.extraYield.quantity,
        });
      }

      // Calculate XP
      let xp = def.xp;
      if (isCoop && def.coopBonus?.xpMultiplier) {
        xp = Math.floor(xp * def.coopBonus.xpMultiplier);
      }

      completed.push({
        playerEid,
        nodeId: def.id,
        items,
        xp,
        skill: def.skill,
        coopCompleted: isCoop,
      });

      // Clean up player state
      this.playerStates.delete(playerEid);

      // Deplete node (only once, even for co-op pair)
      if (!state.isAssisting) {
        node.depleted = true;
        node.depletedAt = currentTick;
        node.gatheringBy = null;
        node.assistedBy = null;
        node.coopReady = false;
      }
    }

    // Process respawns
    for (const node of this.nodes.values()) {
      if (node.depleted && currentTick >= node.depletedAt + node.def.respawnTicks) {
        node.depleted = false;
      }
    }

    return completed;
  }

  /** Cancel gathering for a player (moved, attacked, disconnected). */
  cancelGather(playerEid: number): void {
    const state = this.playerStates.get(playerEid);
    if (!state) return;

    const node = this.nodes.get(state.nodeEid);
    if (node) {
      if (node.gatheringBy === playerEid) {
        node.gatheringBy = null;
        // Also cancel partner if co-op
        if (node.assistedBy !== null) {
          this.playerStates.delete(node.assistedBy);
          node.assistedBy = null;
          node.coopReady = false;
        }
      } else if (node.assistedBy === playerEid) {
        node.assistedBy = null;
        node.coopReady = false;
        // Reset primary gatherer's completion time
        const primaryState = this.playerStates.get(node.gatheringBy!);
        if (primaryState) {
          primaryState.completeTick = 0; // Back to waiting
          primaryState.partnerEid = null;
        }
      }
    }

    this.playerStates.delete(playerEid);
  }

  /** Check if a player is currently gathering. */
  isGathering(playerEid: number): boolean {
    return this.playerStates.has(playerEid);
  }

  /** Get a node by EID. */
  getNode(eid: number): ActiveNode | undefined {
    return this.nodes.get(eid);
  }

  /** Remove all nodes (zone cleanup). */
  clear(): void {
    this.nodes.clear();
    this.playerStates.clear();
  }
}
