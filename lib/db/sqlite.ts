import { AsyncLocalStorage } from "node:async_hooks";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type { Driver, Value } from "./driver";
import { SCHEMA } from "./schema";

export function createSqliteDriver(file: string): Driver {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("synchronous = NORMAL");
  sqlite.pragma("busy_timeout = 5000");
  for (const statement of SCHEMA) sqlite.exec(statement);

  const prepared = new Map<string, Database.Statement>();
  const prepare = (sql: string) => {
    let statement = prepared.get(sql);
    if (!statement) prepared.set(sql, (statement = sqlite.prepare(sql)));
    return statement;
  };

  // There is one connection, so work is done strictly one piece at a time:
  // a transaction holds the line until it commits, and everything else waits.
  // Code running inside a transaction is recognised and goes straight through.
  const insideTransaction = new AsyncLocalStorage<true>();
  let line: Promise<unknown> = Promise.resolve();
  function inTurn<T>(work: () => T | Promise<T>): Promise<T> {
    if (insideTransaction.getStore()) return Promise.resolve().then(work);
    const result = line.then(work);
    line = result.catch(() => undefined);
    return result;
  }

  return {
    all: <T>(sql: string, params: Value[] = []) => inTurn(() => prepare(sql).all(...params) as T[]),
    get: <T>(sql: string, params: Value[] = []) => inTurn(() => prepare(sql).get(...params) as T | undefined),
    run: (sql: string, params: Value[] = []) => inTurn(() => ({ changes: prepare(sql).run(...params).changes })),
    transaction<T>(work: () => Promise<T>): Promise<T> {
      if (insideTransaction.getStore()) return work();
      return inTurn(async () => {
        sqlite.exec("BEGIN IMMEDIATE");
        try {
          const value = await insideTransaction.run(true, work);
          sqlite.exec("COMMIT");
          return value;
        } catch (error) {
          sqlite.exec("ROLLBACK");
          throw error;
        }
      });
    },
  };
}
