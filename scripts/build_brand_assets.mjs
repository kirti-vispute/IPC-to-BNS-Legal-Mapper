import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../frontend/", import.meta.url);
const asset = async file => `data:image/svg+xml,${encodeURIComponent((await readFile(new URL(`assets/${file}`, root), "utf8")).trim())}`;
const replaceOne = (text, pattern, replacement) => {
  if ([...text.matchAll(new RegExp(pattern.source, "g"))].length !== 1) throw new Error(`Brand embedding target must occur exactly once: ${pattern}`);
  return text.replace(pattern, replacement);
};
let html = await readFile(new URL("index.html", root), "utf8");
let css = await readFile(new URL("branding.css", root), "utf8");
html = replaceOne(html, /(<link rel="icon" type="image\/svg\+xml" href=")[^"]+(" \/>)/, `$1${await asset("legal-mapper-icon.svg")}$2`);
html = replaceOne(html, /(<img class="brand-mark" src=")[^"]+(" width="64")/, `$1${await asset("legal-mapper-logo.svg")}$2`);
css = replaceOne(css, /(--brand-cursor-default: )[^;\r\n]+(;)/, `$1url("${await asset("legal-cursor.svg")}") 14 3, auto$2`);
css = replaceOne(css, /(--brand-cursor-active: )[^;\r\n]+(;)/, `$1url("${await asset("legal-cursor-active.svg")}") 15 4, pointer$2`);
// Only deterministic copies of the four local vector assets are regenerated.
if (process.argv.includes("--check")) {
  if (html !== await readFile(new URL("index.html", root), "utf8") || css !== await readFile(new URL("branding.css", root), "utf8")) throw new Error("Brand assets are out of sync. Run node scripts/build_brand_assets.mjs.");
  console.log("Embedded brand SVGs match their editable source assets.");
} else {
  await writeFile(new URL("index.html", root), html);
  await writeFile(new URL("branding.css", root), css);
  console.log("Embedded local SVG logo, favicon and native cursors; no backend change.");
}
