// One-off: rasterise the app mark to the PNG icons the manifest needs.
// Run with: node scripts/gen-icons.mjs
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
mkdirSync(outDir, { recursive: true });

// The Barracks mark: the 🪖 army-helmet emoji (Twemoji artwork, CC-BY 4.0) on
// command-black — the same helmet shown on the login screen.
const HELMET = `
  <path fill="#464F25" d="M33 15c-.987-7.586-4.602-14-15-14S3.987 7.414 3 15c-.152 1.169-2 2-2 6 0 2 1.366 3.564 3 4 3.105.829 3-1 14-1s10.895 1.829 14 1c1.634-.436 3-2 3-4 0-4-1.848-4.831-2-6z"/>
  <path fill="#383A18" d="M18 15.068C7.602 15.068 2.001 17 2.001 21c0 2 .365-.176 1.999.261 3.105.829 3-2.317 14-2.317s10.895 3.146 14 2.317c1.634-.437 1.999 1.739 1.999-.261 0-4-5.601-5.932-15.999-5.932z"/>
  <path fill="#C1694F" d="M18 33.966C8.733 33.966 4.034 29.94 4.034 22c0-7.94 4.699-11.966 13.966-11.966 9.268 0 13.966 4.026 13.966 11.966 0 7.94-4.698 11.966-13.966 11.966zm0-22C9.79 11.966 5.966 15.154 5.966 22S9.79 32.034 18 32.034 30.034 28.846 30.034 22 26.21 11.966 18 11.966z"/>
  <path fill="#662113" d="M24 32c0 1.657-2.686 3-6 3s-6-1.343-6-3 2.686-1 6-1 6-.657 6 1z"/>
  <path fill="#717735" d="M33 15c-.987-7.586-4.602-14-15-14S3.987 7.414 3 15c-.152 1.169-2 2-2 6 0 2 1.366 3.564 3 4 0-4 0-8 14-8s14 4 14 8c1.634-.436 3-2 3-4 0-4-1.848-4.831-2-6z"/>
  <path fill="#A3A364" d="M18 13c-7 0-17 1-17 8 0 2 1.366 3.564 3 4 0-4 0-8 14-8s14 4 14 8c1.634-.436 3-2 3-4 0-7-11-8-17-8z"/>
  <path fill="#677032" d="M18 16C7.602 16 1 17 1 21c0 2 1.366 3.564 3 4 0-4 0-8 14-8s14 4 14 8c1.634-.436 3-2 3-4 0-4-6.602-5-17-5z"/>`;

// mark: helmet centred on the dark background. `pad` shrinks it for the maskable
// safe zone. The emoji art is a 36-unit box.
function mark({ bg = "#0b100e", pad = 0 } = {}) {
  const s = 512;
  const box = s - 2 * pad; // drawable size
  const scale = (box / 36) * 0.9;
  const drawn = 36 * scale;
  const tx = (s - drawn) / 2;
  const ty = (s - drawn) / 2 + drawn * 0.06; // nudge down a touch
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}">
    <rect width="${s}" height="${s}" fill="${bg}"/>
    <g transform="translate(${tx},${ty}) scale(${scale})">${HELMET}</g>
  </svg>`;
}

// Monochrome white helmet silhouette on transparent, for the Android badge.
const badge = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36">
  <path fill="#ffffff" d="M33 15c-.987-7.586-4.602-14-15-14S3.987 7.414 3 15c-.152 1.169-2 2-2 6 0 2 1.366 3.564 3 4 0-4 0-8 14-8s14 4 14 8c1.634-.436 3-2 3-4 0-4-1.848-4.831-2-6z"/>
</svg>`;

const jobs = [
  { svg: mark(), size: 192, name: "icon-192.png" },
  { svg: mark(), size: 512, name: "icon-512.png" },
  { svg: mark({ pad: 56 }), size: 512, name: "icon-512-maskable.png" },
  { svg: mark(), size: 180, name: "apple-touch-icon.png" },
  { svg: badge, size: 72, name: "badge-72.png" },
];

for (const j of jobs) {
  await sharp(Buffer.from(j.svg)).resize(j.size, j.size).png().toFile(join(outDir, j.name));
  console.log("wrote", j.name);
}
