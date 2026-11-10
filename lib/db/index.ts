import path from "node:path";
import type { Driver } from "./driver";
import { createSqliteDriver } from "./sqlite";

/**
 * The app's database connection. To move to hosted Postgres, write a driver
 * that implements ./driver.ts and return it here instead.
 */
function connect(): Driver {
  const file = process.env.MEDLEY_DB ?? path.join(process.cwd(), "data", "medley.db");
  return createSqliteDriver(file);
}

// Kept on globalThis so development reloads reuse the connection.
const holder = globalThis as { __medleyDb?: Driver };
export const db: Driver = (holder.__medleyDb ??= connect());
