"""Normalize the public ASSISTments09 parquet into replayable JSONL.

Requires pyarrow. The source has ordered sequences but no trustworthy timestamps
or item difficulty, so both choices are explicit in the output metadata.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pyarrow.parquet as parquet


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--max-events", type=int, default=5000)
    return parser.parse_args()


def normalize(input_path: Path, output_path: Path, max_events: int) -> int:
    table = parquet.read_table(input_path)
    columns = table.to_pydict()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    count = 0
    base_time = datetime(2009, 1, 1, tzinfo=timezone.utc)

    with output_path.open("w", encoding="utf-8", newline="\n") as output:
        for user_id, skill_ids, skill_names, grades, attempts, answer_types in zip(
            columns["user_id"],
            columns["skill_ids"],
            columns["skill_names"],
            columns["grades"],
            columns["attempt_counts"],
            columns["answer_types"],
        ):
            for index, raw_grade in enumerate(grades or []):
                if count >= max_events:
                    return count
                if str(raw_grade) not in {"0", "1"}:
                    continue

                skill_id = str((skill_ids or [])[index] if index < len(skill_ids or []) else "unknown")
                skill_name = str(
                    (skill_names or [])[index]
                    if index < len(skill_names or [])
                    else "Unknown skill"
                )
                attempt_count = (attempts or [])[index] if index < len(attempts or []) else 0
                answer_type = str(
                    (answer_types or [])[index]
                    if index < len(answer_types or [])
                    else "unknown"
                )
                occurred_at = base_time + timedelta(seconds=index)
                output.write(
                    json.dumps(
                        {
                            "userId": f"assistments09:user:{user_id}",
                            "dimensionId": f"assistments09:skill:{skill_id}",
                            "itemId": f"assistments09:skill:{skill_id}",
                            "difficulty": 0,
                            "correct": str(raw_grade) == "1",
                            "occurredAt": occurred_at.isoformat().replace("+00:00", "Z"),
                            "skillId": skill_id,
                            "skillName": skill_name,
                            "attemptCount": int(attempt_count or 0),
                            "answerType": answer_type,
                            "timestampMode": "synthetic-sequence-order",
                        },
                        ensure_ascii=False,
                    )
                    + "\n"
                )
                count += 1

    return count


def main() -> None:
    args = parse_args()
    if args.max_events < 1:
        raise SystemExit("--max-events must be positive")
    count = normalize(args.input, args.output, args.max_events)
    print(f"normalized_events={count}")


if __name__ == "__main__":
    main()
