import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type ApiConfig = {
  host: string;
  port: number;
  dbPath: string;
  webhookSecret?: string;
  allowUnsignedWebhooks: boolean;
  allowedOrigins: string[];
  webDistDir?: string;
};

export function loadConfig(overrides: Partial<ApiConfig> = {}): ApiConfig {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
  const parsedPort = Number(process.env.PORT ?? 4317);
  const config: ApiConfig = {
    host: process.env.HOST ?? "127.0.0.1",
    port: Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : 4317,
    dbPath: process.env.BUSINESSFEED_DB_PATH ?? resolve(repoRoot, "data", "businessfeed.sqlite"),
    allowUnsignedWebhooks: process.env.ALLOW_UNSIGNED_WEBHOOKS === "true",
    allowedOrigins: parseAllowedOrigins(process.env.ALLOWED_ORIGINS ?? process.env.APP_ORIGIN)
  };

  if (process.env.WEBHOOK_SECRET) config.webhookSecret = process.env.WEBHOOK_SECRET;
  if (process.env.WEB_DIST_DIR) config.webDistDir = process.env.WEB_DIST_DIR;
  return { ...config, ...overrides };
}

function parseAllowedOrigins(value: string | undefined): string[] {
  const defaults = ["http://127.0.0.1:4317", "http://localhost:4317", "http://127.0.0.1:5173", "http://localhost:5173"];
  if (!value) return defaults;
  const origins = value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return origins.length > 0 ? origins : defaults;
}
