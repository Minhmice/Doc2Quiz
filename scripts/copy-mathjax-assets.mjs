import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const mathjaxPkg = path.join(root, "node_modules", "mathjax");
const srcV3 = path.join(mathjaxPkg, "es5");
const dest = path.join(root, "public", "mathjax", "es5");

const SKIP_COPY = new Set([
  "package.json",
  "README.md",
  "CONTRIBUTING.md",
  "LICENSE",
]);

function copyMathJaxV4() {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(mathjaxPkg)) {
    if (SKIP_COPY.has(entry)) continue;
    fs.cpSync(path.join(mathjaxPkg, entry), path.join(dest, entry), {
      recursive: true,
    });
  }
}

if (!fs.existsSync(mathjaxPkg)) {
  console.error(
    "copy-mathjax: node_modules/mathjax not found — run `npm install` (do not use --ignore-scripts).",
  );
  process.exit(1);
}

if (fs.existsSync(dest)) {
  fs.rmSync(dest, { recursive: true, force: true });
}

if (fs.existsSync(srcV3)) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(srcV3, dest, { recursive: true });
  console.log("Copied mathjax v3 es5 bundle to public/mathjax/es5");
} else if (fs.existsSync(path.join(mathjaxPkg, "tex-chtml.js"))) {
  copyMathJaxV4();
  console.log("Copied mathjax v4 bundle to public/mathjax/es5");
} else {
  console.error(
    "copy-mathjax: no supported mathjax bundle layout in node_modules/mathjax",
  );
  process.exit(1);
}
