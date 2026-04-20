import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const src = path.join(root, "node_modules", "mathjax", "es5");
const dest = path.join(root, "public", "mathjax", "es5");
const destMain = path.join(dest, "tex-chtml.js");

if (!fs.existsSync(src)) {
  console.error(
    "copy-mathjax: node_modules/mathjax/es5 not found — run `npm install` (do not use --ignore-scripts).",
  );
  process.exit(1);
}

if (fs.existsSync(destMain)) {
  console.log("copy-mathjax: public/mathjax/es5 already present, skip");
  process.exit(0);
}

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.cpSync(src, dest, { recursive: true });
console.log("Copied mathjax es5 bundle to public/mathjax/es5");
