#!/usr/bin/env python3
"""
Review and improve existing i18n translations via Anthropic Batch API.

Sends EN source + existing translation to Claude for quality review.
Uses Batch API by default (50% cheaper, results within 24h).

Commands:
    submit   Create and submit a batch job
    status   Check batch processing status
    collect  Download results and write updated JSON files
    live     Translate directly (immediate, no batch)

Usage:
    # Submit batch review for PL, PT, RU, SV (50% cheaper)
    python translate_i18n_review.py submit --lang pl pt ru sv

    # Check progress
    python translate_i18n_review.py status

    # Collect results when done
    python translate_i18n_review.py collect

    # Review a single language immediately (no batch)
    python translate_i18n_review.py live --lang pl

    # Only specific files
    python translate_i18n_review.py live --lang pl --files common.json medical.json

    # Translate from scratch (no existing translation)
    python translate_i18n_review.py submit --lang ja --mode translate

Requirements:
    pip install anthropic
    export ANTHROPIC_API_KEY=your_key
"""

import argparse
import json
import sys
import time
from datetime import datetime
from pathlib import Path

try:
    import anthropic
except ImportError:
    print("Install the SDK:  pip install anthropic")
    sys.exit(1)


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

LANG_NAMES = {
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "it": "Italian",
    "pt": "Portuguese",
    "pt-BR": "Brazilian Portuguese",
    "ru": "Russian",
    "nl": "Dutch",
    "sv": "Swedish",
    "pl": "Polish",
    "th": "Thai",
    "ja": "Japanese",
    "ko": "Korean",
    "zh": "Chinese (Simplified)",
    "zh-TW": "Chinese (Traditional)",
    "ar": "Arabic",
    "hi": "Hindi",
    "tr": "Turkish",
    "da": "Danish",
    "fi": "Finnish",
    "no": "Norwegian",
    "cs": "Czech",
    "uk": "Ukrainian",
    "vi": "Vietnamese",
    "id": "Indonesian",
}

MODEL = "claude-sonnet-4-20250514"
MAX_TOKENS = 32768
STATE_FILE = ".translation_batch_state.json"
LOCALES_DIR = Path("frontend/public/locales")


# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------

def build_review_prompt(
    en_json: str, target_json: str, lang_code: str, namespace: str
) -> str:
    lang_name = LANG_NAMES.get(lang_code, lang_code)
    return (
        f"You are reviewing a {lang_name} translation of a react-i18next JSON "
        f'file ("{namespace}" namespace) for MediKeep, a medical records '
        f"management application.\n\n"
        f"Compare the current {lang_name} translation against the English "
        f"source and fix any issues.\n\n"
        f"Common issues to fix:\n"
        f"1. Strings still in English that should be in {lang_name}\n"
        f"2. Grammar mistakes, unnatural phrasing, or overly literal translations\n"
        f"3. English abbreviations not localized "
        f"(e.g. \"e.g.\" should use the {lang_name} equivalent)\n"
        f"4. Incorrect gender agreement, case declension, or verb conjugation\n"
        f"5. Inconsistent terminology (same concept translated differently)\n"
        f"6. Corrupted or missing interpolation variables "
        f"(must match English exactly)\n"
        f"7. Medical terminology that sounds unnatural in {lang_name}\n\n"
        f"Rules:\n"
        f"- Return ONLY valid JSON. No markdown fences, no comments, "
        f"no explanation.\n"
        f"- Preserve every key exactly as it appears in the English source.\n"
        f"- Preserve all interpolation variables exactly: "
        f"{{{{name}}}}, {{{{count}}}}, etc.\n"
        f"- Preserve any HTML tags exactly.\n"
        f"- If a translation is already correct and natural, keep it as-is.\n"
        f"- Use formal/professional register appropriate for a medical "
        f"application.\n"
        f"- Ensure all plural forms follow {lang_name} conventions.\n\n"
        f"English source:\n{en_json}\n\n"
        f"Current {lang_name} translation to review and improve:\n{target_json}"
    )


def build_translate_prompt(
    en_json: str, lang_code: str, namespace: str
) -> str:
    lang_name = LANG_NAMES.get(lang_code, lang_code)
    return (
        f"Translate the following react-i18next JSON file "
        f'("{namespace}" namespace) from English to {lang_name} for MediKeep, '
        f"a medical records management application.\n\n"
        f"Rules:\n"
        f"- Return ONLY valid JSON. No markdown fences, no comments, "
        f"no explanation.\n"
        f"- Preserve every key exactly as it appears in the source.\n"
        f"- Preserve all interpolation variables exactly: "
        f"{{{{name}}}}, {{{{count}}}}, etc.\n"
        f"- Preserve any HTML tags exactly.\n"
        f"- Use natural, idiomatic {lang_name} -- not word-for-word "
        f"translation.\n"
        f"- Use formal/professional register appropriate for a medical "
        f"application.\n"
        f"- Localize abbreviations and examples to {lang_name} "
        f"conventions.\n\n"
        f"English source:\n{en_json}"
    )


