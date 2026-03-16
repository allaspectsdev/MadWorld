export const config = {
  port: Number(process.env.SERVER_PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? "postgres://madworld:madworld_dev@localhost:5432/madworld",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  jwtSecret: process.env.JWT_SECRET ?? (process.env.NODE_ENV === "production" ? (() => { throw new Error("JWT_SECRET must be set in production"); })() : "dev-secret-change-in-production"),
};
