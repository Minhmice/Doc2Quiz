import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const src = path.join(root, "node_modules", "mathjax", "es5");
const dest = path.join(root, "public", "mathjax", "es5");

if (!fs.existsSync(src)) {
  console.warn("copy-mathjax: node_modules/mathjax/es5 not found (run after npm install)");
  process.exit(0);
}

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.cpSync(src, dest, { recursive: true });
console.log("Copied mathjax es5 bundle to public/mathjax/es5");
