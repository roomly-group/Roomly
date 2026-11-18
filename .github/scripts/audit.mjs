// npm audit for CI (RMY-25). Fails when the package in the current folder has
// a HIGH or CRITICAL advisory, except the ones listed in ALLOWED_ADVISORIES.
//
// Why an allowlist instead of plain `npm audit --audit-level=high`: an
// advisory with no fixed version yet would block every push until upstream
// ships a fix. Listing it here (with the reason) keeps CI useful: any NEW
// high/critical advisory still fails the build.
//
// Usage (inside backend/ or frontend/): node ../.github/scripts/audit.mjs

import { execFileSync } from "node:child_process";

// ===================== CONFIGURATION =====================

/** Severities that fail the build. */
const BLOCKING_SEVERITIES = new Set(["high", "critical"]);

/**
 * Advisories accepted for now: GitHub advisory URL -> why. Remove an entry as
 * soon as a fixed version exists (check: `npm audit` in that folder).
 */
const ALLOWED_ADVISORIES = new Map([
  [
    "https://github.com/advisories/GHSA-fc5q-39xc-vjpf",
    "picomatch <=4.0.7 ReDoS, pulled in by vite (build tool only, never shipped to browsers). " +
      "No fixed picomatch release as of 2026-11-18.",
  ],
]);

// ===================== AUDIT =====================

/** `npm audit --json` (it exits non-zero when it finds anything, so read its output anyway). */
function runAudit() {
  try {
    return execFileSync("npm", ["audit", "--json"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  } catch (error) {
    if (typeof error.stdout === "string" && error.stdout.trim()) return error.stdout;
    throw error;
  }
}

const report = JSON.parse(runAudit());
if (report.error) {
  console.error(`npm audit could not run: ${report.error.summary ?? JSON.stringify(report.error)}`);
  process.exit(1);
}

// Every advisory object behind the vulnerable packages (a package may list
// another package's name in `via`; only the advisory objects matter).
const advisories = new Map();
for (const vulnerability of Object.values(report.vulnerabilities ?? {})) {
  for (const via of vulnerability.via ?? []) {
    if (typeof via === "object" && via.url) advisories.set(via.url, via);
  }
}

const blocking = [...advisories.values()].filter(
  (advisory) => BLOCKING_SEVERITIES.has(advisory.severity) && !ALLOWED_ADVISORIES.has(advisory.url),
);

for (const [url, reason] of ALLOWED_ADVISORIES) {
  if (advisories.has(url)) console.log(`allowed: ${url} (${reason})`);
}

if (blocking.length > 0) {
  console.error(`\n${blocking.length} high/critical advisory(ies) to fix:`);
  for (const advisory of blocking) {
    console.error(`- [${advisory.severity}] ${advisory.name} ${advisory.range}: ${advisory.title} (${advisory.url})`);
  }
  process.exit(1);
}

console.log("npm audit: no blocking advisories.");
