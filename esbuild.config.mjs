import * as esbuild from "esbuild";
import fs from "fs";
import path from "path";

const isWatch = process.argv.includes("--watch");
const outdir = "dist";

/** @type {esbuild.BuildOptions} */
const config = {
  entryPoints: ["src/main.ts"],
  bundle: true,
  outfile: path.join(outdir, "main.js"),
  format: "cjs",
  target: "ES2022",
  platform: "browser",
  external: ["obsidian"],
  sourcemap: false,
  minifyWhitespace: false,
  logLevel: "info",
};

function copyManifest() {
  fs.mkdirSync(outdir, { recursive: true });
  fs.cpSync("manifest.json", path.join(outdir, "manifest.json"));
  console.log("Copied manifest.json to dist/");
}

if (isWatch) {
  const ctx = await esbuild.context(config);
  await ctx.watch();
  copyManifest();
  console.log("[esbuild] Watching for changes...");
} else {
  await esbuild.build(config);
  copyManifest();
}