# ---------------------------------------------------------------------------
# JSON helpers
# ---------------------------------------------------------------------------

def load_json(path: Path) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def get_leaf_paths(d: dict, prefix: str = "") -> dict[str, str]:
    """Return {dotted.key.path: value} for every leaf in a nested dict."""
    paths: dict[str, str] = {}
    for k, v in d.items():
        path = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            paths.update(get_leaf_paths(v, path))
        else:
            paths[path] = v
    return paths


def rebuild_with_structure(
    en_data: dict, translated: dict, existing: dict
) -> dict:
    """Rebuild *translated* to match the exact key structure of *en_data*.

    For any key missing from *translated*, falls back to *existing*, then to
    the English source value.
    """
    result: dict = {}
    for key in en_data:
        if isinstance(en_data[key], dict):
            tr_sub = translated.get(key, {})
            if not isinstance(tr_sub, dict):
                tr_sub = {}
            ex_sub = existing.get(key, {})
            if not isinstance(ex_sub, dict):
                ex_sub = {}
            result[key] = rebuild_with_structure(en_data[key], tr_sub, ex_sub)
        else:
            result[key] = translated.get(
                key, existing.get(key, en_data[key])
            )
    return result


def count_changes(existing: dict, updated: dict) -> tuple[int, int]:
    """Return (changed_count, total_count) comparing leaf values."""
    ex = get_leaf_paths(existing)
    up = get_leaf_paths(updated)
    changed = sum(1 for k in ex if ex.get(k) != up.get(k))
    return changed, len(ex)


def parse_response_json(text: str) -> dict:
    """Parse JSON from an API response, tolerating markdown fences."""
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
        text = text.rsplit("```", 1)[0].strip()
    return json.loads(text)


# ---------------------------------------------------------------------------
# State persistence (tracks batch jobs across invocations)
# ---------------------------------------------------------------------------

def load_state() -> dict:
    p = Path(STATE_FILE)
    if p.exists():
        return load_json(p)
    return {}


def save_state(state: dict) -> None:
    save_json(Path(STATE_FILE), state)


# ---------------------------------------------------------------------------
# Shared logic
# ---------------------------------------------------------------------------

def get_source_files(
    locales_dir: Path, file_filter: list[str] | None = None
) -> list[Path]:
    """Return sorted list of EN JSON files, optionally filtered."""
    en_dir = locales_dir / "en"
    files = sorted(en_dir.glob("*.json"))
    if file_filter:
        allowed = {f if f.endswith(".json") else f"{f}.json" for f in file_filter}
        files = [f for f in files if f.name in allowed]
    return files


def build_request(
    en_file: Path,
    lang: str,
    mode: str,
    locales_dir: Path,
) -> tuple[str, str]:
    """Return (custom_id, prompt) for one file + language pair."""
    namespace = en_file.stem
    en_data = load_json(en_file)
    en_json = json.dumps(en_data, ensure_ascii=False, indent=2)
    custom_id = f"{lang}__{namespace}"

    if mode == "review":
        target_file = locales_dir / lang / en_file.name
        if target_file.exists():
            target_data = load_json(target_file)
            target_json = json.dumps(target_data, ensure_ascii=False, indent=2)
            prompt = build_review_prompt(en_json, target_json, lang, namespace)
        else:
            print(f"  WARNING: {target_file} missing, translating from scratch")
            prompt = build_translate_prompt(en_json, lang, namespace)
    else:
        prompt = build_translate_prompt(en_json, lang, namespace)

    return custom_id, prompt


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------

