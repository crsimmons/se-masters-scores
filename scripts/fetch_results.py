#!/usr/bin/env python3
"""Fetch Lenex XML files, convert them with yq, and save only valid results.

Example matching the old loop (E101.xml -> results/raw/E601.json):
    python3 scripts/fetch_results.py --source-prefix E10 --output-prefix E60 --start 1 --end 3

The script fetches sequentially, pauses between requests, lets curl retry
transient failures, and rejects HTTP errors/HTML pages rather than saving them
as result JSON.
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_URL = "https://results.swimming.org/masters/results/2026/semasters/XML/{source_prefix}{number}.xml"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-prefix", default="E10", help="Prefix in the remote XML filename (default: E10)")
    parser.add_argument("--output-prefix", default="E60", help="Prefix for local JSON filenames (default: E60)")
    parser.add_argument("--start", type=int, default=1, help="First numeric suffix, inclusive (default: 1)")
    parser.add_argument("--end", type=int, default=3, help="Last numeric suffix, inclusive (default: 3)")
    parser.add_argument("--url-template", default=DEFAULT_URL,
                         help="URL template; supports {source_prefix} and {number}")
    parser.add_argument("--output-dir", type=Path, default=ROOT / "results" / "raw",
                         help="Directory for converted raw JSON (default: results/raw)")
    parser.add_argument("--delay", type=float, default=2.5,
                         help="Seconds to wait between requests (default: 2.5)")
    parser.add_argument("--retries", type=int, default=5,
                         help="Curl retries for transient network/server errors (default: 5)")
    return parser.parse_args()


def fetch_one(args: argparse.Namespace, number: int, curl: str, yq: str) -> bool:
    url = args.url_template.format(source_prefix=args.source_prefix, number=number)
    output = args.output_dir / f"{args.output_prefix}{number}.json"
    args.output_dir.mkdir(parents=True, exist_ok=True)

    # Keep temporary files beside the destination so replace() is atomic.
    with tempfile.TemporaryDirectory(prefix=".fetch-", dir=args.output_dir) as temp_dir:
        temp_dir = Path(temp_dir)
        xml_path = temp_dir / "response.xml"
        json_path = temp_dir / "response.json"

        curl_command = [
            curl,
            "--fail",
            "--location",
            "--silent",
            "--show-error",
            "--retry", str(args.retries),
            "--retry-delay", "2",
            "--retry-max-time", "180",
            "--retry-connrefused",
            "--connect-timeout", "20",
            "--max-time", "120",
            "--output", str(xml_path),
            "--write-out", "%{http_code}",
            url,
        ]
        try:
            response = subprocess.run(curl_command, check=False, capture_output=True, text=True)
        except OSError as exc:
            print(f"{output.name}: curl failed to start: {exc}", file=sys.stderr)
            return False

        http_code = response.stdout.strip()[-3:] if response.stdout.strip() else "???"
        if response.returncode != 0:
            detail = response.stderr.strip() or f"curl exited {response.returncode} (HTTP {http_code})"
            print(f"{output.name}: fetch failed: {detail}; leaving any existing file untouched", file=sys.stderr)
            return False
        if http_code != "200":
            print(f"{output.name}: expected HTTP 200, got {http_code}; leaving any existing file untouched", file=sys.stderr)
            return False

        try:
            with json_path.open("wb") as converted:
                conversion = subprocess.run(
                    [yq, "-p=xml", "-o=json", str(xml_path)],
                    check=False,
                    stdout=converted,
                    stderr=subprocess.PIPE,
                )
        except OSError as exc:
            print(f"{output.name}: yq failed to start: {exc}", file=sys.stderr)
            return False

        if conversion.returncode != 0:
            detail = conversion.stderr.decode(errors="replace").strip()
            print(f"{output.name}: XML conversion failed: {detail or conversion.returncode}", file=sys.stderr)
            return False
        try:
            converted_data = json.loads(json_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            print(f"{output.name}: yq did not produce valid JSON: {exc}", file=sys.stderr)
            return False
        if not isinstance(converted_data, dict) or "LENEX" not in converted_data:
            print(f"{output.name}: response was not Lenex data; not saving it", file=sys.stderr)
            return False

        json_path.replace(output)
        print(f"Saved {output} ({url})")
        return True


def main() -> int:
    args = parse_args()
    if args.start > args.end:
        print("--start must be less than or equal to --end", file=sys.stderr)
        return 2
    if args.delay < 0 or args.retries < 0:
        print("--delay and --retries must be non-negative", file=sys.stderr)
        return 2

    curl = shutil.which("curl")
    yq = shutil.which("yq")
    if not curl or not yq:
        print("Both curl and yq must be installed and available on PATH", file=sys.stderr)
        return 2

    successes = 0
    total = args.end - args.start + 1
    for index, number in enumerate(range(args.start, args.end + 1)):
        successes += fetch_one(args, number, curl, yq)
        if index < total - 1 and args.delay:
            time.sleep(args.delay)

    print(f"Fetched {successes}/{total} files successfully.")
    return 0 if successes == total else 1


if __name__ == "__main__":
    raise SystemExit(main())
