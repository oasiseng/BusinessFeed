import { drizzle, SQLJsDatabase } from "drizzle-orm/sql-js";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import initSqlJs, { Database, SqlJsStatic, SqlValue } from "sql.js";
import * as schema from "./schema";

export type DatabaseHandle = {
  sqlite: Database;
  db: SQLJsDatabase<typeof schema>;
  path: string;
  queryAll<T extends Record<string, unknown>>(sql: string, params?: SqlValue[]): T[];
  persist(): void;
  close(): void;
};

let sqlJs: Promise<SqlJsStatic> | null = null;

export async function openDatabase(dbPath: string): Promise<DatabaseHandle> {
  const SQL = await loadSqlJs();
  const resolved = dbPath === ":memory:" ? dbPath : resolve(dbPath);
  if (resolved !== ":memory:") mkdirSync(dirname(resolved), { recursive: true });
  const sqlite = resolved !== ":memory:" && existsSync(resolved) ? new SQL.Database(readFileSync(resolved)) : new SQL.Database();
  migrate(sqlite);
  const db = drizzle(sqlite, { schema });

  const handle: DatabaseHandle = {
    sqlite,
    db,
    path: resolved,
    queryAll: <T extends Record<string, unknown>>(sql: string, params: SqlValue[] = []) => {
      const statement = sqlite.prepare(sql);
      statement.bind(params);
      const rows: T[] = [];
      try {
        while (statement.step()) rows.push(statement.getAsObject() as T);
      } finally {
        statement.free();
      }
      return rows;
    },
    persist: () => {
      if (resolved === ":memory:") return;
      writeFileSync(resolved, Buffer.from(sqlite.export()));
    },
    close: () => {
      handle.persist();
      sqlite.close();
    }
  };

  handle.persist();
  return handle;
}

function loadSqlJs(): Promise<SqlJsStatic> {
  if (!sqlJs) {
    const require = createRequire(import.meta.url);
    const wasmDir = dirname(require.resolve("sql.js/dist/sql-wasm.wasm"));
    sqlJs = initSqlJs({
      locateFile: (file) => resolve(wasmDir, file)
    });
  }
  return sqlJs;
}

function migrate(sqlite: Database): void {
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS activity_events (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      source_type TEXT NOT NULL,
      external_id TEXT NOT NULL,
      occurred_at_ms INTEGER NOT NULL,
      actor_name TEXT,
      actor_email TEXT,
      title TEXT NOT NULL,
      body TEXT,
      url TEXT,
      media_json TEXT,
      raw_json TEXT,
      inserted_at_ms INTEGER NOT NULL,
      updated_at_ms INTEGER NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS activity_events_source_external_idx
      ON activity_events (source_type, source, external_id);

    CREATE TABLE IF NOT EXISTS feed_items (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES activity_events(id) ON DELETE CASCADE,
      summary TEXT NOT NULL,
      priority_score INTEGER NOT NULL,
      category TEXT NOT NULL,
      needs_action INTEGER NOT NULL,
      dedupe_key TEXT NOT NULL,
      image_policy TEXT NOT NULL,
      source_url TEXT,
      read INTEGER NOT NULL DEFAULT 0,
      saved INTEGER NOT NULL DEFAULT 0,
      dismissed INTEGER NOT NULL DEFAULT 0,
      created_at_ms INTEGER NOT NULL,
      updated_at_ms INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS feed_items_priority_idx ON feed_items (priority_score DESC, created_at_ms DESC);
    CREATE INDEX IF NOT EXISTS feed_items_state_idx ON feed_items (dismissed, read, saved);
    CREATE INDEX IF NOT EXISTS feed_items_category_idx ON feed_items (category);
  `);
}
