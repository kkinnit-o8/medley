import path from "node:path";
import type { Driver } from "./driver";
import { createSqliteDriver } from "./sqlite";

/**
 * The app's database. To move to hosted Postgres, write a driver that
 * implements ./driver.ts and return it from connect() instead.
 */
function connect(): Driver {
  const file = process.env.MEDLEY_DB ?? path.join(process.cwd(), "data", "medley.db");
  return createSqliteDriver(file);
}

// Opened on first use (so building the site never touches the database) and
// kept on globalThis so development reloads reuse the same connection.
const holder = globalThis as { __medleyDb?: Driver };
const connection = () => (holder.__medleyDb ??= connect());

export const db: Driver = {
  all: (sql, params) => connection().all(sql, params),
  get: (sql, params) => connection().get(sql, params),
  run: (sql, params) => connection().run(sql, params),
  transaction: (work) => connection().transaction(work),
};
