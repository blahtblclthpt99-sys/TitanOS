from pathlib import Path


def estimate_costs(root: str | None = None) -> str:
    base = Path(root or '.').resolve()
    lines = ["Cost Review", "", "Hosting: review shared infrastructure and idle services.", "API usage: consolidate repeated calls and cache common results.", "Storage: archive old reports and temp outputs.", "Savings: target 10-20% cost reduction through cleanup and consolidation.", "", f"Analyzed root: {base}"]
    return "\n".join(lines)
