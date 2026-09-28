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
}

if (violationsCount > 0) {
  console.error(`💥 Architecture check failed with ${violationsCount} violation(s).`);
  process.exit(1);
} else {
  console.log(`✅ Architecture check passed! All ${allFiles.length} source files adhere to DDD layer constraints.`);
}
