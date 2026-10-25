#!/usr/bin/env python3
"""Calculate cumulative club scores from cleaned event results.

Scoring is awarded independently within every age group in an event:
1st=7, 2nd=5, 3rd=4, 4th=3, 5th=2, 6th=1. Events are processed in
ascending event-number order. Writes one cumulative standings snapshot after
each event to results/team_scores.json.

Run from any directory:
    python3 scripts/calculate_team_scores.py
"""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
POINTS_BY_PLACE = {1: 7, 2: 5, 3: 4, 4: 3, 5: 2, 6: 1}


def int_or_none(value: Any) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def gender_category(age_group: dict, event_name: str | None) -> str | None:
    gender = age_group.get("gender")
    if gender == "M":
        return "open"
    if gender == "F":
        return "female"
    if gender == "X":
        return None

    name = (event_name or "").casefold()
    if name.startswith("open "):
        return "open"
    if name.startswith("female "):
        return "female"
    return None


def load_events(results_dir: Path) -> list[dict]:
    events = []
    for path in results_dir.glob("E*.json"):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise ValueError(f"Cannot read cleaned event file {path}: {exc}") from exc
        if data.get("status") != "complete":
            raise ValueError(f"{path} is not a complete cleaned event")
        event = data.get("event", {})
        event_number = int_or_none(event.get("number"))
        if event_number is None:
            event_number = int_or_none(event.get("id"))
        if event_number is None:
            raise ValueError(f"{path} has no numeric event number or id")
        events.append({
            "number": event_number,
            "id": int_or_none(event.get("id")),
            "name": event.get("name"),
            "age_groups": data.get("age_groups", []),
            "file": path.name,
        })
    if not events:
        raise ValueError(f"No cleaned event files found in {results_dir}")
    return sorted(events, key=lambda event: (event["number"], event["file"]))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--results-dir", type=Path, default=ROOT / "results",
                        help="Directory containing cleaned event JSON files")
    parser.add_argument("--output", type=Path, default=ROOT / "results" / "team_scores.json",
                        help="Output scoreboard JSON path")
    args = parser.parse_args()

    try:
        events = load_events(args.results_dir)
    except ValueError as exc:
        parser.error(str(exc))

    totals: dict[str, int] = defaultdict(int)
    clubs: dict[str, dict] = {}
    snapshots = []

    for event in events:
        event_points: dict[str, int] = defaultdict(int)
        gender_event_points = {"open": defaultdict(int), "female": defaultdict(int)}
        for age_group in event["age_groups"]:
            category = gender_category(age_group, event["name"])
            for result in age_group.get("results", []):
                place = int_or_none(result.get("place"))
                points = POINTS_BY_PLACE.get(place)
                club = result.get("club")
                if points is None or not isinstance(club, dict):
                    continue
                code = club.get("code")
                name = club.get("name")
                key = code or name
                if not key:
                    continue
                key = str(key)
                clubs[key] = {"code": code, "name": name}
                event_points[key] += points
                if category:
                    gender_event_points[category][key] += points
                totals[key] += points

        standings = sorted(
            (key for key, score in totals.items() if score > 0),
            key=lambda key: (-totals[key], (clubs[key].get("name") or "").casefold(), key),
        )
        rows = []
        previous_score = None
        current_rank = 0
        for index, key in enumerate(standings, start=1):
            score = totals[key]
            if score != previous_score:
                current_rank = index
                previous_score = score
            rows.append({
                "rank": current_rank,
                "club_code": clubs[key].get("code"),
                "club_name": clubs[key].get("name"),
                "total_points": score,
            })

        earned = sorted(
            (key for key, score in event_points.items() if score),
            key=lambda key: (-event_points[key], (clubs[key].get("name") or "").casefold(), key),
        )
        snapshots.append({
            "event_id": event["id"],
            "event_number": event["number"],
            "event_name": event["name"],
            "points_awarded": [
                {
                    "club_code": clubs[key].get("code"),
                    "club_name": clubs[key].get("name"),
                    "points": event_points[key],
                }
                for key in earned
            ],
            "gender_points_awarded": {
                category: [
                    {
                        "club_code": clubs[key].get("code"),
                        "club_name": clubs[key].get("name"),
                        "points": points,
                    }
                    for key, points in sorted(
                        category_points.items(),
                        key=lambda item: (-item[1], (clubs[item[0]].get("name") or "").casefold(), item[0]),
                    )
                ]
                for category, category_points in gender_event_points.items()
            },
            "standings": rows,
        })

    output = {
        "scoring": {str(place): points for place, points in POINTS_BY_PLACE.items()},
        "scoring_scope": "Each age group in each event",
        "event_order": "Ascending event number",
        "events": snapshots,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote cumulative scores after {len(snapshots)} events to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
