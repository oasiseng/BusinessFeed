import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type ApiConfig = {
  host: string;
  port: number;
  dbPath: string;
  webhookSecret?: string;
  allowUnsignedWebhooks: boolean;
  webDistDir?: string;
};

export function loadConfig(overrides: Partial<ApiConfig> = {}): ApiConfig {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
  const config: ApiConfig = {
    host: process.env.HOST ?? "127.0.0.1",
    port: Number(process.env.PORT ?? 4317),
    dbPath: process.env.BUSINESSFEED_DB_PATH ?? resolve(repoRoot, "data", "businessfeed.sqlite"),
    allowUnsignedWebhooks: process.env.ALLOW_UNSIGNED_WEBHOOKS === "true"
  };

  if (process.env.WEBHOOK_SECRET) config.webhookSecret = process.env.WEBHOOK_SECRET;
  if (process.env.WEB_DIST_DIR) config.webDistDir = process.env.WEB_DIST_DIR;
  return { ...config, ...overrides };
}
