// build.ts — Production build script
// Runs Tailwind CSS (minified) then bundles the frontend with Bun.build()

import { rmSync } from "node:fs";

// ---------------------------------------------------------------------------
// 1. Clean previous build
// ---------------------------------------------------------------------------

rmSync("./dist", { recursive: true, force: true });
console.log("🧹 Cleaned dist/");

// ---------------------------------------------------------------------------
// 2. Build CSS with Tailwind CLI (minified)
// ---------------------------------------------------------------------------

const cssResult = Bun.spawnSync([
  "bunx",
  "@tailwindcss/cli",
  "-i",
  "./client/src/app.css",
  "-o",
  "./client/src/app.built.css",
  "--minify",
]);

if (cssResult.exitCode !== 0) {
  console.error("CSS build failed:", cssResult.stderr.toString());
  process.exit(1);
}

console.log("✅ CSS built (minified)");

// ---------------------------------------------------------------------------
// 3. Bundle frontend with Bun.build()
// ---------------------------------------------------------------------------

const result = await Bun.build({
  entrypoints: ["./client/index.html"],
  outdir: "./dist",
  minify: true,
  sourcemap: "linked",
  naming: "[dir]/[name]-[hash].[ext]",
});

if (!result.success) {
  console.error("Build failed:");
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

console.log(`✅ Built ${result.outputs.length} files to ./dist`);

// ---------------------------------------------------------------------------
// 4. Rename hashed HTML entry to index.html for SPA serving
// ---------------------------------------------------------------------------

import { readdirSync, renameSync } from "node:fs";

const htmlFile = readdirSync("./dist").find(
  (f) => f.endsWith(".html") && f !== "index.html",
);

if (htmlFile) {
  renameSync(`./dist/${htmlFile}`, "./dist/index.html");
  console.log(`✅ Renamed ${htmlFile} → index.html`);
}
