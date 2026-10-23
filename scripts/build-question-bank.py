"""Build an auditable, finite 100000-item contextual derivative bank.

No network access or model inference occurs. Raw source archives stay unchanged.
The static site ships a compact recipe; the full finite set is also materialized
as question-bank/derived-items.jsonl with matching stable QB identifiers.
"""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import unicodedata

ROOT = Path(__file__).resolve().parents[1]
AXES = ["energy", "information", "decision", "organization", "emotion", "coordination"]
VERSION = "2.1.0"
TOTAL = 100000
CHUNKS = ROOT / "question-bank"


def stopped(stop_file: Path) -> None:
    if stop_file.exists():
        raise SystemExit(75)


def normalized(text: str) -> str:
    return re.sub(r"[\W_]+", "", unicodedata.normalize("NFKC", text).lower())


def read_json(file: Path):
    return json.loads(file.read_text(encoding="utf-8-sig"))


def compact(value) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def sha_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_json(path: Path, value, stop_file: Path) -> None:
    stopped(stop_file)
    temporary = path.with_suffix(path.suffix + ".partial")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    stopped(stop_file)
    temporary.replace(path)


def contexts_from(raw: dict) -> dict:
    scenarios = raw.get("scenarios")
    if scenarios is None and "axes" in raw:
        scenarios = {axis: (raw["axes"][axis].get("scenarios") if isinstance(raw["axes"][axis], dict) else raw["axes"][axis]) for axis in AXES}
    constraints = raw.get("constraints")
    assert isinstance(scenarios, dict) and isinstance(constraints, list), "Context source needs scenarios by axis and constraints"
    assert len(constraints) == 12 and len(set(constraints)) == 12, "Exactly 12 unique neutral constraints required"
    for axis in AXES:
        assert len(scenarios[axis]) == 29 and len(set(scenarios[axis])) == 29, f"Exactly 29 unique scenarios needed for {axis}"
    assert all(isinstance(text, str) and text.strip() for text in constraints), "Blank constraint"
    assert all(isinstance(text, str) and text.strip() for axis in AXES for text in scenarios[axis]), "Blank scenario"
    return {"scenarios": {axis: scenarios[axis] for axis in AXES}, "constraints": constraints}


def make_item(bank: dict, bucket: dict, local: int, seed_by_id: dict) -> dict:
    seed_index = local % 24
    context_index = local // 24
    seed = seed_by_id[bucket["seedIds"][seed_index]]
    scene = context_index // 12
    constraint = context_index % 12
    return {
        "id": f"QB{bucket['start'] + local:06d}",
        "text": f"情境：{bank['contexts']['scenarios'][bucket['axis']][scene]}，{bank['contexts']['constraints'][constraint]}。\n{seed['text']}",
        "axis": bucket["axis"], "direction": bucket["direction"], "family": seed["family"], "semanticCluster": seed["semanticCluster"],
        "contextId": f"C-{bucket['axis']}-{scene + 1:02d}-{constraint + 1:02d}",
        "seedId": seed["id"], "seedText": seed["text"], "sourceIds": seed["sourceIds"], "adaptationNote": seed["adaptationNote"]
    }


