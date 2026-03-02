"""
Generate 100 labeled test diffs with OpenAI, then evaluate /classify at :8001.

Usage (from ml/): python test_classifier.py
Reads OPENAI_API_KEY from ../.env automatically.
"""

import json
import os
import time
import urllib.request
import urllib.error
from collections import defaultdict

# ── Load .env ────────────────────────────────────────────────────────────────
def load_env(path=".env"):
    env = {}
    if not os.path.exists(path):
        return env
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            env[k.strip()] = v.strip()
    return env

_here = os.path.dirname(os.path.abspath(__file__))
env = load_env(os.path.join(_here, "..", ".env"))
OPENAI_API_KEY = env.get("OPENAI_API_KEY", "")
if not OPENAI_API_KEY:
    raise SystemExit("OPENAI_API_KEY not found in ../.env")

SIDECAR = "http://localhost:8001"
BATCH_SIZE = 10
TARGET = {"GREEN": 34, "YELLOW": 33, "RED": 33}

# ── OpenAI helper ─────────────────────────────────────────────────────────────
def openai_generate(label: str, count: int) -> list[dict]:
    descriptions = {
        "GREEN": (
            "Safe, low-risk changes: adding comments/docstrings, fixing typos, "
            "adding tests, minor constant renaming, whitespace cleanup. "
            "No logic changes, no new dependencies, no schema changes."
        ),
        "YELLOW": (
            "Medium-risk changes: adding new feature functions, changing business "
            "logic, bumping dependency versions, adding API endpoints, refactoring "
            "data access patterns, adding configuration options."
        ),
        "RED": (
            "High-risk/dangerous changes: modifying auth/JWT middleware, payment "
            "processing, database migrations with destructive ops, hardcoding secrets, "
            "removing security guards, SQL injection vectors, infra/CI config changes, "
            "mass data deletion."
        ),
    }
    system = (
        "You are a code diff generator for an ML training dataset. "
        "Generate realistic unified diffs (--- a/... +++ b/... @@ ... @@ format). "
        "Use varied languages (Python, TypeScript, JavaScript, Go, SQL) and file paths. "
        "Make diffs 5-25 lines long. "
        "The 'diff' field MUST be a plain string, not an object. "
        'Return ONLY a JSON object: {"diffs": [{"diff": "...", "files": ["..."]}, ...]}'
    )
    user = (
        f"Generate exactly {count} {label} diffs.\n"
        f"Definition of {label}: {descriptions[label]}"
    )
    payload = json.dumps({
        "model": "gpt-4o-mini",
        "messages": [
            {"role": "system", "content": system},
            {"role": "user",   "content": user},
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.9,
    }).encode()
    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {OPENAI_API_KEY}",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        body = json.loads(resp.read().decode())
    content = body["choices"][0]["message"]["content"]
    raw = json.loads(content)
    items = raw.get("diffs", [])
    results = []
    for it in items:
        if not (isinstance(it, dict) and "diff" in it):
            continue
        diff_val = it["diff"]
        if not isinstance(diff_val, str):
            diff_val = json.dumps(diff_val)
        results.append({
            "diff":  diff_val,
            "files": it.get("files", ["unknown"]),
            "label": label,
        })
    return results


# ── Classify helper (with retry) ──────────────────────────────────────────────
def classify(diff: str, files: list[str], retries: int = 3) -> dict:
    payload = json.dumps({"diff": diff, "files": files}).encode()
    for attempt in range(retries):
        try:
            req = urllib.request.Request(
                f"{SIDECAR}/classify",
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read().decode())
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(1.5)
            else:
                return {"error": str(e)[:80]}
    return {"error": "max retries exceeded"}


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    print("Generating 100 test diffs via OpenAI (gpt-4o-mini)...")
    test_cases: list[dict] = []

    for label, needed in TARGET.items():
        collected = []
        while len(collected) < needed:
            remaining = needed - len(collected)
            batch_n = min(BATCH_SIZE, remaining)
            print(f"  {label}: requesting {batch_n} (have {len(collected)}/{needed})", flush=True)
            try:
                batch = openai_generate(label, batch_n)
                collected.extend(batch[:remaining])
            except Exception as e:
                print(f"  ERROR generating {label}: {e}")
                break
        test_cases.extend(collected[:needed])
        print(f"  {label}: done ({min(len(collected), needed)} collected)")

    print(f"\nTotal test cases: {len(test_cases)}\n")

    # Classify each
    results = {
        lbl: {"correct": 0, "total": 0, "wrong": [], "low_conf": 0}
        for lbl in ("GREEN", "YELLOW", "RED")
    }
    confusion = defaultdict(lambda: defaultdict(int))

    for i, tc in enumerate(test_cases):
        expected = tc["label"]
        diff_str  = tc["diff"] if isinstance(tc["diff"], str) else str(tc["diff"])
        preview   = diff_str[:50].replace("\n", " ")
        print(f"[{i+1:03d}/{len(test_cases)}] {expected} | {preview!r}", end=" ... ", flush=True)

        resp = classify(diff_str, tc["files"])

        if "error" in resp:
            msg = resp["error"]
            print(f"ERROR: {msg}")
            results[expected]["total"] += 1
            results[expected]["wrong"].append(
                {"expected": expected, "got": "ERROR", "preview": preview}
            )
            confusion[expected]["ERROR"] += 1
            continue

        predicted  = resp.get("tier", "UNKNOWN")
        confidence = float(resp.get("confidence", 0.0))

        results[expected]["total"] += 1
        confusion[expected][predicted] += 1

        if predicted == expected:
            results[expected]["correct"] += 1
            low = confidence < 0.8
            if low:
                results[expected]["low_conf"] += 1
            tag = " [LOW-CONF]" if low else ""
            print(f"OK  conf={confidence:.2f}{tag}")
        else:
            results[expected]["wrong"].append({
                "expected":   expected,
                "got":        predicted,
                "confidence": confidence,
                "preview":    preview,
                "files":      tc["files"],
            })
            print(f"WRONG -> {predicted}  conf={confidence:.2f}")

        time.sleep(0.2)  # gentle pacing for sidecar

    # Report
    print("\n" + "=" * 60)
    print("RESULTS SUMMARY")
    print("=" * 60)

    total_correct = sum(r["correct"] for r in results.values())
    total_cases   = sum(r["total"]   for r in results.values())
    overall_pct   = 100 * total_correct / total_cases if total_cases else 0

    for lbl in ("GREEN", "YELLOW", "RED"):
        r   = results[lbl]
        pct = 100 * r["correct"] / r["total"] if r["total"] else 0
        print(f"  {lbl:6s}: {r['correct']:2d}/{r['total']:2d}  ({pct:.1f}%)  low_conf={r['low_conf']}")

    print(f"\n  OVERALL: {total_correct}/{total_cases}  ({overall_pct:.1f}%)")

    print("\nCONFUSION MATRIX  (row=expected, col=predicted):")
    all_lbl = ["GREEN", "YELLOW", "RED"]
    print(f"{'':10s}" + "".join(f"{l:>8s}" for l in all_lbl))
    for exp in all_lbl:
        row = f"  {exp:8s}"
        for pred in all_lbl:
            row += f"{confusion[exp][pred]:>8d}"
        print(row)

    err_total = sum(confusion[e].get("ERROR", 0) for e in all_lbl)
    if err_total:
        print(f"\n  (+ {err_total} sidecar ERROR responses excluded from matrix)")

    print("\nMISCLASSIFICATIONS:")
    any_wrong = False
    for lbl in ("GREEN", "YELLOW", "RED"):
        for w in results[lbl]["wrong"]:
            if w["got"] == "ERROR":
                continue
            any_wrong = True
            print(f"  [{w['expected']}-> {w['got']}] conf={w['confidence']:.2f}  files={w['files']}")
            print(f"    {w['preview']!r}")
    if not any_wrong:
        print("  None!")


if __name__ == "__main__":
    main()
