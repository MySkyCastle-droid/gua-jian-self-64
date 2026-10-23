"""Loopback-only static preview with a cooperative Usage Guard stop sentinel."""
from __future__ import annotations
import argparse
import functools
import http.server
import os
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=0)
    parser.add_argument('--directory', type=Path, default=Path(__file__).resolve().parents[1] / 'dist')
    args = parser.parse_args()
    directory = args.directory.resolve()
    sentinel = os.environ.get('CODEX_USAGE_GUARD_STOP_FILE')
    if sentinel and Path(sentinel).exists():
        print('Preview refused: stop sentinel already exists.', flush=True)
        return 75
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(directory))
    with http.server.ThreadingHTTPServer(('127.0.0.1', args.port), handler) as server:
        server.timeout = 0.4
        print(f'Local: http://127.0.0.1:{server.server_port}/', flush=True)
        while not sentinel or not Path(sentinel).exists():
            server.handle_request()
    print('Preview stopped cooperatively.', flush=True)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
