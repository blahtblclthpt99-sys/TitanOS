from pathlib import Path


def suggest_refactors(root: str | None = None) -> str:
    base = Path(root or '.').resolve()
    python_files = [path.name for path in base.glob('**/*.py') if path.is_file()][:8]
    lines = ["Refactor Suggestions", "", "1. Split large modules into focused responsibilities.", "2. Consolidate repeated helpers into shared utilities.", "3. Improve naming and small-function boundaries.", "4. Add docstrings to important interfaces.", "", "Observed modules:"]
    lines.extend([f" - {name}" for name in python_files])
    return "\n".join(lines)
