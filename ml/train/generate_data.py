"""
Generate synthetic labeled training data for the blast radius classifier.

Strategy: prompt GPT-4o to produce realistic code diffs with GREEN/YELLOW/RED labels.
Target: ~340 per class (~1020 total), saved to train/data/diffs.jsonl

Runs incrementally — reads existing counts first and only generates what's still needed.

Labels:
  GREEN  — safe changes: docstrings, comments, tests, minor refactors
  YELLOW — logic/dependency changes: new functions, updated business logic, package bumps
  RED    — dangerous: auth, payments, migrations, infra, deletions, env config
"""

import json
import os
from collections import Counter
from itertools import zip_longest
from openai import OpenAI

client = OpenAI()

OUTPUT_PATH = "train/data/diffs.jsonl"
SAMPLES_PER_BATCH = 10
TARGET_PER_CLASS = 340  # ~1020 total

SYSTEM_PROMPT = """
You are a code diff generator for a training dataset.
Generate realistic unified diffs (--- a/... +++ b/... format) for the requested scenario.
Return a JSON array of objects: [{"diff": "...", "files": ["..."], "label": "GREEN|YELLOW|RED"}]
Make diffs varied in length, language, and context. Be realistic.
"""

LABEL_PROMPTS = {
    "GREEN": f"Generate {SAMPLES_PER_BATCH} GREEN diffs: documentation, comments, tests, minor renames.",
    "YELLOW": f"Generate {SAMPLES_PER_BATCH} YELLOW diffs: new feature functions, business logic changes, dependency version bumps.",
    "RED": f"Generate {SAMPLES_PER_BATCH} RED diffs: payment processing, auth middleware, database migrations, infra config, data deletion.",
}


def count_existing() -> Counter:
    """Read existing diffs.jsonl and return per-class counts."""
    counts: Counter = Counter()
    if not os.path.exists(OUTPUT_PATH):
        return counts
    with open(OUTPUT_PATH) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                d = json.loads(line)
                label = d.get("label")
                if label in ("GREEN", "YELLOW", "RED"):
                    counts[label] += 1
            except Exception:
                pass
    return counts


def generate_batch(prompt: str) -> list[dict]:
    """Call GPT-4o to generate a batch of labeled diffs."""
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
        temperature=0.9,
    )
    data = json.loads(response.choices[0].message.content)

    if isinstance(data, list):
        samples = data
    else:
        samples = next((v for v in data.values() if isinstance(v, list)), [])

    valid = []
    for item in samples:
        if (
            isinstance(item, dict)
            and all(k in item for k in ("diff", "files", "label"))
            and item["label"] in ("GREEN", "YELLOW", "RED")
        ):
            valid.append(item)
    return valid


def main():
    os.makedirs("train/data", exist_ok=True)

    existing = count_existing()
    print("Existing label counts:", dict(existing))

    needed = {
        label: max(0, TARGET_PER_CLASS - existing.get(label, 0))
        for label in ("GREEN", "YELLOW", "RED")
    }
    print(f"Needed to reach {TARGET_PER_CLASS} per class:", needed)

    if all(v == 0 for v in needed.values()):
        print("Target already reached. Nothing to generate.")
        return

    # Build per-class batch queues, then interleave so classes alternate
    def batches_for(label: str) -> list[str]:
        n = needed[label]
        count = (n + SAMPLES_PER_BATCH - 1) // SAMPLES_PER_BATCH  # ceil div
        return [label] * count

    green_q = batches_for("GREEN")
    yellow_q = batches_for("YELLOW")
    red_q = batches_for("RED")
    interleaved = [
        label
        for group in zip_longest(green_q, yellow_q, red_q)
        for label in group
        if label is not None
    ]

    current = dict(existing)
    total_added = 0
    total_batches = len(interleaved)

    with open(OUTPUT_PATH, "a") as f:
        for i, label in enumerate(interleaved):
            if current.get(label, 0) >= TARGET_PER_CLASS:
                print(f"Batch {i+1}/{total_batches} [{label}] already at target, skipping")
                continue
            try:
                samples = generate_batch(LABEL_PROMPTS[label])
                written = 0
                for sample in samples:
                    # Only write if this sample's class still needs more
                    if current.get(sample["label"], 0) < TARGET_PER_CLASS:
                        f.write(json.dumps(sample) + "\n")
                        f.flush()
                        current[sample["label"]] = current.get(sample["label"], 0) + 1
                        written += 1
                        total_added += 1
                print(
                    f"Batch {i+1}/{total_batches} [{label}] — wrote {written} | "
                    f"GREEN={current.get('GREEN', 0)} "
                    f"YELLOW={current.get('YELLOW', 0)} "
                    f"RED={current.get('RED', 0)}"
                )
            except Exception as e:
                print(f"Batch {i+1} [{label}] failed: {e}")

    total = sum(current.values())
    print(f"\nDone. Added {total_added} samples. Total in file: {total}")
    print("Final counts:", dict(current))


if __name__ == "__main__":
    main()
