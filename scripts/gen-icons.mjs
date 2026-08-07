// One-off: rasterise the app mark to the PNG icons the manifest needs.
// Run with: node scripts/gen-icons.mjs
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
mkdirSync(outDir, { recursive: true });

// A flag on a green — ink card stock, flag-red pennant.
function mark({ bg = "#16241b", pad = 0 } = {}) {
  const s = 512;
  const g = pad; // inset for maskable safe zone
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}">
    <rect width="${s}" height="${s}" fill="${bg}"/>
    <g transform="translate(${g},${g}) scale(${(s - 2 * g) / s})">
      <ellipse cx="256" cy="384" rx="150" ry="28" fill="#2F6B4C"/>
      <rect x="250" y="150" width="8" height="212" rx="2" fill="#EAE6DB"/>
      <path d="M258 158 L366 188 L258 218 Z" fill="#B4372A"/>
      <ellipse cx="254" cy="360" rx="17" ry="6" fill="${bg}" stroke="#EAE6DB" stroke-width="3"/>
    </g>
  </svg>`;
}

// Monochrome flag silhouette on transparent, for the Android notification badge.
const badge = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72">
  <g fill="#ffffff">
    <rect x="34" y="14" width="4" height="46" rx="1"/>
    <path d="M38 16 L60 22 L38 28 Z"/>
  </g>
</svg>`;

const jobs = [
  { svg: mark(), size: 192, name: "icon-192.png" },
  { svg: mark(), size: 512, name: "icon-512.png" },
  { svg: mark({ pad: 64 }), size: 512, name: "icon-512-maskable.png" },
  { svg: mark(), size: 180, name: "apple-touch-icon.png" },
  { svg: badge, size: 72, name: "badge-72.png" },
];

for (const j of jobs) {
  await sharp(Buffer.from(j.svg)).resize(j.size, j.size).png().toFile(join(outDir, j.name));
  console.log("wrote", j.name);
}
