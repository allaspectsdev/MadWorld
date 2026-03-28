/**
 * Binary codec for high-frequency messages.
 *
 * Only the hottest messages get binary encoding. Everything else
 * stays JSON. The first byte of every binary message is the opcode,
 * which lets the receiver distinguish binary from JSON (JSON always
 * starts with '{' = 0x7B, which doesn't collide with any opcode).
 *
 * Layout (all little-endian):
 *
 *   S_ENTITY_MOVE (0x93): 29 bytes
 *     [0]    u8   opcode
 *     [1-4]  u32  eid
 *     [5-8]  f32  x
 *     [9-12] f32  y
 *     [13-16] f32 dx
 *     [17-20] f32 dy
 *     [21-24] f32 speed
 *     [25-28] u32 seq
 *
 *   S_ENTITY_STOP (0x94): 13 bytes
 *     [0]    u8   opcode
 *     [1-4]  u32  eid
 *     [5-8]  f32  x
 *     [9-12] f32  y
 *
 *   S_TICK (0xF0): 13 bytes
 *     [0]    u8   opcode
 *     [1-4]  u32  tick
 *     [5-12] f64  serverTime
 *
 *   S_PONG (0xF1): 13 bytes
 *     [0]    u8   opcode
 *     [1-4]  u32  t (client timestamp low bits)
 *     [5-12] f64  serverTime
 *
 *   S_DAMAGE (0xA0): 18 bytes
 *     [0]    u8   opcode
 *     [1-4]  u32  sourceEid
 *     [5-8]  u32  targetEid
 *     [9-12] u32  amount
 *     [13]   u8   isCrit (0 or 1)
 *     [14-17] u32 targetHpAfter
 */

import { Op } from "./opcodes.js";

/** Opcodes that use binary encoding on the hot path. */
export const BINARY_OPCODES = new Set<number>([
  Op.S_ENTITY_MOVE,
  Op.S_ENTITY_STOP,
  Op.S_TICK,
  Op.S_PONG,
  Op.S_DAMAGE,
]);

// ---- Encode (server side) ----

export function encodeEntityMove(
  eid: number, x: number, y: number,
  dx: number, dy: number, speed: number, seq: number,
): ArrayBuffer {
  const buf = new ArrayBuffer(29);
  const view = new DataView(buf);
  view.setUint8(0, Op.S_ENTITY_MOVE);
  view.setUint32(1, eid, true);
  view.setFloat32(5, x, true);
  view.setFloat32(9, y, true);
  view.setFloat32(13, dx, true);
  view.setFloat32(17, dy, true);
  view.setFloat32(21, speed, true);
  view.setUint32(25, seq, true);
  return buf;
}

export function encodeEntityStop(eid: number, x: number, y: number): ArrayBuffer {
  const buf = new ArrayBuffer(13);
  const view = new DataView(buf);
  view.setUint8(0, Op.S_ENTITY_STOP);
  view.setUint32(1, eid, true);
  view.setFloat32(5, x, true);
  view.setFloat32(9, y, true);
  return buf;
}

export function encodeTick(tick: number, serverTime: number): ArrayBuffer {
  const buf = new ArrayBuffer(13);
  const view = new DataView(buf);
  view.setUint8(0, Op.S_TICK);
  view.setUint32(1, tick, true);
  view.setFloat64(5, serverTime, true);
  return buf;
}

export function encodePong(t: number, serverTime: number): ArrayBuffer {
  const buf = new ArrayBuffer(13);
  const view = new DataView(buf);
  view.setUint8(0, Op.S_PONG);
  view.setUint32(1, t, true);
  view.setFloat64(5, serverTime, true);
  return buf;
}

export function encodeDamage(
  sourceEid: number, targetEid: number, amount: number,
  isCrit: boolean, targetHpAfter: number,
): ArrayBuffer {
  const buf = new ArrayBuffer(18);
  const view = new DataView(buf);
  view.setUint8(0, Op.S_DAMAGE);
  view.setUint32(1, sourceEid, true);
  view.setUint32(5, targetEid, true);
  view.setUint32(9, amount, true);
  view.setUint8(13, isCrit ? 1 : 0);
  view.setUint32(14, targetHpAfter, true);
  return buf;
}

// ---- Decode (client side) ----

export interface DecodedEntityMove {
  op: typeof Op.S_ENTITY_MOVE;
  d: { eid: number; x: number; y: number; dx: number; dy: number; speed: number; seq: number };
}

export interface DecodedEntityStop {
  op: typeof Op.S_ENTITY_STOP;
  d: { eid: number; x: number; y: number };
}

export interface DecodedTick {
  op: typeof Op.S_TICK;
  d: { tick: number; serverTime: number };
}

export interface DecodedPong {
  op: typeof Op.S_PONG;
  d: { t: number; serverTime: number };
}

export interface DecodedDamage {
  op: typeof Op.S_DAMAGE;
  d: { sourceEid: number; targetEid: number; amount: number; isCrit: boolean; targetHpAfter: number };
}

export type DecodedBinaryMessage =
  | DecodedEntityMove
  | DecodedEntityStop
  | DecodedTick
  | DecodedPong
  | DecodedDamage;

/**
 * Attempt to decode a binary message. Returns null if the data
 * is not a recognized binary message (caller should fall through to JSON).
 */
export function decodeBinary(data: ArrayBuffer): DecodedBinaryMessage | null {
  if (data.byteLength < 1) return null;
  const view = new DataView(data);
  const op = view.getUint8(0);

  switch (op) {
    case Op.S_ENTITY_MOVE: {
      if (data.byteLength < 29) return null;
      return {
        op: Op.S_ENTITY_MOVE,
        d: {
          eid: view.getUint32(1, true),
          x: view.getFloat32(5, true),
          y: view.getFloat32(9, true),
          dx: view.getFloat32(13, true),
          dy: view.getFloat32(17, true),
          speed: view.getFloat32(21, true),
          seq: view.getUint32(25, true),
        },
      };
    }
    case Op.S_ENTITY_STOP: {
      if (data.byteLength < 13) return null;
      return {
        op: Op.S_ENTITY_STOP,
        d: {
          eid: view.getUint32(1, true),
          x: view.getFloat32(5, true),
          y: view.getFloat32(9, true),
        },
      };
    }
    case Op.S_TICK: {
      if (data.byteLength < 13) return null;
      return {
        op: Op.S_TICK,
        d: {
          tick: view.getUint32(1, true),
          serverTime: view.getFloat64(5, true),
        },
      };
    }
    case Op.S_PONG: {
      if (data.byteLength < 13) return null;
      return {
        op: Op.S_PONG,
        d: {
          t: view.getUint32(1, true),
          serverTime: view.getFloat64(5, true),
        },
      };
    }
    case Op.S_DAMAGE: {
      if (data.byteLength < 18) return null;
      return {
        op: Op.S_DAMAGE,
        d: {
          sourceEid: view.getUint32(1, true),
          targetEid: view.getUint32(5, true),
          amount: view.getUint32(9, true),
          isCrit: view.getUint8(13) === 1,
          targetHpAfter: view.getUint32(14, true),
        },
      };
    }
    default:
      return null;
  }
}
