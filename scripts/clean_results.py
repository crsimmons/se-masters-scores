#!/usr/bin/env python3
"""Create compact event-result JSON files from results/raw/*.json.

The cleaned structure keeps event/meet details, age-group rankings, swimmer
identity, club, finishing place/order, and swim time. Non-Lenex responses such
as 404 HTML pages are recorded as unavailable instead of being mistaken for
results.

Run from any directory:
    python3 scripts/clean_results.py
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]


def as_list(value: Any) -> list:
    if value is None:
        return []
    return value if isinstance(value, list) else [value]


def number(value: Any) -> Any:
    if value in (None, ""):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return value


def unavailable(error: str, message: str | None = None) -> dict:
    result = {"status": "unavailable", "error": error}
    if message:
        result["message"] = message
    return result


def clean_lenex(data: dict) -> dict:
    try:
        meet = as_list(data["LENEX"]["MEETS"]["MEET"])[0]
        session = as_list(meet["SESSIONS"]["SESSION"])[0]
        event = as_list(session["EVENTS"]["EVENT"])[0]
    except (KeyError, IndexError, TypeError):
        return unavailable("LENEX data did not contain a meet event")

    # Rankings point to RESULT records, which are nested under each swimmer
    # and club elsewhere in the Lenex document.
    results_by_id = {}
    for club in as_list(meet.get("CLUBS", {}).get("CLUB")):
        club_info = {
            "code": club.get("+@code"),
            "name": club.get("+@name.en") or club.get("+@name"),
        }
        athletes_by_id = {}
        for athlete in as_list(club.get("ATHLETES", {}).get("ATHLETE")):
            first = (athlete.get("+@firstname") or "").strip()
            last = (athlete.get("+@lastname") or "").strip()
            swimmer = {
                "name": " ".join(part for part in (first, last) if part),
                "age": number(athlete.get("+@age")),
                "gender": athlete.get("+@gender"),
            }
            athletes_by_id[athlete.get("+@athleteid")] = swimmer
            for result in as_list(athlete.get("RESULTS", {}).get("RESULT")):
                result_id = result.get("+@resultid")
                if result_id:
                    results_by_id[result_id] = {
                        "swimmer": swimmer,
                        "club": club_info,
                        "time": result.get("+@swimtime"),
                    }

        # Relay results live on RELAY records, not under individual athletes.
        # Resolve their relay positions back to the club's athlete records.
        for relay in as_list(club.get("RELAYS", {}).get("RELAY")):
            for result in as_list(relay.get("RESULTS", {}).get("RESULT")):
                result_id = result.get("+@resultid")
                if not result_id:
                    continue
                positions = as_list((result.get("RELAYPOSITIONS") or {}).get("RELAYPOSITION"))
                positions.sort(key=lambda position: number(position.get("+@number")) or 0)
                swimmers = []
                for position in positions:
                    athlete_id = position.get("+@athleteid")
                    swimmer = athletes_by_id.get(athlete_id)
                    if swimmer:
                        swimmers.append({"leg": number(position.get("+@number")), **swimmer})
                    else:
                        swimmers.append({
                            "leg": number(position.get("+@number")),
                            "athlete_id": athlete_id,
                        })
                results_by_id[result_id] = {
                    "team_name": relay.get("+@name"),
                    "swimmers": swimmers,
                    "club": club_info,
                    "time": result.get("+@swimtime"),
                }

    age_groups = []
    for group in as_list(event.get("AGEGROUPS", {}).get("AGEGROUP")):
        rankings = as_list(group.get("RANKINGS", {}).get("RANKING"))
        rankings.sort(key=lambda ranking: (
            number(ranking.get("+@order")) or 0,
            number(ranking.get("+@place")) or 0,
        ))
        ranked_swimmers = []
        for ranking in rankings:
            entry = results_by_id.get(ranking.get("+@resultid"), {})
            ranked_swimmers.append({
                "order": number(ranking.get("+@order")),
                "place": number(ranking.get("+@place")),
                **entry,
            })
        age_groups.append({
            "name": group.get("+@name"),
            "age_min": number(group.get("+@agemin")),
            "age_max": number(group.get("+@agemax")),
            "gender": group.get("+@gender"),
            "results": ranked_swimmers,
        })

    style = event.get("SWIMSTYLE", {})
    return {
        "status": "complete",
        "meet": {
            "name": meet.get("+@name.en") or meet.get("+@name"),
            "city": meet.get("+@city.en") or meet.get("+@city"),
            "date": session.get("+@date"),
            "course": session.get("+@course"),
        },
        "event": {
            "id": number(event.get("+@eventid")),
            "number": number(event.get("+@number")),
            "name": style.get("+@name"),
            "distance_m": number(style.get("+@distance")),
            "stroke": style.get("+@stroke"),
        },
        "age_groups": age_groups,
    }


def clean_file(source: Path, destination: Path) -> str:
    try:
        data = json.loads(source.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        cleaned = unavailable("Invalid or unreadable JSON", str(exc))
    else:
        if not isinstance(data, dict) or "LENEX" not in data:
            body = data.get("html", {}).get("body", {}) if isinstance(data, dict) else {}
            cleaned = unavailable(
                body.get("h4", "Source did not contain LENEX results"),
                body.get("p"),
            )
        else:
            cleaned = clean_lenex(data)

    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(cleaned, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return cleaned["status"]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--raw-dir", type=Path, default=ROOT / "results" / "raw",
                        help="Directory containing converted source JSON")
    parser.add_argument("--output-dir", type=Path, default=ROOT / "results",
                        help="Directory for cleaned JSON copies")
    args = parser.parse_args()

    files = sorted(args.raw_dir.glob("*.json"))
    if not files:
        print(f"No JSON files found in {args.raw_dir}")
        return 1

    counts = {"complete": 0, "unavailable": 0}
    for source in files:
        # Avoid processing a cleaned output again if custom directories overlap.
        if source.parent.resolve() == args.output_dir.resolve():
            continue
        status = clean_file(source, args.output_dir / source.name)
        counts[status] = counts.get(status, 0) + 1
        print(f"{source.name}: {status}")

    print(f"Created {sum(counts.values())} cleaned files: "
          f"{counts['complete']} complete, {counts['unavailable']} unavailable.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
