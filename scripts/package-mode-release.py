"""Build verified website and public-source ZIPs in a new output directory.

Run through guard.guard_run for project 15. Inputs are read only; original PNGs,
generation records and earlier releases are never copied or modified.
"""
from __future__ import annotations

import argparse
import binascii
from datetime import datetime, timezone
import gzip
import hashlib
import io
import json
import os
from pathlib import Path
import re
import sys
import zipfile


CHUNK = 1024 * 1024
FORBIDDEN = {".git", ".openai", ".private", ".codex", "originals", "__pycache__", "node_modules"}
ARCHIVE_SOURCES = {
    "research/source-items.json", "question-bank/original-items.jsonl",
    "dist/vendor/surveyjs/3.2.2/survey.core.min.js",
    "dist/vendor/surveyjs/3.2.2/survey-core.min.css",
}
PRIVATE = re.compile(
    r'"(?:generatedPath|workspacePath|editInputPaths?|referencedImagePaths|referenced_image_paths)"\s*:', re.I)
LOCAL = re.compile(r"(?i)(?:\b[A-Z]:[\\/]+(?=[A-Z0-9_.-])|file" + r"://|/(?:Users|home)/|[\\/]\.codex[\\/])")
SECRET = re.compile(r"(?:-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----|\bsk-(?:proj-)?[A-Za-z0-9_-]{24,}|\bgh[pousr]_[A-Za-z0-9]{30,}|\bgithub_pat_[A-Za-z0-9_]{30,}|\bAKIA[A-Z0-9]{16}\b|\bAIza[A-Za-z0-9_-]{35}\b)")


class Stopped(Exception):
    pass


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def parse_cutoff(value: str | None) -> datetime | None:
    if value is None:
        return None
    result = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if result.tzinfo is None or result.utcoffset() is None:
        raise ValueError("--cutoff must include a timezone offset")
    if result <= datetime.now(timezone.utc):
        raise ValueError("--cutoff must be in the future")
    return result


class Guard:
    def __init__(self, cutoff: datetime | None):
        if (os.environ.get("CODEX_USAGE_GUARD_MANAGED") != "1"
                or os.environ.get("CODEX_USAGE_GUARD_PROJECT_ID") != "15"
                or not os.environ.get("CODEX_USAGE_GUARD_RUNTIME")):
            raise ValueError("Launch through guard.guard_run --project-id 15")
        sentinel = os.environ.get("CODEX_USAGE_GUARD_STOP_FILE")
        if not sentinel:
            raise ValueError("guard.guard_run must supply --stop-file")
        self.stop_file, self.cutoff = Path(sentinel).resolve(), cutoff

    def check(self) -> None:
        # guard_run monitors the durable central gate and sets this registered
        # cooperative sentinel on a project hold. Never remove the sentinel.
        if self.stop_file.exists():
            raise Stopped("guard_stop_requested")
        if self.cutoff and datetime.now(timezone.utc) >= self.cutoff:
            raise Stopped("cutoff_reached")


def public_name(relative: str) -> None:
    parts = relative.split("/")
    if (not relative or relative.startswith("/") or "\\" in relative or ":" in relative
            or any(part in {"", ".", ".."} for part in parts)
            or any(part.lower() in FORBIDDEN or part.lower().startswith("generation-") for part in parts)
            or any(part.startswith(".") and part not in {".gitignore", ".gitattributes"} for part in parts)
            or any(part.lower() in {"work-state.json", "stop", "pause", "stop.request"} for part in parts)
            or Path(relative).suffix.lower() in {".stop", ".tmp", ".partial", ".log", ".pyc", ".png"}):
        raise ValueError("Private, temporary or unsafe input name: " + relative)


def privacy(data: bytes, relative: str) -> None:
    text = data.decode("utf-8-sig")
    if relative.endswith(".md"):
        text = text.replace("`file" + "://`", "[local-file-scheme]")
    if relative == "tests/artwork.test.cjs":
        text = re.sub(r"\b[A-Za-z]:[\\/]+Users[\\/]+(?=['\"])", "", text)
    if PRIVATE.search(text) or LOCAL.search(text) or SECRET.search(text):
        raise ValueError("Private metadata, absolute local path or credential: " + relative)


def read(path: Path, guard: Guard) -> bytes:
    guard.check()
    blocks = []
    with path.open("rb") as stream:
        while block := stream.read(CHUNK):
            guard.check()
            blocks.append(block)
    return b"".join(blocks)


def plan_tree(root: Path, guard: Guard, prefix: str = "") -> list[dict]:
    if root.is_symlink():
        raise ValueError("A release root must not be a symlink")
    result = []
    for path in sorted(root.rglob("*")):
        guard.check()
        if path.is_symlink():
            raise ValueError("Symlinks are forbidden in release inputs")
        relative = path.relative_to(root).as_posix()
        public_name(relative)
        if not path.is_file():
            continue
        if not path.resolve(strict=True).is_relative_to(root):
            raise ValueError("Release input escapes its root")
        data = read(path, guard)
        if path.suffix.lower() not in {".webp", ".gz"}:
            privacy(data, relative)
        result.append({"source": path, "path": prefix + relative,
                       "relative": relative, "bytes": len(data), "sha256": sha(data)})
    return result


