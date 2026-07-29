import os
from pathlib import Path
from typing import Dict, List

IGNORE_DIRS = {".git", ".venv", "__pycache__", "node_modules", ".next", "dist", "build", ".pytest_cache", ".mypy_cache"}


def scan_project(root: str | None = None) -> Dict[str, object]:
    base = Path(root or ".").resolve()
    files: List[str] = []
    dirs: List[str] = []
    counts: Dict[str, int] = {}
    frameworks: List[str] = []
    issues: List[str] = []
    warnings: List[str] = []
    suggestions: List[str] = []

    for current_root, dirnames, filenames in os.walk(base):
        dirnames[:] = [d for d in dirnames if d not in IGNORE_DIRS]
        current_path = Path(current_root)

        for dirname in dirnames:
            rel_dir = (current_path / dirname).relative_to(base).as_posix()
            dirs.append(rel_dir)

        for filename in filenames:
            rel_file = (current_path / filename).relative_to(base).as_posix()
            files.append(rel_file)
            extension = Path(filename).suffix.lower() or "<no-extension>"
            counts[extension] = counts.get(extension, 0) + 1

            lower_name = filename.lower()
            if lower_name == "package.json":
                frameworks.append("Node")
            if lower_name == "requirements.txt" or lower_name == "pyproject.toml":
                frameworks.append("Python")
            if lower_name in {"next.config.js", "next.config.mjs"}:
                frameworks.append("Next.js")
            if lower_name == "playwright.config.js":
                frameworks.append("Playwright")
            if lower_name == "readme.md":
                frameworks.append("Documentation")

    likely_entrypoints = [
        rel for rel in files
        if rel.endswith(("main.py", "app.py", "index.ts", "index.tsx", "main.ts", "main.tsx", "server.js", "app.js"))
    ]
    top_level = sorted({path.split("/", 1)[0] for path in files if "/" in path})

    if not files:
        issues.append("No files found in the target folder")

    unique_frameworks = sorted(dict.fromkeys(frameworks))
    if unique_frameworks:
        suggestions.append("Add a simple architecture note to help future scans")
    else:
        suggestions.append("Add project metadata files to improve framework detection")

    warnings.append("No dependency audit has been run yet")
    issues.append("No production safeguards have been configured yet") if not any("requirements.txt" in f for f in files) else None

    return {
        "root": str(base),
        "file_count": len(files),
        "directory_count": len(dirs),
        "files": files[:200],
        "directories": dirs[:100],
        "extensions": counts,
        "frameworks": unique_frameworks,
        "entrypoints": likely_entrypoints[:10],
        "top_level": top_level[:20],
        "issues": issues,
        "warnings": warnings,
        "suggestions": suggestions,
    }


def summarize_scan(result: Dict[str, object]) -> str:
    file_count = int(result.get("file_count", 0))
    directory_count = int(result.get("directory_count", 0))
    frameworks = result.get("frameworks", [])
    entrypoints = result.get("entrypoints", [])
    top_level = result.get("top_level", [])
    issues = result.get("issues", [])
    warnings = result.get("warnings", [])
    suggestions = result.get("suggestions", [])

    lines = [f"✓ {file_count} files found", f"✓ {directory_count} directories scanned"]

    if frameworks:
        lines.append("")
        lines.append("Frameworks detected:")
        for framework in frameworks:
            lines.append(f"- {framework}")

    if entrypoints:
        lines.append("")
        lines.append("Likely entrypoints:")
        for item in entrypoints:
            lines.append(f"- {item}")

    if top_level:
        lines.append("")
        lines.append("Top-level structure:")
        for item in top_level:
            lines.append(f"- {item}")

    if issues:
        lines.append("")
        lines.append("Potential Issues:")
        for item in issues:
            lines.append(f"  - {item}")

    if warnings:
        lines.append("")
        lines.append("Warnings:")
        for item in warnings:
            lines.append(f"  - {item}")

    if suggestions:
        lines.append("")
        lines.append("Suggestions:")
        for item in suggestions:
            lines.append(f"  - {item}")

    lines.append("")
    lines.append("Report saved.")
    return "\n".join(lines)


def write_scan_report(result: Dict[str, object], output_path: str) -> str:
    report_lines = [
        "# TitanAI Project Scan",
        "",
        f"- Root: {result.get('root', 'unknown')}",
        f"- Files found: {result.get('file_count', 0)}",
        f"- Directories scanned: {result.get('directory_count', 0)}",
        "",
        "## Frameworks",
    ]
    frameworks = result.get("frameworks", [])
    if frameworks:
        report_lines.extend([f"- {framework}" for framework in frameworks])
    else:
        report_lines.append("- None detected")

    report_lines.extend(["", "## Likely entrypoints"])
    entrypoints = result.get("entrypoints", [])
    if entrypoints:
        report_lines.extend([f"- {entrypoint}" for entrypoint in entrypoints])
    else:
        report_lines.append("- None detected")

    report_lines.extend(["", "## Top-level structure"])
    top_level = result.get("top_level", [])
    if top_level:
        report_lines.extend([f"- {item}" for item in top_level])
    else:
        report_lines.append("- None detected")

    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text("\n".join(report_lines) + "\n", encoding="utf-8")
    return str(output)


def summarize_architecture(result: Dict[str, object]) -> str:
    frameworks = result.get("frameworks", [])
    entrypoints = result.get("entrypoints", [])
    top_level = result.get("top_level", [])
    issues = result.get("issues", [])
    suggestions = result.get("suggestions", [])

    lines = ["Architecture Summary", ""]
    lines.append("Frontend / app structure:")
    lines.append(f"- Likely entrypoints: {', '.join(entrypoints[:5]) if entrypoints else 'None detected'}")
    lines.append(f"- Top-level areas: {', '.join(top_level[:10]) if top_level else 'None detected'}")
    lines.append("")
    lines.append("Detected stack:")
    lines.append(f"- Frameworks: {', '.join(frameworks) if frameworks else 'None detected'}")
    lines.append("")
    lines.append("Observations:")
    lines.extend([f"- {item}" for item in issues[:3]])
    lines.extend([f"- {item}" for item in suggestions[:3]])
    return "\n".join(lines)
