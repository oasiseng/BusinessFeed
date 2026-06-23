import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const ignoredDirs = new Set([".git", "node_modules", "dist", "coverage", "data", "playwright-report", "test-results"]);
const ignoredFiles = new Set(["package-lock.json"]);
const suspicious = [
  /-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----/,
  /\bsk-[A-Za-z0-9]{20,}\b/,
  /\b[A-Za-z0-9_]{20,}\.[A-Za-z0-9_]{20,}\.[A-Za-z0-9_-]{20,}\b/,
  /\b(?:api[_-]?key|secret|token|password)\s*[:=]\s*['"][^'"]{8,}['"]/i
];

const findings = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const rel = relative(root, fullPath);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      if (!ignoredDirs.has(entry)) walk(fullPath);
      continue;
    }
    if (ignoredFiles.has(entry) || rel.includes(".env.example")) continue;
    if (stat.size > 1024 * 1024) continue;
    const text = readFileSync(fullPath, "utf8");
    for (const pattern of suspicious) {
      if (pattern.test(text)) findings.push(rel);
    }
  }
}

walk(root);

if (findings.length > 0) {
  console.error("Potential secrets found:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log("No obvious secrets found.");
