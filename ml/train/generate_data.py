"""
Generate synthetic labeled training data for the blast radius classifier.

Strategy: prompt GPT-4o to produce realistic code diffs with GREEN/YELLOW/RED labels.
Target: 50 batches x 10 samples = ~500 labeled diffs, saved to train/data/diffs.jsonl

Labels:
  GREEN  — safe changes: docstrings, comments, tests, minor refactors
  YELLOW — logic/dependency changes: new functions, updated business logic, package bumps
  RED    — dangerous: auth, payments, migrations, infra, deletions, env config
"""

import json
import os
from openai import OpenAI

client = OpenAI()

OUTPUT_PATH = "train/data/diffs.jsonl"
BATCHES = 50
SAMPLES_PER_BATCH = 10

SYSTEM_PROMPT = """
You are a code diff generator for a training dataset.
Generate realistic unified diffs (--- a/... +++ b/... format) for the requested scenario.
Return a JSON array of objects: [{"diff": "...", "files": ["..."], "label": "GREEN|YELLOW|RED"}]
Make diffs varied in length, language, and context. Be realistic.
"""

BATCH_PROMPTS = [
    f"Generate {SAMPLES_PER_BATCH} GREEN diffs: documentation, comments, tests, minor renames.",
    f"Generate {SAMPLES_PER_BATCH} YELLOW diffs: new feature functions, business logic changes, dependency version bumps.",
    f"Generate {SAMPLES_PER_BATCH} RED diffs: payment processing, auth middleware, database migrations, infra config, data deletion.",
]


def generate_batch(prompt: str) -> list[dict]:
    """
    TODO:
    1. Call client.chat.completions.create with SYSTEM_PROMPT + prompt
    2. Parse JSON array from response
    3. Validate each item has diff, files, label fields
    4. Return list of dicts
    """
    raise NotImplementedError


def main():
    os.makedirs("train/data", exist_ok=True)

    # TODO:
    # 1. Loop BATCHES times, cycling through BATCH_PROMPTS
    # 2. Call generate_batch for each
    # 3. Append results to OUTPUT_PATH as JSONL (one JSON object per line)
    # 4. Print progress
    raise NotImplementedError


if __name__ == "__main__":
    main()
