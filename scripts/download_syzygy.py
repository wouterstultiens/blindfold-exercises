#!/usr/bin/env python3
"""Download 3-4-5 piece Syzygy tablebases."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path
from typing import Iterable

import requests
from requests import Session
from tqdm import tqdm

BASE_URL = "http://tablebase.sesse.net/syzygy/3-4-5/"
FILE_PATTERN = re.compile(r"href=\"([^\"]+\.(?:rtbw|rtbz))\"")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Download 3-4-5 piece Syzygy tablebases")
    parser.add_argument(
        "--dest",
        default="tablebases/syzygy",
        help="Destination directory for downloaded tablebase files (default: tablebases/syzygy)"
    )
    parser.add_argument(
        "--filter",
        default=None,
        help="Optional substring filter to limit downloads (useful for debugging)"
    )
    return parser.parse_args()


def discover_files(session: Session) -> Iterable[str]:
    response = session.get(BASE_URL, timeout=30)
    response.raise_for_status()
    matches = FILE_PATTERN.findall(response.text)
    if not matches:
        raise RuntimeError("No Syzygy files discovered; the source site layout may have changed")
    return sorted(set(matches))


def remote_size(session: Session, url: str) -> int | None:
    try:
        response = session.head(url, timeout=30)
        if response.status_code >= 400:
            return None
        length = response.headers.get("Content-Length")
        return int(length) if length is not None else None
    except requests.RequestException:
        return None


def download_file(session: Session, url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    expected_size = remote_size(session, url)
    if dest.exists() and expected_size is not None and dest.stat().st_size == expected_size:
        print(f"Skipping {dest.name} (already downloaded)")
        return

    temp_path = dest.with_suffix(dest.suffix + ".part")
    with session.get(url, stream=True, timeout=60) as response:
        response.raise_for_status()
        total = int(response.headers.get("Content-Length") or 0)
        with open(temp_path, "wb") as handle:
            with tqdm(total=total, unit="B", unit_scale=True, desc=dest.name) as progress:
                for chunk in response.iter_content(chunk_size=1024 * 1024):
                    if not chunk:
                        continue
                    handle.write(chunk)
                    progress.update(len(chunk))
    temp_path.replace(dest)


def main() -> None:
    args = parse_args()
    dest_root = Path(args.dest).expanduser().resolve()

    with requests.Session() as session:
        filenames = list(discover_files(session))
        if args.filter:
            filenames = [name for name in filenames if args.filter in name]
            if not filenames:
                print(f"Filter '{args.filter}' matched no files", file=sys.stderr)
                sys.exit(1)

        print(f"Discovered {len(filenames)} tablebase files")
        for name in filenames:
            url = f"{BASE_URL}{name}"
            target = dest_root / name
            try:
                download_file(session, url, target)
            except requests.RequestException as error:
                print(f"Failed to download {name}: {error}", file=sys.stderr)
                sys.exit(1)


if __name__ == "__main__":
    main()
