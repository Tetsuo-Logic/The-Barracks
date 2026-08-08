// One-off: rasterise the app mark to the PNG icons the manifest needs.
// Run with: node scripts/gen-icons.mjs
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
mkdirSync(outDir, { recursive: true });

// The Barracks mark: sergeant's chevrons + a rank star, brass on gunmetal.
function mark({ bg = "#20261f", pad = 0 } = {}) {
  const s = 512;
  const g = pad; // inset for maskable safe zone
  const gold = "#C99A2C";
  const chevron = (cy) =>
    `<polyline points="150,${cy} 256,${cy - 66} 362,${cy}" fill="none" stroke="${gold}" stroke-width="40" stroke-linecap="round" stroke-linejoin="round"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}">
    <rect width="${s}" height="${s}" fill="${bg}"/>
    <g transform="translate(${g},${g}) scale(${(s - 2 * g) / s})">
      <path d="M256 96 l26 54 59 8 -43 42 10 59 -52 -28 -52 28 10 -59 -43 -42 59 -8 Z" fill="${gold}"/>
      ${chevron(300)}
      ${chevron(370)}
      ${chevron(440)}
    </g>
  </svg>`;
}

// Monochrome chevron on transparent, for the Android notification badge.
const badge = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72">
  <polyline points="16,46 36,28 56,46" fill="none" stroke="#ffffff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
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
