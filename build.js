#!/usr/bin/env node
import * as esbuild from "esbuild";
import { mkdirSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const outDirEsm = join(__dirname, "dist", "esm");
const outDirCjs = join(__dirname, "dist", "cjs");

[outDirEsm, outDirCjs].forEach((d) => {
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
});

await esbuild.build({
  entryPoints: ["src/index.js"],
  bundle: true,
  format: "esm",
  outfile: join(outDirEsm, "index.js"),
  platform: "neutral",
  target: "es2022",
});

await esbuild.build({
  entryPoints: ["src/index.js"],
  bundle: true,
  format: "cjs",
  outfile: join(outDirCjs, "index.cjs"),
  platform: "neutral",
  target: "es2022",
});

console.log("Build complete: dist/esm/index.js, dist/cjs/index.cjs");
