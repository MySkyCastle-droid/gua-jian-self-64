"""Package local, auditable source + static site + the materialized question bank."""
from __future__ import annotations
import argparse
import json
import os
from pathlib import Path
import zipfile


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    destination = args.output.resolve()
    if destination == root or root in destination.parents:
        raise SystemExit('Put the output ZIP outside the project tree.')
    full_bank = root / 'question-bank' / 'derived-items.jsonl'
    if not full_bank.is_file():
        raise SystemExit('The full derived question bank is not materialized yet.')
    destination.parent.mkdir(parents=True, exist_ok=True)
    excluded = {'.git', '.openai', 'artifacts', 'test-output', 'node_modules', '__pycache__'}
    sentinel = os.environ.get('CODEX_USAGE_GUARD_STOP_FILE')
    with zipfile.ZipFile(destination, 'w', zipfile.ZIP_DEFLATED, compresslevel=7) as archive:
        for item in sorted(root.rglob('*')):
            if sentinel and Path(sentinel).exists():
                print(json.dumps({'status': 'STOP_REQUESTED', 'partial_archive': str(destination)}))
                return 75
            if not item.is_file():
                continue
            relative = item.relative_to(root)
            if any(part in excluded for part in relative.parts) or item.suffix in {'.log', '.stop'}:
                continue
            archive.write(item, str(Path('gua-jian-self-64') / relative))
    with zipfile.ZipFile(destination) as archive:
        error = archive.testzip()
        if error:
            raise SystemExit(f'ZIP CRC failure: {error}')
        names = archive.namelist()
        required = ['dist/index.html', 'dist/bank.js', 'dist/data/bank.js', 'question-bank/derived-items.jsonl', 'README.md']
        for entry in required:
            if f'gua-jian-self-64/{entry}' not in names:
                raise SystemExit(f'Missing packaged artifact: {entry}')
    print(json.dumps({'archive': str(destination), 'bytes': destination.stat().st_size, 'files': len(names), 'crc_check': 'passed'}, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
