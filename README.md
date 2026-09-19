# Bedtime Moon (working title)

A text-free bedtime web app for a small child: open it, see tonight's moon, tap it, say goodnight.
Personal, non-commercial, web only. Planning lives in `.workflow/` (research, PRD, board, tech plans).

**Moon images: NASA SVS / Ernie Wright** - frames from NASA's Scientific Visualization Studio
"Moon Phase and Libration, 2026" (<https://svs.gsfc.nasa.gov/5587/>), public domain. No NASA insignia is used.

## Develop

```bash
npm install
npm run dev        # Vite dev server
npm test           # Vitest (jsdom)
npm run typecheck  # tsc --noEmit
npm run build      # static output in dist/
```

Runtime dependency: `suncalc` only. Everything is computed on the device; nothing is fetched at runtime.

## Regenerate the moon frames

`public/frames/moon-00.webp … moon-59.webp` and `src/moon/frames.json` are a build-time snapshot:
one 2026 lunation sampled at 60 evenly spaced phases, each frame cross-checked against NASA's
Dial-a-Moon (frame numbering and illumination), re-encoded to 640 × 640 WebP.

```bash
npm run frames     # needs network; originals cached in scripts/frames/.cache/ (git-ignored)
```

## Regenerate the Skyfield oracle fixture

`test/fixtures/moon-phase.skyfield.json` pins `suncalc` against an independent ephemeris.
Python 3.10+; the JPL ephemeris (`de421.bsp`, ≈ 17 MB) downloads next to the script and is git-ignored.

```bash
python -m venv scripts/oracle/.venv
scripts/oracle/.venv/Scripts/python.exe -m pip install -r scripts/oracle/requirements.txt
cd scripts/oracle && .venv/Scripts/python.exe moon_phase_fixture.py
```

## Recorded greeting (optional)

When the device has no Bulgarian `speechSynthesis` voice the app can play a recording instead.
Add the file under `public/audio/` and set `GREETING_FALLBACK_URL` in `src/audio/greeting.ts`.
While it is `null` no request is made, so an offline open never logs a failed request.