def verify_artwork(root: Path, entries: list[dict], guard: Guard, dist_prefix: str) -> dict[int, str]:
    by_name = {item["relative"]: item for item in entries}
    manifest = json.loads(read(root / (dist_prefix + "data/artwork-sources.json"), guard))
    if dist_prefix and json.loads(read(root / "art-direction/artwork-manifest.json", guard)) != manifest:
        raise ValueError("Public artwork and website source manifests differ")
    images = manifest.get("images", [])
    if (manifest.get("complete") is not True or manifest.get("count") != 64 or len(images) != 64
            or {item.get("hexagramNumber") for item in images} != set(range(1, 65))):
        raise ValueError("The existing 64-image artwork manifest is incomplete")
    hashes = {}
    for image in images:
        guard.check()
        number = image["hexagramNumber"]
        relative = dist_prefix + f"assets/personality/hexagram-{number:02d}.webp"
        item = by_name.get(relative)
        if (not item or item["bytes"] != image.get("bytes") or item["sha256"] != image.get("sha256")
                or image.get("src") != f"./assets/personality/hexagram-{number:02d}.webp"):
            raise ValueError("Existing WebP hash/size mismatch: " + relative)
        data = read(item["source"], guard)
        if data[:4] != b"RIFF" or data[8:12] != b"WEBP":
            raise ValueError("Invalid WebP signature: " + relative)
        hashes[number] = item["sha256"]
    if len(set(hashes.values())) != 64:
        raise ValueError("The 64 existing WebPs must remain distinct")
    return hashes


def verify_gzip(public: Path, entries: list[dict], guard: Guard) -> tuple[list[dict], dict[str, bytes]]:
    by_name = {item["relative"]: item for item in entries}
    for required in ("README.md", "LICENSE", "scripts/prepare-source.py", "source-archive-manifest.json"):
        if required not in by_name:
            raise ValueError("Incomplete public source: " + required)
    manifest = json.loads(read(public / "source-archive-manifest.json", guard))
    records = manifest.get("entries", [])
    if (manifest.get("schemaVersion") != "1.0.0" or manifest.get("format") != "gzip"
            or len(records) != 4 or {item.get("path") for item in records} != ARCHIVE_SOURCES
            or {name for name in by_name if name.endswith(".gz")} != {name + ".gz" for name in ARCHIVE_SOURCES}):
        raise ValueError("The public source must preserve exactly its four known gzip archives")
    checks, restored = [], {}
    for item in records:
        guard.check()
        if item.get("archive") != item["path"] + ".gz" or not 0 < item.get("bytes", 0) <= 4_000_000:
            raise ValueError("Invalid protected gzip manifest entry")
        packed = read(public / item["archive"], guard)
        if len(packed) != item.get("archiveBytes") or sha(packed) != item.get("archiveSha256"):
            raise ValueError("Protected gzip archive hash/size mismatch")
        with gzip.GzipFile(fileobj=io.BytesIO(packed)) as stream:
            data = stream.read(item["bytes"] + 1)
        guard.check()
        if len(data) != item["bytes"] or sha(data) != item.get("sha256"):
            raise ValueError("Protected gzip restored hash/size mismatch")
        privacy(data, item["path"])
        restored[item["path"]] = data
        checks.append({"path": item["archive"], "archiveSha256": sha(packed),
                       "restoredSha256": sha(data), "passed": True})
    return checks, restored


def promote_new(temporary: Path, final: Path, guard: Guard) -> None:
    guard.check()
    if final.exists():
        raise FileExistsError("Refusing to overwrite a release output")
    if os.name == "nt":
        temporary.rename(final)  # Windows rename refuses an existing destination.
    else:
        os.link(temporary, final)  # Atomic create-if-absent, on the same volume.
        temporary.unlink()