def supports(type_key: str, axis: str, direction: int) -> bool:
    personality, emotion, coordination = type_key.split("-")
    positive = {"energy": "E", "information": "S", "decision": "T", "organization": "J", "emotion": "calm", "coordination": "autonomous"}
    actual = personality[AXES.index(axis)] if axis in AXES[:4] else (emotion if axis == "emotion" else coordination)
    return (actual == positive[axis]) == (direction == 1)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--stop-file", type=Path, default=Path(os.environ.get("GUA_BANK_STOP_FILE", str(CHUNKS / "build.stop"))))
    args = parser.parse_args()
    stopped(args.stop_file)
    paths = [ROOT / "research" / name for name in ["source-items.json", "bank-seeds-a.json", "bank-seeds-b.json", "bank-contexts.json"]]
    originals = read_json(paths[0])
    source_items = originals["items"]
    assert len(source_items) == 3370 and len({item["id"] for item in source_items}) == 3370, "Expected 3370 archived source items"
    source_by_id = {item["id"]: item for item in source_items}
    seeds = read_json(paths[1]) + read_json(paths[2])
    seeds.sort(key=lambda seed: seed["id"])
    assert len(seeds) == 288 and len({seed["id"] for seed in seeds}) == 288, "Expected 288 unique seeds"
    assert len({seed["family"] for seed in seeds}) == 288, "Seed family identifiers must be unique"
    assert len({normalized(seed["text"]) for seed in seeds}) == 288, "Seed texts must be unique"
    for seed in seeds:
        seed["semanticCluster"] = seed.get("semanticCluster") or seed["family"]
        assert isinstance(seed["semanticCluster"], str) and seed["semanticCluster"].strip(), "Semantic cluster must be a nonempty string"
        assert seed["axis"] in AXES and seed["direction"] in (-1, 1), f"Invalid seed axis/direction: {seed['id']}"
        assert seed["sourceIds"] and seed["adaptationNote"], f"Missing provenance: {seed['id']}"
        for parent in seed["sourceIds"]:
            assert parent in source_by_id, f"Parent missing: {parent}"
            assert not source_by_id[parent].get("review", {}).get("status", "").startswith("excluded"), f"Excluded clinical parent: {parent}"
    contexts = contexts_from(read_json(paths[3]))
    buckets = []
    start = 1
    for index, (axis, direction) in enumerate((axis, direction) for axis in AXES for direction in (1, -1)):
        seed_ids = sorted(seed["id"] for seed in seeds if seed["axis"] == axis and seed["direction"] == direction)
        assert len(seed_ids) == 24, f"Need 24 seeds in {axis}/{direction}"
        quota = 8334 if index < 4 else 8333
        buckets.append({"id": axis + ("-positive" if direction == 1 else "-negative"), "axis": axis, "direction": direction, "start": start, "count": quota, "capacity": 8352, "seedIds": seed_ids})
        start += quota
    assert start == TOTAL + 1
    used_ids = sorted({parent for seed in seeds for parent in seed["sourceIds"]})
    parent_catalog = [{key: source_by_id[parent][key] for key in ["id", "text", "sourceId", "source", "license", "licenseSource"]} for parent in used_ids]
    bank = {"version": VERSION, "count": TOTAL, "sourceCount": len(source_items), "seedCount": len(seeds), "semanticClusterCount": len({seed["semanticCluster"] for seed in seeds}), "sourceCounts": dict(Counter(item["sourceId"] for item in source_items)), "seeds": seeds, "sources": parent_catalog, "contexts": contexts, "buckets": buckets,
            "countingNote": "3370 archived original items, 288 project-authored semantic seed families, 100000 contextual derivatives. Translations and variants do not increase the original count; no psychometric validity is inherited.",
            "recipe": {"seedIndex": "localIndex % 24", "contextIndex": "floor(localIndex / 24)", "sceneIndex": "floor(contextIndex / 12)", "constraintIndex": "contextIndex % 12", "text": "情境：{scenario}，{constraint}。\\n{seed.text}"},
            "inputSha256": {path.relative_to(ROOT).as_posix(): sha_file(path) for path in paths}}
    stopped(args.stop_file)
    CHUNKS.mkdir(exist_ok=True)
    derived_path = CHUNKS / "derived-items.jsonl"
    partial = derived_path.with_suffix(".jsonl.partial")
    seed_by_id = {seed["id"]: seed for seed in seeds}
    seen = set()
    emitted = 0
    with partial.open("w", encoding="utf-8", newline="\n") as handle:
        for bucket in buckets:
            for local in range(bucket["count"]):
                if emitted % 256 == 0:
                    stopped(args.stop_file)
                item = make_item(bank, bucket, local, seed_by_id)
                canonical_text = normalized(item["text"])
                assert canonical_text not in seen, f"Duplicate normalized item: {item['id']}"
                seen.add(canonical_text)
                handle.write(compact(item) + "\n")
                emitted += 1
    assert emitted == TOTAL
    stopped(args.stop_file)
    partial.replace(derived_path)
    originals_path = CHUNKS / "original-items.jsonl"
    originals_partial = originals_path.with_suffix(".jsonl.partial")
    with originals_partial.open("w", encoding="utf-8", newline="\n") as handle:
        for index, item in enumerate(source_items):
            if index % 128 == 0:
                stopped(args.stop_file)
            handle.write(compact(item) + "\n")
    stopped(args.stop_file)
    originals_partial.replace(originals_path)
    write_json(CHUNKS / "catalog.json", bank, args.stop_file)
    type_keys = [a + b + c + d + "-" + emotion + "-" + coordination for a in "EI" for b in "SN" for c in "TF" for d in "JP" for emotion in ["calm", "sensitive"] for coordination in ["autonomous", "cooperative"]]
    routing = {key: {"meaning": "Agreement with an item supports one endpoint; full results require all six axes.", "total": sum(bucket["count"] for bucket in buckets if supports(key, bucket["axis"], bucket["direction"])), "ranges": [{"start": bucket["start"], "count": bucket["count"], "axis": bucket["axis"], "direction": bucket["direction"]} for bucket in buckets if supports(key, bucket["axis"], bucket["direction"])]} for key in type_keys}
    write_json(CHUNKS / "routing-index.json", {"version": VERSION, "typeCount": 64, "routes": routing}, args.stop_file)
    runtime_path = ROOT / "dist" / "data" / "bank.js"
    runtime_partial = runtime_path.with_suffix(".js.partial")
    runtime_partial.write_text("window.GuaData=window.GuaData||{};window.GuaData.bank=" + compact(bank).replace("</", "<\\/") + ";\n", encoding="utf-8")
    stopped(args.stop_file)
    runtime_partial.replace(runtime_path)
    outputs = [derived_path, originals_path, CHUNKS / "catalog.json", CHUNKS / "routing-index.json", runtime_path]
    manifest = {"version": VERSION, "builtAt": datetime.now(timezone.utc).isoformat(), "sourceCount": len(source_items), "sourceCounts": bank["sourceCounts"], "seedCount": len(seeds), "semanticClusterCount": bank["semanticClusterCount"], "derivedCount": emitted, "uniqueNormalizedDerivedCount": len(seen), "familyCount": len({seed['family'] for seed in seeds}), "inputs": bank["inputSha256"], "bucketCounts": {bucket["id"]: bucket["count"] for bucket in buckets}, "outputs": [{"file": path.relative_to(ROOT).as_posix(), "bytes": path.stat().st_size, "sha256": sha_file(path)} for path in outputs], "countingNote": bank["countingNote"]}
    write_json(CHUNKS / "manifest.json", manifest, args.stop_file)
    print(json.dumps({key: manifest[key] for key in ["version", "sourceCount", "sourceCounts", "seedCount", "derivedCount", "uniqueNormalizedDerivedCount"]}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except SystemExit:
        raise
    except Exception as error:
        print(f"Question-bank build failed: {error}", file=sys.stderr)
        raise SystemExit(1)
