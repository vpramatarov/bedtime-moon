"""Generate the Skyfield reference fixture used by test/position.test.ts (TKT-0003 AC #6).

Run once from this directory (the JPL ephemeris is loaded next to this file):

    .venv/Scripts/python.exe moon_position_fixture.py

Skyfield is the reference oracle only (RES-0001 finding 4); it is not a runtime dependency.
"""
import datetime as dt
import json
from pathlib import Path

import skyfield
from skyfield import api

HERE = Path(__file__).resolve().parent
OUT = HERE.parent.parent / "test" / "fixtures" / "moon-position.skyfield.json"

ts = api.load.timescale()
eph = api.load(str(HERE / "de421.bsp"))
earth, moon = eph["earth"], eph["moon"]

DIRECTION_CENTERS = {
    "north": 0, "north-east": 45, "east": 90, "south-east": 135,
    "south": 180, "south-west": 225, "west": 270, "north-west": 315,
}


def circular_distance(a, b):
    d = abs((a - b) % 360)
    return min(d, 360 - d)


def direction_word(azimuth_deg):
    return min(DIRECTION_CENTERS, key=lambda name: circular_distance(azimuth_deg, DIRECTION_CENTERS[name]))


# A spread of locations (mid-northern, tropical, southern, near-Arctic) and dates across 2026 --
# more candidates than the 20 we need, since some will sit too close to a decision boundary.
CANDIDATE_LOCATIONS = [
    (42.7, 23.32),    # Sofia
    (40.7, -74.0),    # New York
    (-33.9, 18.4),    # Cape Town
    (35.7, 139.7),    # Tokyo
    (-23.5, -46.6),   # Sao Paulo
    (51.5, -0.1),     # London
    (0.0, 0.0),       # equator / prime meridian
    (65.0, 25.0),     # near-Arctic
]

# Guard bands: keep clear of the altitude=0 and altitude=60 decision boundaries, and clear of each
# 45deg compass-bucket boundary, so the ~0.5-1deg suncalc/Skyfield modeling residual (parallax and
# refraction are computed slightly differently by each) can never flip an expected case.
ALTITUDE_ZERO_GUARD_DEG = 1.0
HIGH_UP_GUARD_DEG = 1.0
AZIMUTH_BOUNDARY_GUARD_DEG = 3.0

cases = []
start = dt.date(2026, 1, 2)
i = 0
while len(cases) < 20 and i < 400:
    day = start + dt.timedelta(days=i * 4 + 1)
    lat, lon = CANDIDATE_LOCATIONS[i % len(CANDIDATE_LOCATIONS)]
    hour = (i * 7) % 24
    when = dt.datetime(day.year, day.month, day.day, hour, 0, tzinfo=dt.timezone.utc)
    i += 1

    observer = earth + api.wgs84.latlon(lat, lon)
    t = ts.from_datetime(when)
    alt, az, _ = observer.at(t).observe(moon).apparent().altaz()
    alt_deg, az_deg = alt.degrees, az.degrees

    if abs(alt_deg) < ALTITUDE_ZERO_GUARD_DEG:
        continue
    if abs(alt_deg - 60) < HIGH_UP_GUARD_DEG:
        continue
    boundary_dist = min(circular_distance(az_deg, k * 45 + 22.5) for k in range(8))
    if boundary_dist < AZIMUTH_BOUNDARY_GUARD_DEG:
        continue

    cases.append(
        {
            "utc": when.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "lat": lat,
            "lon": lon,
            "altitudeDeg": round(float(alt_deg), 4),
            "azimuthDeg": round(float(az_deg), 4),
            "up": bool(alt_deg > 0),
            "direction": direction_word(az_deg) if alt_deg > 0 else None,
        }
    )

if len(cases) < 20:
    raise SystemExit(f"only found {len(cases)} cases clear of a decision boundary; widen the candidate pool")

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(
    json.dumps(
        {
            "generator": "scripts/oracle/moon_position_fixture.py",
            "skyfield": skyfield.__version__,
            "ephemeris": "de421.bsp",
            "note": (
                "altitude/azimuth in degrees, standard compass (0=N/90=E/180=S/270=W). direction is "
                "the nearest of 8 compass points, null when up is false. Cases within 1deg of the "
                "altitude=0 or altitude=60 boundaries, or 3deg of a 45deg compass-bucket boundary, are "
                "excluded so a small suncalc/Skyfield modeling difference can never flip an expected case."
            ),
            "cases": cases,
        },
        indent=2,
    )
    + "\n",
    encoding="utf-8",
)
print(f"wrote {len(cases)} cases to {OUT}")