def cmd_submit(args: argparse.Namespace) -> None:
    locales_dir = Path(args.locales_dir)
    en_files = get_source_files(locales_dir, args.files)

    if not en_files:
        print(f"No JSON files found in {locales_dir / 'en'}")
        sys.exit(1)

    # Check for existing unfinished batch
    old = load_state()
    if old.get("status") == "submitted":
        print(f"WARNING: batch {old['batch_id']} is still in progress.")
        print("Run 'status' to check or 'collect' to retrieve results.")
        answer = input("Submit a new batch anyway? [y/N] ").strip().lower()
        if answer != "y":
            sys.exit(0)

    print(f"Source files: {len(en_files)}")
    print(f"Languages:    {', '.join(args.lang)}")
    print(f"Mode:         {args.mode}")
    print(f"Model:        {MODEL}")
    print()

    requests = []
    request_map: dict[str, dict] = {}

    for lang in args.lang:
        for en_file in en_files:
            custom_id, prompt = build_request(
                en_file, lang, args.mode, locales_dir
            )
            requests.append(
                {
                    "custom_id": custom_id,
                    "params": {
                        "model": MODEL,
                        "max_tokens": MAX_TOKENS,
                        "messages": [{"role": "user", "content": prompt}],
                    },
                }
            )
            request_map[custom_id] = {"lang": lang, "file": en_file.name}

    print(f"Total requests: {len(requests)}")

    if args.dry_run:
        out = Path("translation_batch.jsonl")
        with open(out, "w", encoding="utf-8") as f:
            for req in requests:
                f.write(json.dumps(req, ensure_ascii=False) + "\n")
        print(f"\nDry run: wrote {len(requests)} requests to {out}")
        return

    print("\nSubmitting batch to Anthropic API...")
    client = anthropic.Anthropic()
    batch = client.messages.batches.create(requests=requests)

    state = {
        "batch_id": batch.id,
        "created_at": datetime.now().isoformat(),
        "languages": args.lang,
        "mode": args.mode,
        "locales_dir": str(locales_dir),
        "request_map": request_map,
        "status": "submitted",
    }
    save_state(state)

    print(f"\nBatch submitted: {batch.id}")
    print(f"Status:          {batch.processing_status}")
    print(f"State saved to:  {STATE_FILE}")
    print("\nNext steps:")
    print("  python translate_i18n_review.py status")
    print("  python translate_i18n_review.py collect   (when ended)")


def cmd_status(args: argparse.Namespace) -> None:
    state = load_state()
    if not state.get("batch_id"):
        print("No active batch. Run 'submit' first.")
        sys.exit(1)

    client = anthropic.Anthropic()
    batch = client.messages.batches.retrieve(state["batch_id"])
    rc = batch.request_counts

    print(f"Batch ID:    {batch.id}")
    print(f"Status:      {batch.processing_status}")
    print(f"Created:     {state.get('created_at', '?')}")
    print(f"Languages:   {', '.join(state.get('languages', []))}")
    print(f"Requests:    {rc.processing} processing / "
          f"{rc.succeeded} succeeded / {rc.errored} errored")

    if batch.processing_status == "ended":
        print("\nBatch complete! Run:")
        print("  python translate_i18n_review.py collect")
        state["status"] = "ended"
        save_state(state)


def cmd_collect(args: argparse.Namespace) -> None:
    state = load_state()
    if not state.get("batch_id"):
        print("No active batch. Run 'submit' first.")
        sys.exit(1)

    client = anthropic.Anthropic()
    batch = client.messages.batches.retrieve(state["batch_id"])

    if batch.processing_status != "ended":
        rc = batch.request_counts
        print(f"Batch not complete yet. Status: {batch.processing_status}")
        print(f"  {rc.processing} processing / "
              f"{rc.succeeded} succeeded / {rc.errored} errored")
        sys.exit(1)

    locales_dir = Path(state["locales_dir"])
    request_map = state["request_map"]

    print(f"Collecting results for batch {batch.id}...")
    rc = batch.request_counts
    print(f"  {rc.succeeded} succeeded, {rc.errored} errored\n")

    results_by_lang: dict[str, dict[str, dict]] = {}
    errors: list[str] = []

    for result in client.messages.batches.results(batch.id):
        cid = result.custom_id
        info = request_map.get(cid, {})
        lang = info.get("lang", "?")
        filename = info.get("file", "?")

        if result.result.type != "succeeded":
            errors.append(f"  FAILED: {cid} -- {result.result.type}")
            continue

        text = result.result.message.content[0].text
        try:
            translated = parse_response_json(text)
        except json.JSONDecodeError as e:
            errors.append(f"  JSON ERROR: {cid} -- {e}")
            # Save raw response for debugging
            raw_path = Path(f".translation_raw_{cid}.txt")
            raw_path.write_text(text, encoding="utf-8")
            errors.append(f"    Raw response saved to {raw_path}")
            continue

        results_by_lang.setdefault(lang, {})[filename] = translated

    # Write updated files
    total_changed = 0
    total_keys = 0

    for lang in sorted(results_by_lang):
        lang_name = LANG_NAMES.get(lang, lang)
        print(f"=== {lang_name} ({lang}) ===")

        for filename in sorted(results_by_lang[lang]):
            translated = results_by_lang[lang][filename]

            en_data = load_json(locales_dir / "en" / filename)
            target_file = locales_dir / lang / filename
            existing = load_json(target_file) if target_file.exists() else {}

            # Rebuild to match EN structure, fill gaps from existing
            final = rebuild_with_structure(en_data, translated, existing)

            changed, total = count_changes(existing, final)
            total_changed += changed
            total_keys += total

            # Validate leaf count
            en_count = len(get_leaf_paths(en_data))
            final_count = len(get_leaf_paths(final))
            tag = (
                "ok"
                if en_count == final_count
                else f"KEY MISMATCH {final_count}/{en_count}"
            )

            print(f"  {filename}: {changed}/{total} changed  [{tag}]")
            save_json(target_file, final)

        print()

    if errors:
        print("=== Errors ===")
        for e in errors:
            print(e)
        print()

    print(f"Done: {total_changed} values changed across {total_keys} total keys")
    print("Review with:  git diff frontend/public/locales/")

    state["status"] = "collected"
    state["collected_at"] = datetime.now().isoformat()
    save_state(state)


