import { copyFileSync, mkdirSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const src = join(root, "node_modules", "gif.js", "dist", "gif.worker.js");
const destDir = join(root, "public");
const dest = join(destDir, "gif.worker.js");

if (existsSync(src)) {
  mkdirSync(destDir, { recursive: true });
  copyFileSync(src, dest);
  console.log("Copied gif.worker.js -> public/gif.worker.js");
} else {
  console.warn("gif.js worker script not found; skipping copy.");
}
