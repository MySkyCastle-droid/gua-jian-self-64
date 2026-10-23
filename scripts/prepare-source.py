"""Restore four fixed, checksum-verified gzip assets using only Python stdlib.

Run before serving the GitHub checkout or building its derived question bank.
--verify checks both archives and restored files without writing anything.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import os
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
EXPECTED = {
    "research/source-items.json",
    "question-bank/original-items.jsonl",
    "dist/vendor/surveyjs/3.2.2/survey.core.min.js",
    "dist/vendor/surveyjs/3.2.2/survey-core.min.css",
}


def within_root(relative: str) -> Path:
    path = (ROOT / relative).resolve()
    if not path.is_relative_to(ROOT):
        raise ValueError(f"Path escapes the source directory: {relative}")
    return path


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verify", action="store_true", help="Check archives and already restored files; do not write")
    args = parser.parse_args()
    manifest = json.loads((ROOT / "source-archive-manifest.json").read_text(encoding="utf-8"))
    entries = manifest["entries"]
    if manifest.get("schemaVersion") != "1.0.0" or len(entries) != 4 or {item["path"] for item in entries} != EXPECTED:
        raise ValueError("The source manifest must describe exactly the four supported assets")
    validated = []
    for item in entries:
        relative = item["path"]
        if item["archive"] != relative + ".gz" or not 0 < item["bytes"] <= 4_000_000:
            raise ValueError(f"Invalid manifest entry: {relative}")
        archive = within_root(item["archive"])
        packed = archive.read_bytes()
        if len(packed) != item["archiveBytes"] or digest(packed) != item["archiveSha256"]:
            raise ValueError(f"Archive checksum mismatch: {item['archive']}")
        with gzip.open(archive, "rb") as handle:
            data = handle.read(item["bytes"] + 1)
        if len(data) != item["bytes"] or digest(data) != item["sha256"]:
            raise ValueError(f"Restored-content checksum mismatch: {relative}")
        target = within_root(relative)
        if target.exists():
            if not target.is_file() or target.read_bytes() != data:
                raise ValueError(f"Existing file differs; refusing to overwrite: {relative}")
        elif args.verify:
            raise FileNotFoundError(f"Not prepared yet: {relative}; run without --verify first")
        validated.append((target, data, relative))
    restored = 0
    for target, data, relative in validated:
        if args.verify or target.exists():
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        partial = within_root(relative + ".prepare.partial")
        with partial.open("xb") as handle:
            handle.write(data)
        if target.exists():
            raise FileExistsError(f"Destination appeared during preparation: {relative}")
        os.replace(partial, target)
        restored += 1
    print(json.dumps({"status": "verified" if args.verify else "prepared", "verifiedFiles": len(validated), "restoredFiles": restored}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