def cmd_live(args: argparse.Namespace) -> None:
    """Translate directly without the Batch API (immediate results)."""
    locales_dir = Path(args.locales_dir)
    en_files = get_source_files(locales_dir, args.files)

    if not en_files:
        print(f"No JSON files found in {locales_dir / 'en'}")
        sys.exit(1)

    client = anthropic.Anthropic()
    file_count = len(en_files) * len(args.lang)
    done = 0

    for lang in args.lang:
        lang_name = LANG_NAMES.get(lang, lang)
        print(f"=== {lang_name} ({lang}) ===")

        for en_file in en_files:
            done += 1
            namespace = en_file.stem
            en_data = load_json(en_file)
            target_file = locales_dir / lang / en_file.name
            existing = load_json(target_file) if target_file.exists() else {}

            _, prompt = build_request(en_file, lang, args.mode, locales_dir)

            print(
                f"  [{done}/{file_count}] {en_file.name}...",
                end=" ",
                flush=True,
            )

            for attempt in range(1, 4):
                try:
                    resp = client.messages.create(
                        model=MODEL,
                        max_tokens=MAX_TOKENS,
                        messages=[{"role": "user", "content": prompt}],
                    )
                    translated = parse_response_json(resp.content[0].text)
                    final = rebuild_with_structure(en_data, translated, existing)

                    changed, total = count_changes(existing, final)
                    save_json(target_file, final)
                    print(f"{changed}/{total} changed")
                    break

                except json.JSONDecodeError:
                    print(f"JSON error, retry {attempt}/3...", end=" ", flush=True)
                except anthropic.RateLimitError:
                    wait = 30 * attempt
                    print(f"rate limited, waiting {wait}s...", end=" ", flush=True)
                    time.sleep(wait)
                except anthropic.APIError as e:
                    print(f"API error ({e}), retry {attempt}/3...", end=" ", flush=True)
                    time.sleep(5)
            else:
                print("FAILED")

        print()

    print("Done! Review with:  git diff frontend/public/locales/")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Review and improve i18n translations via Anthropic API",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples:\n"
            "  # Batch review for PL, PT, RU, SV (50%% cheaper)\n"
            "  python translate_i18n_review.py submit --lang pl pt ru sv\n"
            "  python translate_i18n_review.py status\n"
            "  python translate_i18n_review.py collect\n\n"
            "  # Immediate review for one language\n"
            "  python translate_i18n_review.py live --lang pl\n\n"
            "  # Only specific files\n"
            "  python translate_i18n_review.py live --lang sv --files common.json medical.json\n\n"
            "  # Translate from scratch\n"
            "  python translate_i18n_review.py submit --lang ja --mode translate\n"
        ),
    )

    sub = parser.add_subparsers(dest="command", required=True)

    # -- submit --
    p = sub.add_parser("submit", help="Submit a batch for translation review")
    p.add_argument("--lang", "-l", nargs="+", required=True, help="Target language code(s)")
    p.add_argument(
        "--mode", "-m", choices=["review", "translate"], default="review",
        help="review = improve existing (default); translate = from scratch",
    )
    p.add_argument("--files", "-f", nargs="+", default=None, help="Only these JSON files")
    p.add_argument("--locales-dir", default=str(LOCALES_DIR), help="Locales directory")
    p.add_argument("--dry-run", action="store_true", help="Write JSONL instead of submitting")

    # -- status --
    sub.add_parser("status", help="Check batch processing status")

    # -- collect --
    sub.add_parser("collect", help="Collect results and write updated files")

    # -- live --
    p = sub.add_parser("live", help="Translate directly (immediate, no batch)")
    p.add_argument("--lang", "-l", nargs="+", required=True, help="Target language code(s)")
    p.add_argument(
        "--mode", "-m", choices=["review", "translate"], default="review",
        help="review = improve existing (default); translate = from scratch",
    )
    p.add_argument("--files", "-f", nargs="+", default=None, help="Only these JSON files")
    p.add_argument("--locales-dir", default=str(LOCALES_DIR), help="Locales directory")

    args = parser.parse_args()

    {"submit": cmd_submit, "status": cmd_status, "collect": cmd_collect, "live": cmd_live}[
        args.command
    ](args)


if __name__ == "__main__":
    main()
