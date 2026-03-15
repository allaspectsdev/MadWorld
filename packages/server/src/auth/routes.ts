import { Hono } from "hono";
import { db } from "../db/index.js";
import { users, players } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { signToken } from "./jwt.js";
import { ALL_SKILLS } from "@madworld/shared";
import { skills } from "../db/schema.js";

export const authRoutes = new Hono();

authRoutes.post("/api/register", async (c) => {
  const { email, password, displayName } = await c.req.json();

  if (!email || !password || !displayName) {
    return c.json({ error: "Missing fields" }, 400);
  }
  if (displayName.length < 3 || displayName.length > 24) {
    return c.json({ error: "Display name must be 3-24 characters" }, 400);
  }

  const passwordHash = await Bun.password.hash(password);

  try {
    const [user] = await db
      .insert(users)
      .values({ email, passwordHash, displayName })
      .returning({ id: users.id });

    // Create a player for the user
    const [player] = await db
      .insert(players)
      .values({ userId: user.id, name: displayName })
      .returning({ id: players.id });

    // Initialize all skills at 0 XP
    await db.insert(skills).values(
      ALL_SKILLS.map((skillId) => ({
        playerId: player.id,
        skillId,
        xp: 0,
      })),
    );

    const token = await signToken(user.id);
    return c.json({ token, playerId: player.id });
  } catch (err: any) {
    if (err.code === "23505") {
      return c.json({ error: "Email or name already taken" }, 409);
    }
    console.error("[Auth] Register error:", err);
    return c.json({ error: "Internal error" }, 500);
  }
});

authRoutes.post("/api/guest", async (c) => {
  try {
    const guestId = Math.random().toString(36).slice(2, 8);
    const guestEmail = `guest_${guestId}@madworld.local`;
    const guestName = `Guest_${guestId}`;
    const passwordHash = await Bun.password.hash(guestId);

    const [user] = await db
      .insert(users)
      .values({ email: guestEmail, passwordHash, displayName: guestName })
      .returning({ id: users.id });

    const [player] = await db
      .insert(players)
      .values({ userId: user.id, name: guestName })
      .returning({ id: players.id });

    await db.insert(skills).values(
      ALL_SKILLS.map((skillId) => ({
        playerId: player.id,
        skillId,
        xp: 0,
      })),
    );

    const token = await signToken(user.id);
    return c.json({ token, playerId: player.id });
  } catch (err: any) {
    console.error("[Auth] Guest error:", err);
    return c.json({ error: "Failed to create guest account" }, 500);
  }
});

authRoutes.post("/api/login", async (c) => {
  const { email, password } = await c.req.json();

  if (!email || !password) {
    return c.json({ error: "Missing fields" }, 400);
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const valid = await Bun.password.verify(password, user.passwordHash);
  if (!valid) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  if (user.isBanned) {
    return c.json({ error: "Account banned" }, 403);
  }

  const [player] = await db
    .select()
    .from(players)
    .where(eq(players.userId, user.id))
    .limit(1);

  if (!player) {
    return c.json({ error: "No character found" }, 404);
  }

  await db
    .update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, user.id));

  const token = await signToken(user.id);
  return c.json({ token, playerId: player.id });
});
