import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const PACKAGES = ["@carlesandres/webreel-core", "@carlesandres/webreel"];
const VALID_BUMPS = new Set(["patch", "minor", "major"]);

const [maybeBump, ...summaryParts] = process.argv.slice(2);

const bump = VALID_BUMPS.has(maybeBump) ? maybeBump : "patch";
const summary = VALID_BUMPS.has(maybeBump)
  ? summaryParts.join(" ").trim()
  : [maybeBump, ...summaryParts].filter(Boolean).join(" ").trim();

if (!summary) {
  console.error(
    `Usage: pnpm release:${bump} "Short release summary"\n` +
      '   or: pnpm release:changeset patch "Short release summary"',
  );
  process.exit(1);
}

const slug = `${new Date().toISOString().slice(0, 10)}-${Math.random()
  .toString(36)
  .slice(2, 8)}`;
const filePath = path.join(process.cwd(), ".changeset", `${slug}.md`);

const content = `---
"${PACKAGES[0]}": ${bump}
"${PACKAGES[1]}": ${bump}
---

${summary}
`;

await mkdir(path.dirname(filePath), { recursive: true });
await writeFile(filePath, content, "utf8");

console.log(`Created ${path.relative(process.cwd(), filePath)}`);
