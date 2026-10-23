"""Collect original public-domain IPIP items without inflating unique counts.

The website's questionnaire is deliberately not changed by this research task.
Raw pages and the official item-assignment workbook are preserved with SHA256.
Run through Codex Usage Guard when collecting, and use --offline to reproduce
the JSON exports from the preserved evidence without making network requests.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from datetime import datetime, timezone
from hashlib import sha256
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
import json
import re
import sys
import unicodedata
from urllib.parse import urljoin
from urllib.request import Request, urlopen
import zipfile
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
RESEARCH = ROOT / "research"
RAW = RESEARCH / "raw"
STOP = RESEARCH / "collect.stop"
IPIP = "https://ipip.ori.org/"
PAGES = {
    "ipip-home.html": IPIP,
    "ipip-permission.html": IPIP + "newPermission.htm",
    "ipip-alphabetical-items.html": IPIP + "AlphabeticalItemList.htm",
    "ipip-item-assignment.html": IPIP + "ItemAssignmentTable.htm",
    "sapa-master-item-list.html": "https://www.sapa-project.org/research/masteritemlist.html",
    "tipi-permission.html": "https://gosling.psy.utexas.edu/scales-weve-developed/ten-item-personality-measure-tipi/",
    "tipi-items.html": "https://gosling.psy.utexas.edu/scales-weve-developed/ten-item-personality-measure-tipi/ten-item-personality-inventory-tipi/",
    "minimarkers-permission.html": "https://pages.uoregon.edu/gsaucier/gsau4a.html",
    "minimarkers-items.html": "https://pages.uoregon.edu/gsaucier/gsau41oldversion.htm",
    "bim-permission.html": "https://labs.wsu.edu/caw/scales/",
    "riasec-permission.html": "https://jrounds.weebly.com/riasec-markers-scalesitems.html",
    "onet-tool-license.html": "https://www.onetcenter.org/license_tools.html",
}


def stopped() -> None:
    if STOP.exists():
        raise SystemExit(75)


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFKC", text)
    text = text.translate(str.maketrans({"’": "'", "‘": "'", "“": '"', "”": '"'})).lower()
    return " ".join(re.sub(r"[^\w\s]", "", text, flags=re.UNICODE).split())


def decode(raw: bytes) -> str:
    match = re.search(br"charset\s*=\s*[\"']?([\w-]+)", raw[:3000], re.I)
    if match:
        try:
            return raw.decode(match[1].decode("ascii"))
        except (LookupError, UnicodeDecodeError):
            pass
    try:
        return raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        return raw.decode("cp1252")


class Tables(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.rows: list[list[str]] = []
        self.row: list[str] | None = None
        self.cell: list[str] | None = None
        self.links: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "tr":
            self.row = []
        elif tag in ("td", "th"):
            self.cell = []
        elif tag in ("br", "p") and self.cell is not None:
            self.cell.append(" ")
        if tag == "a":
            href = dict(attrs).get("href")
            if href:
                self.links.append(href)

    def handle_endtag(self, tag: str) -> None:
        if tag in ("td", "th") and self.cell is not None:
            if self.row is not None:
                self.row.append(" ".join("".join(self.cell).split()))
            self.cell = None
        elif tag == "tr" and self.row is not None:
            self.rows.append(self.row)
            self.row = None

    def handle_data(self, text: str) -> None:
        if self.cell is not None:
            self.cell.append(text)


class VisibleText(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.skip = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in ("script", "style"):
            self.skip += 1
        if tag in ("br", "p", "div", "li", "tr"):
            self.parts.append(" ")

    def handle_endtag(self, tag: str) -> None:
        if tag in ("script", "style"):
            self.skip = max(0, self.skip - 1)
        if tag in ("p", "div", "li", "tr"):
            self.parts.append(" ")

    def handle_data(self, text: str) -> None:
        if not self.skip:
            self.parts.append(text)


def visible(html: str) -> str:
    parser = VisibleText()
    parser.feed(html)
    return " ".join("".join(parser.parts).split())


def collect_extra_items(pages: dict[str, str]) -> list[dict]:
    tipi_permission = visible(pages["tipi-permission.html"]).lower()
    if "anyone can use it for any purpose" not in tipi_permission:
        raise RuntimeError("TIPI author permission is no longer confirmed")
    tipi_text = visible(pages["tipi-items.html"])
    tipi_pairs = re.findall(r"\b(10|[1-9])\.\s*_{2,}\s*(.*?)(?=\s*(?:\b(?:10|[1-9])\.\s*_{2,}|TIPI scale scoring))", tipi_text)
    if len(tipi_pairs) != 10:
        raise RuntimeError(f"Expected ten original TIPI item pairs, found {len(tipi_pairs)}")
    tipi_keys = {1: ("Extraversion", 1), 2: ("Agreeableness", -1), 3: ("Conscientiousness", 1), 4: ("Emotional Stability", -1), 5: ("Openness to Experiences", 1), 6: ("Extraversion", -1), 7: ("Agreeableness", 1), 8: ("Conscientiousness", -1), 9: ("Emotional Stability", 1), 10: ("Openness to Experiences", -1)}
    items = []
    for number, text in tipi_pairs:
        index = int(number)
        label, key = tipi_keys[index]
        items.append({"id": f"tipi-{index:02d}", "originalIds": [str(index)], "originalIdAnnotations": [str(index)], "text": text.strip(), "language": "en", "source": PAGES["tipi-items.html"], "sourceId": "tipi-gosling", "license": "author-permission-any-purpose", "licenseSource": PAGES["tipi-permission.html"], "scaleKeys": [{"instrument": "TIPI", "label": label, "key": key, "alpha": "", "source": PAGES["tipi-items.html"]}], "normalizedText": normalize(text), "wordingVariants": [], "originalResponseFormat": "I see myself as: [paired adjectives], 1–7 agreement", "itemKind": "paired-adjectives"})

    mm_permission = visible(pages["minimarkers-permission.html"]).lower()
    if "public-domain personality instruments" not in mm_permission or "no need to ask for permission" not in mm_permission:
        raise RuntimeError("Mini-Markers author public-domain statement is no longer confirmed")
    mm_text = visible(pages["minimarkers-items.html"])
    list_start = mm_text.find("____ Bashful")
    if list_start < 0:
        raise RuntimeError("Mini-Markers original item list could not be located")
    list_text = mm_text[list_start:].split("How to score", 1)[0]
    adjectives = re.findall(r"_{2,}\s*([A-Za-z-]+)", list_text)
    if len(adjectives) != 40 or len(set(map(str.lower, adjectives))) != 40:
        raise RuntimeError(f"Expected forty unique Mini-Markers adjectives, found {len(adjectives)}")
    mm_keys = {
        "Extraversion": (["talkative", "bold", "extraverted", "energetic"], ["shy", "bashful", "quiet", "withdrawn"]),
        "Agreeableness": (["sympathetic", "warm", "kind", "cooperative"], ["cold", "unsympathetic", "rude", "harsh"]),
        "Conscientiousness": (["organized", "efficient", "systematic", "practical"], ["disorganized", "sloppy", "inefficient", "careless"]),
        "Emotional Stability": (["unenvious", "relaxed"], ["moody", "jealous", "temperamental", "envious", "touchy", "fretful"]),
        "Intellect or Openness": (["creative", "imaginative", "philosophical", "intellectual", "complex", "deep"], ["uncreative", "unintellectual"]),
    }
    for adjective in adjectives:
        item_word = adjective.lower()
        assignment = next(((label, 1 if item_word in positive else -1) for label, (positive, negative) in mm_keys.items() if item_word in positive or item_word in negative), None)
        if assignment is None:
            raise RuntimeError(f"Unknown Mini-Markers adjective: {adjective}")
        label, key = assignment
        items.append({"id": "minimarkers-" + item_word, "originalIds": [adjective], "originalIdAnnotations": [adjective], "text": adjective, "language": "en", "source": PAGES["minimarkers-items.html"], "sourceId": "minimarkers-saucier", "license": "public-domain", "licenseSource": PAGES["minimarkers-permission.html"], "scaleKeys": [{"instrument": "Mini-Markers", "label": label, "key": key, "alpha": "", "source": PAGES["minimarkers-items.html"]}], "normalizedText": normalize(adjective), "wordingVariants": [], "originalResponseFormat": "Self-description by one adjective, 1–9 accuracy", "itemKind": "single-adjective"})
    return items


def fetch(url: str, filename: str, *, offline: bool, refresh: bool, manifest: list[dict]) -> bytes:
    stopped()
    destination = RAW / filename
    if not destination.exists() or refresh:
        if offline:
            raise RuntimeError(f"Offline source is missing: {destination}")
        request = Request(url, headers={"User-Agent": "GuaJianSelfResearch/1.0 (public-domain item archival; no participant data)"})
        with urlopen(request, timeout=35) as response:
            payload = response.read(12_000_001)
            if len(payload) > 12_000_000:
                raise RuntimeError(f"Unexpectedly large source: {url}")
        stopped()
        destination.write_bytes(payload)
    payload = destination.read_bytes()
    manifest.append({"url": url, "file": destination.relative_to(ROOT).as_posix(), "bytes": len(payload), "sha256": sha256(payload).hexdigest()})
    return payload


def workbook_rows(raw: bytes) -> list[list[str]]:
    import io
    ns = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    with zipfile.ZipFile(io.BytesIO(raw)) as book:
        shared = []
        if "xl/sharedStrings.xml" in book.namelist():
            strings = ET.fromstring(book.read("xl/sharedStrings.xml"))
            shared = ["".join(node.itertext()) for node in strings.findall("s:si", ns)]
        sheet_files = sorted(name for name in book.namelist() if re.fullmatch(r"xl/worksheets/sheet\d+\.xml", name))
        all_rows = []
        for filename in sheet_files:
            sheet = ET.fromstring(book.read(filename))
            for row in sheet.findall(".//s:sheetData/s:row", ns):
                cells = {}
                for cell in row.findall("s:c", ns):
                    reference = cell.attrib.get("r", "A1")
                    letters = re.match(r"[A-Z]+", reference).group()
                    index = 0
                    for letter in letters:
                        index = index * 26 + ord(letter) - ord("A") + 1
                    value = cell.find("s:v", ns)
                    text = value.text if value is not None and value.text is not None else ""
                    if cell.attrib.get("t") == "s":
                        text = shared[int(text)] if text else ""
                    elif cell.attrib.get("t") == "inlineStr":
                        inline = cell.find("s:is", ns)
                        text = "".join(inline.itertext()) if inline is not None else ""
                    cells[index - 1] = text
                if cells:
                    all_rows.append([cells.get(index, "") for index in range(max(cells) + 1)])
        return all_rows


def write_json(name: str, value: object) -> None:
    stopped()
    output = RESEARCH / name
    temporary = output.with_suffix(output.suffix + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(output)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--offline", action="store_true", help="Rebuild from raw evidence without downloading")
    parser.add_argument("--refresh", action="store_true", help="Refresh public source snapshots")
    args = parser.parse_args()
    if args.offline and args.refresh:
        parser.error("--offline and --refresh cannot be combined")
    stopped()
    RAW.mkdir(parents=True, exist_ok=True)
    manifest = []
    pages = {name: decode(fetch(url, name, offline=args.offline, refresh=args.refresh, manifest=manifest)) for name, url in PAGES.items()}
    license_text = " ".join(re.sub(r"<[^>]+>", " ", pages["ipip-permission.html"]).split())
    if "public domain" not in license_text.lower() or "commercial" not in license_text.lower():
        raise RuntimeError("IPIP permission page no longer confirms public-domain commercial use")
    item_parser = Tables()
    item_parser.feed(pages["ipip-alphabetical-items.html"])
    groups = {}
    raw_count = 0
    for cells in item_parser.rows:
        if len(cells) < 2 or not re.fullmatch(r"[A-Z]\d+\*?(?:\s*,\s*[A-Z]\d+\*?)*", cells[1]):
            continue
        raw_count += 1
        text = cells[0].strip()
        ids = re.findall(r"[A-Z]\d+\*?", cells[1])
        normalized = normalize(text)
        if normalized not in groups:
            primary = ids[0].rstrip("*")
            groups[normalized] = {"id": "ipip-" + primary, "originalIds": [], "originalIdAnnotations": [], "text": text, "language": "en", "source": PAGES["ipip-alphabetical-items.html"], "sourceId": "ipip-ori", "license": "public-domain", "licenseSource": PAGES["ipip-permission.html"], "scaleKeys": [], "normalizedText": normalized, "wordingVariants": []}
        item = groups[normalized]
        for identifier in ids:
            if identifier.rstrip("*") not in item["originalIds"]:
                item["originalIds"].append(identifier.rstrip("*"))
            if identifier not in item["originalIdAnnotations"]:
                item["originalIdAnnotations"].append(identifier)
        if text != item["text"] and text not in item["wordingVariants"]:
            item["wordingVariants"].append(text)
    if raw_count < 3300 or len(groups) < 3200:
        raise RuntimeError(f"IPIP parse unexpectedly incomplete: {raw_count} source rows, {len(groups)} normalized originals")

    assignment_parser = Tables()
    assignment_parser.feed(pages["ipip-item-assignment.html"])
    assignment_link = next((urljoin(IPIP, href) for href in assignment_parser.links if re.search(r"\.xlsx(?:$|\?)", href, re.I)), None)
    if not assignment_link:
        raise RuntimeError("Official item-assignment workbook link was not found")
    workbook = fetch(assignment_link, "ipip-item-assignment.xlsx", offline=args.offline, refresh=args.refresh, manifest=manifest)
    rows = workbook_rows(workbook)
    header_index = next((index for index, row in enumerate(rows) if {"instrument", "key", "text", "label"}.issubset({cell.strip().lower() for cell in row})), None)
    if header_index is None:
        raise RuntimeError("Official assignment workbook header is not recognized")
    headers = [cell.strip().lower() for cell in rows[header_index]]
    assigned_count = 0
    unmatched = []
    for row in rows[header_index + 1:]:
        values = dict(zip(headers, row))
        text = values.get("text", "").strip()
        if not text:
            continue
        try:
            key = int(float(values.get("key", "")))
        except ValueError:
            continue
        if key not in (-1, 1):
            continue
        assignment = {"instrument": values.get("instrument", ""), "label": values.get("label", ""), "key": key, "alpha": values.get("alpha", ""), "source": assignment_link}
        item = groups.get(normalize(text))
        if item is None:
            unmatched.append({"text": text, "scaleKey": assignment})
            continue
        if assignment not in item["scaleKeys"]:
            item["scaleKeys"].append(assignment)
            assigned_count += 1

    ipip_count = len(groups)
    extra_items = collect_extra_items(pages)
    for extra in extra_items:
        if extra["normalizedText"] in groups:
            raise RuntimeError("Cross-source duplicate needs explicit audit: " + extra["id"])
        groups[extra["normalizedText"]] = extra
    items = list(groups.values())
    for item in items:
        known_clinical = item["sourceId"] == "ipip-ori" and any(identifier.startswith("T") for identifier in item["originalIds"])
        clinical_scale = any(re.search(r"personality disorder|psychopath|depress|suicid|schiz|paranoi|psychoti|dissocia|somati|clinical|mania|manic|anorexi|bulimi|autis|trauma|borderline", key["instrument"] + " " + key["label"], re.I) for key in item["scaleKeys"])
        item["review"] = {"eligibleForRuntime": False, "status": "excluded-clinical-origin" if known_clinical or clinical_scale else "pending-construct-and-language-review", "reasons": (["CAT personality-disorder source or clinical-scale association; do not administer in the cultural quiz"] if known_clinical or clinical_scale else ["Original item archived; six-axis fit and Traditional Chinese adaptation are not yet reviewed"])}
    summary = {
        "originalSourceRows": raw_count + len(extra_items),
        "uniqueOriginalItems": len(items),
        "sourceCounts": dict(Counter(item["sourceId"] for item in items)),
        "ipipUniqueOriginalItems": ipip_count,
        "additionalNonIpipOriginalItems": len(extra_items),
        "normalizedDuplicateRowsCollapsed": raw_count + len(extra_items) - len(items),
        "originalIdReferences": sum(len(item["originalIds"]) for item in items),
        "scaleKeyAssignments": assigned_count + sum(len(item["scaleKeys"]) for item in extra_items),
        "itemsWithScaleKeys": sum(bool(item["scaleKeys"]) for item in items),
        "unmatchedScaleKeyRows": len(unmatched),
        "clinicalOriginOrScaleExcluded": sum(item["review"]["status"] == "excluded-clinical-origin" for item in items),
        "nonClinicalCandidatesPendingReview": sum(item["review"]["status"] != "excluded-clinical-origin" for item in items),
        "gapTo5000Originals": max(0, 5000 - len(items)),
        "gapTo10000Originals": max(0, 10000 - len(items)),
        "countingRule": "One normalized original English wording counts once; multiple ids, scale reuse, translations, and derived situations do not increase original count."
    }
    stamp = datetime.now(timezone.utc).isoformat()
    write_json("source-items.json", {"schemaVersion": "1.0.0", "collectedAt": stamp, "summary": summary, "items": items})
    write_json("unmatched-scale-keys.json", {"note": "Preserved for audit; these rows are not invented as new original items.", "rows": unmatched})
    write_json("sources.json", {
        "schemaVersion": "1.0.0", "collectedAt": stamp, "summary": summary,
        "sources": [
            {"id": "ipip-ori", "title": "International Personality Item Pool official alphabetical list", "url": PAGES["ipip-alphabetical-items.html"], "license": "public-domain", "licenseSource": PAGES["ipip-permission.html"], "licenseEvidenceFile": "research/raw/ipip-permission.html", "status": "downloaded-and-deduplicated", "uniqueOriginalItems": ipip_count, "notes": "Includes all archived IPIP origins; clinical-origin items are flagged and are not approved for the website."},
            {"id": "tipi-gosling", "title": "Ten-Item Personality Inventory, Gosling author-hosted original", "url": PAGES["tipi-items.html"], "license": "author-permission-any-purpose", "licenseSource": PAGES["tipi-permission.html"], "licenseEvidenceFile": "research/raw/tipi-permission.html", "status": "downloaded-and-deduplicated", "uniqueOriginalItems": 10, "notes": "Ten paired-adjective self-rating items, counted as ten questions rather than twenty adjectives; Big Five keys are retained without remapping to the project's six axes."},
            {"id": "minimarkers-saucier", "title": "Mini-Markers, Gerard Saucier author-hosted original", "url": PAGES["minimarkers-items.html"], "license": "public-domain", "licenseSource": PAGES["minimarkers-permission.html"], "licenseEvidenceFile": "research/raw/minimarkers-permission.html", "status": "downloaded-and-deduplicated", "uniqueOriginalItems": 40, "notes": "Forty adjective self-ratings; distinct original wordings, not forty additional independent constructs. Original Big Five signed scoring keys retained."},
            {"id": "ipip-assignments", "title": "Thomas Tedone item assignment table hosted by IPIP", "url": assignment_link, "license": "public-domain IPIP items and scales", "status": "downloaded-and-linked", "notes": "An item's signed key is scale-specific; the archive does not pretend it is a validated key for this project's six original axes."},
            {"id": "sapa-master", "title": "SAPA Master Item List", "url": PAGES["sapa-master-item-list.html"], "status": "not-downloadable-from-official-list", "uniqueOriginalItemsAdded": 0, "notes": "Official page describes about 6000 mixed constructs but says the CSV has been temporarily offline since 19 January 2018. Includes clinical/health content and approximately 2500 IPIP overlaps, so its headline count cannot be added to IPIP."},
            {"id": "oejts", "title": "Open Extended Jungian Type Scales development item pool", "url": "https://openpsychometrics.org/tests/OJTS/development/", "license": "CC-BY-NC-SA-4.0", "status": "excluded-license", "uniqueOriginalItemsAdded": 0, "notes": "Official Appendix B applies a non-commercial share-alike license to the items and page; not included in this public-domain/MIT/Apache collection."},
            {"id": "ambi", "title": "Analog to Multiple Broadband Inventories", "url": "https://openpsychometrics.org/tests/AMBI/", "license": "public-domain IPIP subset", "status": "not-counted-as-new-originals", "uniqueOriginalItemsAdded": 0, "notes": "181 items from IPIP; the 2019 respondent dataset does not create additional original items."},
            {"id": "github-ipip-neo-data", "title": "NeuroQuestAi IPIP-NEO Data", "url": "https://github.com/NeuroQuestAi/ipip-neo-data", "license": "references IPIP public-domain permission", "status": "not-counted-as-new-originals", "uniqueOriginalItemsAdded": 0, "notes": "120/300 item subsets plus participant response records and calculated scores; dataset row counts are not independent question counts."},
            {"id": "hf-ipip-scores", "title": "Hugging Face IPIP-120/300 scores", "url": "https://huggingface.co/datasets/ecorbari/IPIP120-SCORES", "license": "MIT dataset card; underlying IPIP public domain", "status": "not-counted-as-new-originals", "uniqueOriginalItemsAdded": 0, "notes": "Response records, not a new pool of hundreds of thousands of questions. No participant records downloaded for this project."},
            {"id": "bim-2008", "title": "Basic Interest Markers current author permission", "url": PAGES["bim-permission.html"], "license": "current author page restricts to noncommercial use", "status": "excluded-license-conflict", "uniqueOriginalItemsAdded": 0, "notes": "The original paper title calls these public-domain, but the current author-hosted scale page expressly says copyright and noncommercial permission. No items imported pending clear reusable terms."},
            {"id": "riasec-markers", "title": "RIASEC Markers current author permission", "url": PAGES["riasec-permission.html"], "license": "current author page restricts to noncommercial use", "status": "excluded-license-conflict", "uniqueOriginalItemsAdded": 0, "notes": "Paper title says public-domain; current author page expressly restricts free permission to noncommercial use. No items imported."},
            {"id": "onet-interest-profiler", "title": "O*NET Career Exploration Tools license", "url": PAGES["onet-tool-license.html"], "license": "CC-BY-ND-4.0 or separate O*NET Tools Developer License", "status": "excluded-adaptation-restriction", "uniqueOriginalItemsAdded": 0, "notes": "Do not conflate the tools license with the O*NET database license. The verbatim-copy license does not permit derived questionnaire items; the separate developer terms need a future deliberate integration."}
        ],
        "rawFiles": manifest
    })
    print(json.dumps(summary, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except SystemExit:
        raise
    except Exception as error:
        print(f"Collection failed: {error}", file=sys.stderr)
        raise SystemExit(1)
