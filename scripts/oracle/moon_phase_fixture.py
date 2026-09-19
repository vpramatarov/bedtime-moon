"""Generate the Skyfield reference fixture used by test/phase.test.ts.

Run once from this directory (the JPL ephemeris downloads next to this file):

    .venv/Scripts/python.exe moon_phase_fixture.py

Skyfield is the reference oracle only (RES-0001 finding 4); it is not a runtime dependency.
"""
import datetime as dt
import json
from pathlib import Path
from zoneinfo import ZoneInfo

import skyfield
from skyfield import almanac, api

HERE = Path(__file__).resolve().parent
OUT = HERE.parent.parent / "test" / "fixtures" / "moon-phase.skyfield.json"

ts = api.load.timescale()
eph = api.load("de421.bsp")
sofia = ZoneInfo("Europe/Sofia")

cases = []
start = dt.datetime(2026, 1, 3, 21, 0, tzinfo=sofia)
for i in range(40):
    local = start + dt.timedelta(days=18 * i)
    local = local.replace(hour=21, minute=0)  # keep 21:00 wall-clock across DST changes
    t = ts.from_datetime(local)
    phase_deg = float(almanac.moon_phase(eph, t).degrees)
    fraction = float(almanac.fraction_illuminated(eph, "moon", t))
    cases.append(
        {
            "local": local.isoformat(),
            "utc": local.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "phaseDeg": round(phase_deg, 4),
            "fraction": round(fraction, 5),
        }
    )

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(
    json.dumps(
        {
            "generator": "scripts/oracle/moon_phase_fixture.py",
            "skyfield": skyfield.__version__,
            "ephemeris": "de421.bsp",
            "note": "phaseDeg: 0 = new, 90 = first quarter, 180 = full, 270 = last quarter (Skyfield almanac.moon_phase).",
            "cases": cases,
        },
        indent=2,
    )
    + "\n",
    encoding="utf-8",
)
print(f"wrote {len(cases)} cases to {OUT}")
