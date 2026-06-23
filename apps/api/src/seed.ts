import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { ActivityEventSchema } from "../../../packages/shared/src/index";
import { loadConfig } from "./config";
import { openDatabase } from "./db/client";
import { ingestMany } from "./services/ingest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const fixturePath = resolve(repoRoot, "fixtures", "activity-events.json");
const FixtureSchema = z.array(ActivityEventSchema);
const events = FixtureSchema.parse(JSON.parse(readFileSync(fixturePath, "utf8")));
const config = loadConfig();
const handle = await openDatabase(config.dbPath);

try {
  const items = ingestMany(handle, events);
  console.log(`Seeded ${items.length} feed items into ${handle.path}`);
} finally {
  handle.close();
}
