#!/usr/bin/env python3
"""Download the latest Lichess puzzle database archive."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import requests
from tqdm import tqdm

PUZZLE_DB_URL = "https://database.lichess.org/lichess_db_puzzle.csv.zst"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Download lichess_db_puzzle.csv.zst")
    parser.add_argument(
        "--output",
        default="lichess_db_puzzle.csv.zst",
        help="Target output file (default: lichess_db_puzzle.csv.zst)"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Redownload even if the target file already exists"
    )
    return parser.parse_args()


def remote_size(session: requests.Session, url: str) -> int | None:
    try:
        response = session.head(url, timeout=30)
        if response.status_code >= 400:
            return None
        value = response.headers.get("Content-Length")
        return int(value) if value else None
    except requests.RequestException:
        return None


def main() -> None:
    args = parse_args()
    output_path = Path(args.output).expanduser().resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with requests.Session() as session:
        session.headers.update({"User-Agent": "BlindfoldExercises/2.0 (Lichess DB downloader)"})
        expected_size = remote_size(session, PUZZLE_DB_URL)

        if output_path.exists() and not args.force and expected_size is not None and output_path.stat().st_size == expected_size:
            print(f"Skipping download; already up to date: {output_path}")
            return

        temp_path = output_path.with_suffix(output_path.suffix + ".part")
        try:
            with session.get(PUZZLE_DB_URL, stream=True, timeout=60) as response:
                response.raise_for_status()
                total = int(response.headers.get("Content-Length") or 0)
                with open(temp_path, "wb") as handle:
                    with tqdm(total=total, unit="B", unit_scale=True, desc=output_path.name) as progress:
                        for chunk in response.iter_content(chunk_size=1024 * 1024):
                            if not chunk:
                                continue
                            handle.write(chunk)
                            progress.update(len(chunk))
        except requests.RequestException as error:
            print(f"Download failed: {error}", file=sys.stderr)
            if temp_path.exists():
                temp_path.unlink(missing_ok=True)
            sys.exit(1)

        temp_path.replace(output_path)

    print(f"Downloaded {output_path}")


if __name__ == "__main__":
    main()
