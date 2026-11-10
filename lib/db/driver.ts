/**
 * The whole database surface the app depends on. SQLite implements it in
 * ./sqlite.ts; a hosted Postgres only needs these four methods too.
 *
 * SQL is written in the subset both databases share, with `?` placeholders.
 * (A Postgres driver should rewrite them to $1, $2, ...)
 */
export type Value = string | number | null;

export interface Driver {
  all<T>(sql: string, params?: Value[]): Promise<T[]>;
  get<T>(sql: string, params?: Value[]): Promise<T | undefined>;
  run(sql: string, params?: Value[]): Promise<{ changes: number }>;
  /**
   * Runs `work` as one atomic unit: either everything in it is saved or
   * nothing is. Queries made anywhere inside `work` join the transaction
   * automatically, and no other request can interleave with it.
   */
  transaction<T>(work: () => Promise<T>): Promise<T>;
}