def write_zip(output: Path, entries: list[dict], guard: Guard) -> dict:
    temporary = output.with_name(output.name + ".tmp")
    if output.exists() or temporary.exists():
        raise FileExistsError("Refusing to overwrite a release or checkpoint")
    with zipfile.ZipFile(temporary, "x", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for item in entries:
            guard.check()
            data = read(item["source"], guard)
            if len(data) != item["bytes"] or sha(data) != item["sha256"]:
                raise ValueError("Input changed while packaging: " + item["path"])
            archive.writestr(item["path"], data)
    with temporary.open("r+b") as stream:
        os.fsync(stream.fileno())
    expected = {item["path"]: item for item in entries}
    checks = []
    with zipfile.ZipFile(temporary) as archive:
        if len(archive.infolist()) != len(expected) or set(archive.namelist()) != expected.keys():
            raise ValueError("ZIP members differ from the dynamic source manifest")
        for info in archive.infolist():
            guard.check()
            hasher, crc, size = hashlib.sha256(), 0, 0
            with archive.open(info) as stream:
                while block := stream.read(CHUNK):
                    guard.check()
                    hasher.update(block)
                    crc = binascii.crc32(block, crc)
                    size += len(block)
            item = expected[info.filename]
            if size != item["bytes"] or hasher.hexdigest() != item["sha256"] or crc & 0xFFFFFFFF != info.CRC:
                raise ValueError("ZIP member CRC/SHA256/size mismatch: " + info.filename)
            checks.append({"path": info.filename, "bytes": size, "sha256": hasher.hexdigest(),
                           "crc32": f"{info.CRC:08x}"})
    return {"filename": output.name, "bytes": temporary.stat().st_size,
            "sha256": sha(read(temporary, guard)), "fileCount": len(checks),
            "crcCheck": "passed", "memberSha256Check": "passed", "files": checks}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-directory", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--public-source", type=Path, required=True, help="Sanitized, synchronized public snapshot")
    parser.add_argument("--output-directory", type=Path, required=True, help="A new directory; must not exist")
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--cutoff", help="Optional future ISO-8601 time with timezone offset")
    args = parser.parse_args()
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,79}", args.run_id):
        parser.error("--run-id must be 1-80 letters, digits, dots, underscores or hyphens")
    cutoff = parse_cutoff(args.cutoff)
    guard = Guard(cutoff)
    guard.check()
    source = args.source_directory.resolve(strict=True)
    public = args.public_source.resolve(strict=True)
    output = args.output_directory.resolve()
    dist = source / "dist"
    if (args.source_directory.is_symlink() or args.public_source.is_symlink()
            or not source.is_dir() or not public.is_dir() or source == public
            or source.is_relative_to(public) or public.is_relative_to(source)
            or output.exists() or output.is_relative_to(source) or output.is_relative_to(public)):
        raise ValueError("Use separate source/public directories and a new output directory outside both")
    web = plan_tree(dist, guard)
    public_plan = plan_tree(public, guard, "gua-jian-self-64/")
    if "index.html" not in {item["relative"] for item in web}:
        raise ValueError("The website ZIP must have index.html at its root")
    web_art = verify_artwork(dist, web, guard, "")
    public_art = verify_artwork(public, public_plan, guard, "dist/")
    if public_art != web_art:
        raise ValueError("Public-source and website artwork bytes differ")
    gzip_checks, restored = verify_gzip(public, public_plan, guard)
    public_by_name = {item["relative"]: item for item in public_plan}
    for item in web:
        name = "dist/" + item["relative"]
        counterpart = public_by_name.get(name)
        matches = (counterpart and counterpart["sha256"] == item["sha256"] and counterpart["bytes"] == item["bytes"])
        if not matches and (name not in restored or sha(restored[name]) != item["sha256"]):
            raise ValueError("Public source is not synchronized with dist: " + name)
    guard.check()
    output.mkdir(parents=True, exist_ok=False)
    stem = "guajian-modes-" + args.run_id
    web_output, public_output = output / (stem + "-website.zip"), output / (stem + "-public-source.zip")
    website = write_zip(web_output, web, guard)
    public_archive = write_zip(public_output, public_plan, guard)
    # Recheck every source after both archives exist, before promoting any output.
    for item in web + public_plan:
        if sha(read(item["source"], guard)) != item["sha256"]:
            raise ValueError("Input changed before release completion: " + item["path"])
    report = {"schemaVersion": "1.0.0", "status": "complete", "runId": args.run_id,
              "createdUtc": datetime.now(timezone.utc).isoformat(),
              "cutoffAt": cutoff.isoformat() if cutoff else None,
              "artworkCount": len(web_art), "artworkPreserved": True,
              "gzipPreservationCheck": gzip_checks, "prepareSourceSha256": public_by_name["scripts/prepare-source.py"]["sha256"],
              "privacyCheck": "passed", "website": website, "publicSource": public_archive}
    manifest = output / "release-manifest.json"
    staged_manifest = manifest.with_name(manifest.name + ".tmp")
    with staged_manifest.open("x", encoding="utf-8", newline="\n") as stream:
        json.dump(report, stream, ensure_ascii=False, indent=2)
        stream.write("\n")
        stream.flush()
        os.fsync(stream.fileno())
    for target in (web_output, public_output, manifest):
        promote_new(target.with_name(target.name + ".tmp"), target, guard)
    print(json.dumps({"status": "complete", "runId": args.run_id,
                      "website": website["filename"], "publicSource": public_archive["filename"],
                      "manifest": manifest.name, "websiteFiles": len(web), "publicFiles": len(public_plan)}))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Stopped as error:
        print(json.dumps({"status": "stopped", "reason": str(error)}), flush=True)
        raise SystemExit(75)
    except Exception as error:
        print(json.dumps({"status": "failed", "error": type(error).__name__, "message": str(error)}), file=sys.stderr)
        raise SystemExit(1)
