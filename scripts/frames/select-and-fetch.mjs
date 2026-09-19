// Build-time snapshot of NASA SVS "Moon Phase and Libration, 2026" frames (public domain).
// Credit: NASA's Scientific Visualization Studio / Ernie Wright (USRA). No NASA logo is used.
//
// Picks 60 hourly frames from one 2026 lunation, one per phase step k/60, cross-checks each
// against Dial-a-Moon (illumination and frame numbering), downloads the 730x730 JPG once into
// scripts/frames/.cache/ and re-encodes it as 640x640 WebP into public/frames/.
// Runtime code never talks to NASA (RES-0001 finding 10).
//
// Usage: npm run frames

import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import sharp from 'sharp';
import { getMoonIllumination } from 'suncalc';

const COUNT = 60;
const YEAR = 2026;
const FRAME_BASE = 'https://svs.gsfc.nasa.gov/vis/a000000/a005500/a005587/frames/730x730_1x1_30p';
const API_BASE = 'https://svs.gsfc.nasa.gov/api/dialamoon';
const OUT_SIZE = 640;
const WEBP_QUALITY = 80;
const MAX_ILLUMINATION_DIFF_PP = 2;

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const cacheDir = join(root, 'scripts', 'frames', '.cache');
const outDir = join(root, 'public', 'frames');
const manifestPath = join(root, 'src', 'moon', 'frames.json');

const HOUR_MS = 3_600_000;
const jan1 = Date.UTC(YEAR, 0, 1);
const pad = (n, w) => String(n).padStart(w, '0');
const hourDate = (frame) => new Date(jan1 + (frame - 1) * HOUR_MS); // frame 1 = Jan 1 00:00 UTC
const phaseAt = (frame) => getMoonIllumination(hourDate(frame)).phase;
const utcStamp = (d) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

async function fetchBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// 1. One lunation: first two phase wrap-arounds (new moons) in the year.
// suncalc's phase is not strictly monotonic within an hour of syzygy (it jumps from ~0.990 to
// ~0.0095 at new moon and jitters by ~1e-4 at full moon), so a wrap is a drop of more than 0.5.
const wraps = [];
for (let frame = 2; frame <= 8760 && wraps.length < 2; frame++) {
  if (phaseAt(frame) < phaseAt(frame - 1) - 0.5) wraps.push(frame);
}
if (wraps.length < 2) throw new Error('could not find a full lunation in the frame set');
const [lunationStart, lunationEnd] = wraps;
console.log(`lunation: frames ${lunationStart}..${lunationEnd - 1} (${utcStamp(hourDate(lunationStart))} -> ${utcStamp(hourDate(lunationEnd))})`);

// 2. For each phase step, the hour whose suncalc phase is nearest.
const picks = [];
for (let k = 0; k < COUNT; k++) {
  const target = k / COUNT;
  let best = { frame: lunationStart, dist: Infinity };
  for (let frame = lunationStart; frame < lunationEnd; frame++) {
    const dist = Math.abs(phaseAt(frame) - target);
    if (dist < best.dist) best = { frame, dist };
  }
  picks.push({ index: k, sourceFrame: best.frame });
}

// 3. Cross-check, download, re-encode.
await mkdir(cacheDir, { recursive: true });
await mkdir(outDir, { recursive: true });
const frames = [];
for (const pick of picks) {
  const date = hourDate(pick.sourceFrame);
  const illum = getMoonIllumination(date);
  const apiStamp = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1, 2)}-${pad(date.getUTCDate(), 2)}T${pad(date.getUTCHours(), 2)}:00`;
  const nasa = await fetchJson(`${API_BASE}/${apiStamp}`);
  const expectedName = `moon.${pad(pick.sourceFrame, 4)}.jpg`;
  if (nasa.image?.filename !== expectedName) {
    throw new Error(`frame numbering mismatch at ${apiStamp}: expected ${expectedName}, Dial-a-Moon says ${nasa.image?.filename}`);
  }
  const suncalcPct = illum.fraction * 100;
  const diff = Math.abs(nasa.phase - suncalcPct);
  if (diff > MAX_ILLUMINATION_DIFF_PP) {
    throw new Error(`illumination mismatch at ${apiStamp}: NASA ${nasa.phase}% vs suncalc ${suncalcPct.toFixed(1)}%`);
  }

  const cachePath = join(cacheDir, expectedName);
  if (!(await exists(cachePath))) {
    await writeFile(cachePath, await fetchBuffer(`${FRAME_BASE}/${expectedName}`));
    await sleep(150);
  }
  const fileName = `moon-${pad(pick.index, 2)}.webp`;
  await sharp(await readFile(cachePath))
    .resize(OUT_SIZE, OUT_SIZE, { fit: 'cover' })
    .webp({ quality: WEBP_QUALITY })
    .toFile(join(outDir, fileName));

  frames.push({
    index: pick.index,
    file: `/frames/${fileName}`,
    phase: Number(illum.phase.toFixed(5)),
    utc: utcStamp(date),
    sourceFrame: pick.sourceFrame,
    nasaIlluminationPct: nasa.phase,
    suncalcIlluminationPct: Number(suncalcPct.toFixed(1)),
  });
  console.log(`k=${pad(pick.index, 2)} frame ${pad(pick.sourceFrame, 4)} phase ${illum.phase.toFixed(4)} NASA ${nasa.phase}% suncalc ${suncalcPct.toFixed(1)}%`);
}

const manifest = {
  credit: 'Moon images: NASA SVS / Ernie Wright',
  source: 'https://svs.gsfc.nasa.gov/5587/',
  license: 'Public domain (NASA SVS). No NASA insignia used.',
  generated: new Date().toISOString(),
  frameSize: OUT_SIZE,
  frames,
};
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`wrote ${frames.length} frames and ${manifestPath}`);
