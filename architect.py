from pathlib import Path


def analyze_architecture(root: str | None = None) -> str:
    base = Path(root or '.').resolve()
    files = [path.name for path in base.glob('**/*.py') if path.is_file()][:10]
    issues = []
    if not files:
        issues.append('No Python modules found for review')
    else:
        issues.append('Module boundaries should be documented for larger features')
    lines = ["Architecture Review", "", f"Root: {base}", "", "Issues:"]
    lines.extend([f" - {item}" for item in issues])
    lines.extend(["", "Relevant modules:"])
    lines.extend([f" - {name}" for name in files])
    return "\n".join(lines)
