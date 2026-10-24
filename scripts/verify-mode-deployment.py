"""Compare every local dist file with an unauthenticated public HTTP GET.

Uses Python's standard library only. Run under guard.guard_run so the supplied
stop file and central project registration govern this bounded read-only check.
"""
from __future__ import annotations

import argparse
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import socket
import threading
import urllib.error
import urllib.parse
import urllib.request
import uuid


class Stopped(Exception):
    pass


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def save_json(output: Path, report: dict, *, initial: bool = False) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_name(output.name + "." + uuid.uuid4().hex + ".tmp")
    try:
        with temporary.open("x", encoding="utf-8") as handle:
            json.dump(report, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        if initial:
            if os.name == "nt":
                temporary.rename(output)
            else:
                os.link(temporary, output)
                temporary.unlink()
        else:
            os.replace(temporary, output)
    finally:
        if temporary.exists():
            temporary.unlink()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--directory", type=Path, required=True, help="The complete local deployed directory")
    parser.add_argument("--url", required=True, help="Public HTTPS directory URL")
    parser.add_argument("--run-id", required=True, help="The same identifier supplied to guard.guard_run")
    parser.add_argument("--output", type=Path, required=True, help="New JSON report path; refuses existing reports")
    parser.add_argument("--stop-file", type=Path, help="Optional additional cooperative sentinel")
    parser.add_argument("--cutoff", help="Optional future ISO-8601 time with timezone offset")
    args = parser.parse_args()
    base = urllib.parse.urlsplit(args.url)
    if (base.scheme != "https" or not base.hostname or base.username or base.password
            or base.query or base.fragment or not base.path.endswith("/")):
        parser.error("Use a public HTTPS directory URL ending in /, without credentials, query or fragment")
    project_id = os.environ.get("CODEX_USAGE_GUARD_PROJECT_ID")
    if (project_id != "15" or os.environ.get("CODEX_USAGE_GUARD_MANAGED") != "1"
            or not os.environ.get("CODEX_USAGE_GUARD_RUNTIME")):
        parser.error("Run this check through guard.guard_run --project-id 15")
    cutoff = datetime.fromisoformat(args.cutoff.replace("Z", "+00:00")) if args.cutoff else None
    if cutoff and (cutoff.tzinfo is None or cutoff.utcoffset() is None):
        parser.error("The cutoff must include a timezone offset")
    if cutoff and cutoff <= datetime.now(timezone.utc):
        parser.error("The cutoff must be in the future")
    output = args.output.resolve()
    if output.exists():
        parser.error("Refusing to overwrite an existing report")
    dist = args.directory.resolve(strict=True)
    if not dist.is_dir() or args.directory.is_symlink() or output.is_relative_to(dist):
        parser.error("Use a real directory and place the report outside it")
    stop_files = {args.stop_file.resolve()} if args.stop_file else set()
    guard_stop = os.environ.get("CODEX_USAGE_GUARD_STOP_FILE")
    if not guard_stop:
        parser.error("guard.guard_run must supply --stop-file")
    stop_files.add(Path(guard_stop).resolve())
    for stop_file in stop_files:
        if output == stop_file:
            parser.error("The report must not replace a stop sentinel")
    stopping = threading.Event()

    def check_stop() -> None:
        if stopping.is_set():
            raise Stopped("Stop requested")
        if any(path.exists() for path in stop_files):
            stopping.set()
            raise Stopped("A cooperative stop sentinel exists")
        if cutoff and datetime.now(timezone.utc) >= cutoff:
            stopping.set()
            raise Stopped("The optional cutoff has been reached")

    started = now()
    # Claim only a new report. Subsequent atomic replacements update this run's
    # own checkpoint; a previous run's output is never opened for replacement.
    save_json(output, {"schemaVersion": "1.0.0", "runId": args.run_id,
                       "status": "preparing-local-manifest", "startedAt": started,
                       "url": args.url, "results": []}, initial=True)
    expected = []
    try:
        for path in sorted(dist.rglob("*")):
            check_stop()
            if path.is_symlink():
                raise ValueError("Symlinks are forbidden in deployment inputs")
            if not path.is_file():
                continue
            check_stop()
            resolved = path.resolve(strict=True)
            if not resolved.is_relative_to(dist):
                raise ValueError("A dist file escapes the project through a symlink")
            hasher, size = hashlib.sha256(), 0
            with resolved.open("rb") as stream:
                while block := stream.read(1024 * 1024):
                    check_stop()
                    hasher.update(block)
                    size += len(block)
            expected.append({"path": path.relative_to(dist).as_posix(),
                             "localBytes": size, "localSha256": hasher.hexdigest()})
    except Stopped as error:
        save_json(output, {"schemaVersion": "1.0.0", "url": args.url,
                          "runId": args.run_id, "startedAt": started, "finishedAt": now(),
                          "cutoffAt": cutoff.isoformat() if cutoff else None, "count": len(expected), "completedCount": 0,
                          "checkedCount": 0, "matchCount": 0, "mismatch": [], "errors": [],
                          "stoppedCount": len(expected), "status": "stopped", "results": [],
                          "phase": "preparing-local-manifest", "message": str(error)})
        print(json.dumps({"runId": args.run_id, "status": "stopped", "checkedCount": 0}))
        return 75
    if not expected or "index.html" not in {item["path"] for item in expected}:
        raise ValueError("The deployment directory must contain index.html and its complete assets")
    results = []

    def snapshot(final: bool = False) -> dict:
        ordered = sorted(results, key=lambda record: record["path"])
        mismatches = [record for record in ordered if record["status"] == "mismatch"]
        errors = [record for record in ordered if record["status"] == "error"]
        stopped = [record for record in ordered if record["status"] == "stopped"]
        matched = sum(record["status"] == "match" for record in ordered)
        status = ("stopped" if stopping.is_set() else "incomplete" if errors or len(ordered) != len(expected)
                  else "mismatch" if mismatches else "passed")
        return {"schemaVersion": "1.0.0", "url": args.url,
                "runId": args.run_id,
                "startedAt": started, "updatedAt": now(),
                "finishedAt": now() if final else None, "cutoffAt": cutoff.isoformat() if cutoff else None,
                "count": len(expected), "completedCount": len(ordered),
                "checkedCount": matched + len(mismatches), "matchCount": matched,
                "mismatch": mismatches, "errors": errors, "stoppedCount": len(stopped),
                "status": status, "concurrency": 3, "requestTimeoutSeconds": 20,
                "maxRetries": 1, "results": ordered}

    def checkpoint(final: bool = False) -> dict:
        report = snapshot(final)
        save_json(output, report)
        return report

    def fetch(item: dict) -> dict:
        url = args.url + urllib.parse.quote(item["path"], safe="/")
        result = {**item, "url": url}
        attempts = 0
        last_error = None
        for attempt in range(2):
            try:
                check_stop()
                attempts += 1
                request = urllib.request.Request(url, method="GET", headers={
                    "Accept-Encoding": "identity", "Cache-Control": "no-cache",
                    "Pragma": "no-cache", "User-Agent": "GuajianDeploymentIntegrity/1.0"})
                # A fresh opener has no browser session, authentication, or cookie jar.
                opener = urllib.request.build_opener()
                with opener.open(request, timeout=20) as response:
                    final_url = response.geturl()
                    final_origin = urllib.parse.urlsplit(final_url)
                    if final_origin.scheme != base.scheme or final_origin.netloc != base.netloc:
                        raise ValueError("The public request redirected to a different origin")
                    remote_hash = hashlib.sha256()
                    remote_bytes = 0
                    while True:
                        check_stop()
                        chunk = response.read(128 * 1024)
                        if not chunk:
                            break
                        remote_hash.update(chunk)
                        remote_bytes += len(chunk)
                    remote_sha = remote_hash.hexdigest()
                    matches = remote_bytes == item["localBytes"] and remote_sha == item["localSha256"]
                    return {**result, "status": "match" if matches else "mismatch",
                            "httpStatus": response.status, "responseUrl": final_url,
                            "remoteBytes": remote_bytes, "remoteSha256": remote_sha,
                            "attempts": attempts}
            except Stopped as error:
                return {**result, "status": "stopped", "attempts": attempts,
                        "message": str(error)}
            except urllib.error.HTTPError as error:
                last_error = {"errorType": "HTTPError", "httpStatus": error.code,
                              "message": str(error), "networkError": False}
                error.close()
            except (urllib.error.URLError, TimeoutError, socket.timeout, OSError) as error:
                last_error = {"errorType": type(error).__name__, "message": str(error),
                              "networkError": True}
            except Exception as error:
                last_error = {"errorType": type(error).__name__, "message": str(error),
                              "networkError": False}
                break
        return {**result, "status": "error", "attempts": attempts, **last_error}

    checkpoint()
    queue = iter(expected)
    with ThreadPoolExecutor(max_workers=3, thread_name_prefix="deployment-check") as executor:
        pending = {}

        def submit_next() -> bool:
            if stopping.is_set():
                return False
            try:
                check_stop()
                item = next(queue)
            except (StopIteration, Stopped):
                return False
            pending[executor.submit(fetch, item)] = item
            return True

        for _ in range(3):
            submit_next()
        while pending:
            done, _ = wait(pending, timeout=1, return_when=FIRST_COMPLETED)
            try:
                check_stop()
            except Stopped:
                pass
            for future in done:
                item = pending.pop(future)
                try:
                    result = future.result()
                except Exception as error:
                    result = {**item, "url": args.url + urllib.parse.quote(item["path"], safe="/"),
                              "status": "error", "attempts": 0,
                              "errorType": type(error).__name__, "message": str(error), "networkError": False}
                results.append(result)
                checkpoint()
                submit_next()
    if stopping.is_set():
        completed = {record["path"] for record in results}
        for item in expected:
            if item["path"] not in completed:
                results.append({**item, "url": args.url + urllib.parse.quote(item["path"], safe="/"),
                                "status": "stopped", "attempts": 0,
                                "message": "Not started after cooperative stop or cutoff"})
    # A report cannot pass against an earlier local version if files changed
    # while the bounded public GETs were in flight.
    if not stopping.is_set():
        initial = {item["path"]: item for item in expected}
        current_files = {path.relative_to(dist).as_posix() for path in dist.rglob("*") if path.is_file()}
        if current_files != initial.keys():
            results.append({"path": "[local-file-list]", "status": "error", "attempts": 0,
                            "errorType": "LocalInputChanged", "message": "Local file list changed during verification"})
        for item in expected:
            try:
                check_stop()
                path = dist / item["path"]
                if path.is_symlink() or not path.resolve(strict=True).is_relative_to(dist):
                    raise ValueError("Local input changed to a symlink")
                hasher, size = hashlib.sha256(), 0
                with path.open("rb") as stream:
                    while block := stream.read(1024 * 1024):
                        check_stop()
                        hasher.update(block)
                        size += len(block)
                if size != item["localBytes"] or hasher.hexdigest() != item["localSha256"]:
                    raise ValueError("Local bytes changed during verification")
            except Stopped:
                break
            except (OSError, ValueError) as error:
                results.append({"path": item["path"], "status": "error", "attempts": 0,
                                "errorType": "LocalInputChanged", "message": str(error)})
    report = checkpoint(final=True)
    print(json.dumps({key: report[key] for key in ("runId", "url", "count", "checkedCount",
                                                  "matchCount", "status", "stoppedCount")}, ensure_ascii=False))
    print(json.dumps({"mismatchCount": len(report["mismatch"]), "errorCount": len(report["errors"]),
                      "report": str(output)}, ensure_ascii=False))
    if stopping.is_set():
        return 75
    return 0 if report["status"] == "passed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
