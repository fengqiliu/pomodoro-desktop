#!/usr/bin/env node

/**
 * Architecture Guard: Validates that the codebase strictly conforms to DDD layering rules.
 *
 * Rules enforced:
 * 1. Domain layer (src/domain/):
 *    - MUST NOT import from "react", "react-dom", or "@tauri-apps/*"
 *    - MUST NOT import from "application", "infrastructure", or "presentation"
 *    - Allowed: internal domain modules and "src/shared"
 *
 * 2. Application layer (src/application/):
 *    - MUST NOT import from "react", "react-dom", or "@tauri-apps/*"
 *    - MUST NOT import from "infrastructure" or "presentation"
 *    - Allowed: internal application modules, "src/domain", and "src/shared"
 *
 * 3. Infrastructure layer (src/infrastructure/):
 *    - MUST NOT import from "presentation"
 *
 * 4. Presentation layer (src/presentation/):
 *    - MUST NOT import directly from "@tauri-apps/*" (must route via infrastructure/platform)
 *
 * 5. Domain & application stay pure: no browser IO globals
 *    (localStorage / navigator / fetch / XMLHttpRequest / indexedDB / window / document) —
 *    comments and string literals are ignored, so prose mentioning them is fine.
 *
 * 6. Only src/infrastructure/platform/ may import "@tauri-apps/*".
 *
 * 7. Unit tests are colocated: every file ending in `.test.ts` must live in
 *    the same directory as at least one non-test source file (.ts or .tsx).
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const srcDir = path.join(rootDir, "src");

/** Recursively lists all .ts and .tsx files under a directory. */
function getSourceFiles(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getSourceFiles(fullPath));
    } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
      files.push(fullPath);
    }
  }
  return files;
}

/** Extracts imported specifiers from a source file using regex. */
function extractImports(content) {
  const imports = [];
  // Static import/export: import ... from "specifier"; or export * from "specifier";
  const staticImportRegex = /(?:import|export)\s+(?:[\s\S]*?from\s+)?['"]([^'"]+)['"]/g;
  let match;
  while ((match = staticImportRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  // Dynamic import: import("specifier")
  const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = dynamicImportRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  return imports;
}

/**
 * Strips comments and string literals so token scans (rule 5) do not flag
 * prose that merely mentions browser APIs (e.g. a doc comment saying
 * "no dependency on localStorage").
 */
function stripCommentsAndStrings(content) {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
    .replace(/`[^`]*`/g, " ")
    .replace(/"(?:[^"\\]|\\.)*"/g, " ")
    .replace(/'(?:[^'\\]|\\.)*'/g, " ");
}

let violationsCount = 0;

function reportViolation(file, specifier, reason) {
  const relFile = path.relative(rootDir, file).replace(/\\/g, "/");
  console.error(`❌ [Architecture Violation] ${relFile}`);
  console.error(`   Import: "${specifier}"`);
  console.error(`   Reason: ${reason}\n`);
  violationsCount++;
}

const allFiles = getSourceFiles(srcDir);

for (const file of allFiles) {
  const relPath = path.relative(srcDir, file).replace(/\\/g, "/");
  const content = fs.readFileSync(file, "utf8");
  const imports = extractImports(content);

  for (const specifier of imports) {
    // Resolve relative imports to see which layer is being targeted
    let resolvedTarget = null;
    if (specifier.startsWith(".")) {
      const resolvedPath = path.resolve(path.dirname(file), specifier);
      resolvedTarget = path.relative(srcDir, resolvedPath).replace(/\\/g, "/");
    }

    // Rule 1: Domain Layer
    if (relPath.startsWith("domain/")) {
      if (specifier === "react" || specifier === "react-dom") {
        reportViolation(file, specifier, "Domain layer must not depend on React.");
      }
      if (specifier.startsWith("@tauri-apps/")) {
        reportViolation(file, specifier, "Domain layer must not depend on Tauri.");
      }
      if (
        specifier.includes("/presentation/") ||
        specifier.includes("/infrastructure/") ||
        specifier.includes("/application/") ||
        (resolvedTarget &&
          (resolvedTarget.startsWith("presentation") ||
            resolvedTarget.startsWith("infrastructure") ||
            resolvedTarget.startsWith("application")))
      ) {
        reportViolation(file, specifier, "Domain layer must not depend on outer layers.");
      }
    }

    // Rule 2: Application Layer
    if (relPath.startsWith("application/")) {
      if (specifier === "react" || specifier === "react-dom") {
        reportViolation(file, specifier, "Application layer must not depend on React.");
      }
      if (specifier.startsWith("@tauri-apps/")) {
        reportViolation(file, specifier, "Application layer must not depend on Tauri.");
      }
      if (
        specifier.includes("/presentation/") ||
        specifier.includes("/infrastructure/") ||
        (resolvedTarget &&
          (resolvedTarget.startsWith("presentation") ||
            resolvedTarget.startsWith("infrastructure")))
      ) {
        reportViolation(file, specifier, "Application layer must not depend on presentation or infrastructure.");
      }
    }

    // Rule 3: Infrastructure Layer
    if (relPath.startsWith("infrastructure/")) {
      if (
        specifier.includes("/presentation/") ||
        (resolvedTarget && resolvedTarget.startsWith("presentation"))
      ) {
        reportViolation(file, specifier, "Infrastructure layer must not depend on presentation layer.");
      }
    }

    // Rule 6: Infrastructure outside platform/ must not import @tauri-apps/*.
    if (
      relPath.startsWith("infrastructure/") &&
      !relPath.startsWith("infrastructure/platform/")
    ) {
      if (specifier.startsWith("@tauri-apps/")) {
        reportViolation(file, specifier, "Only infrastructure/platform may import @tauri-apps/*.");
      }
    }

    // Rule 4: Presentation Layer
    if (relPath.startsWith("presentation/")) {
      if (specifier.startsWith("@tauri-apps/")) {
        reportViolation(
          file,
          specifier,
          "Presentation layer must not import @tauri-apps directly. Use infrastructure/platform instead."
        );
      }
    }
  }

  // Rule 5: Domain/application stay pure — no browser IO globals.
  if (relPath.startsWith("domain/") || relPath.startsWith("application/")) {
    const stripped = stripCommentsAndStrings(content);
    const ioToken = stripped.match(
      /\b(localStorage|navigator|fetch|XMLHttpRequest|indexedDB|window|document)\b/
    );
    if (ioToken) {
      reportViolation(file, ioToken[0], "Domain/application layers must not touch browser IO globals.");
    }
  }

  // Rule 7: Unit tests are colocated with the code they cover — every *.test.ts
  // must live in a directory that contains at least one non-test source file.
  if (relPath.endsWith(".test.ts")) {
    const dir = path.dirname(file);
    const hasSource = fs
      .readdirSync(dir)
      .some(
        (name) => (name.endsWith(".ts") || name.endsWith(".tsx")) && !name.endsWith(".test.ts")
      );
    if (!hasSource) {
      reportViolation(file, relPath, "Test files must live next to the code they cover.");
    }
  }
}

if (violationsCount > 0) {
  console.error(`💥 Architecture check failed with ${violationsCount} violation(s).`);
  process.exit(1);
} else {
  console.log(
    `✅ Architecture check passed! All ${allFiles.length} source files adhere to DDD layer constraints (R1–R7).`
  );
}
