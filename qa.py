import py_compile
from pathlib import Path
from typing import Dict, List

from scanner import scan_project


def run_qa(root: str | None = None) -> Dict[str, object]:
    base = Path(root or ".").resolve()
    python_files = [str(path) for path in base.glob("**/*.py") if path.is_file()]
    errors: List[str] = []
    warnings: List[str] = []

    for path in python_files:
        try:
            py_compile.compile(path, doraise=True)
        except Exception as exc:
            errors.append(f"{path}: {exc}")

        text = Path(path).read_text(encoding="utf-8", errors="ignore")
        if "print(" in text and "input(" in text:
            warnings.append(f"{path}: contains interactive console code")
        if "TODO" in text.upper():
            warnings.append(f"{path}: contains TODO markers")
        if "pass" in text and "raise NotImplementedError" in text:
            warnings.append(f"{path}: contains placeholder implementation")

    return {
        "python_files": len(python_files),
        "errors": errors,
        "warnings": warnings,
        "status": "passed" if not errors else "failed",
    }


def build_project_review(root: str | None = None) -> Dict[str, object]:
    base = Path(root or ".").resolve()
    scan_result = scan_project(str(base))
    qa_result = run_qa(str(base))

    issues = list(scan_result.get("issues", [])) + list(qa_result.get("errors", []))
    warnings = list(scan_result.get("warnings", [])) + list(qa_result.get("warnings", []))
    suggestions = list(scan_result.get("suggestions", []))

    if not scan_result.get("entrypoints"):
        suggestions.append("Add a clear application entrypoint such as main.py or app.py")
    if not any(path.endswith(("requirements.txt", "pyproject.toml", "package.json")) for path in scan_result.get("files", [])):
        suggestions.append("Declare dependencies in project metadata files")

    summary_lines = [
        f"Project review for {base.name}",
        f"- Files scanned: {scan_result.get('file_count', 0)}",
        f"- Directories scanned: {scan_result.get('directory_count', 0)}",
        f"- Frameworks: {', '.join(scan_result.get('frameworks', [])) or 'None detected'}",
    ]
    if issues:
        summary_lines.append("- Issues:")
        summary_lines.extend([f"  - {item}" for item in issues[:5]])
    if warnings:
        summary_lines.append("- Warnings:")
        summary_lines.extend([f"  - {item}" for item in warnings[:5]])
    if suggestions:
        summary_lines.append("- Suggestions:")
        summary_lines.extend([f"  - {item}" for item in suggestions[:5]])

    report_lines = [
        "# TitanAI Project Review",
        "",
        f"- Root: {base}",
        f"- Status: {'needs-attention' if issues else 'healthy'}",
        "",
        "## Findings",
    ]
    report_lines.extend(summary_lines[1:])

    return {
        "status": "needs-attention" if issues else "healthy",
        "summary": "\n".join(summary_lines),
        "report": "\n".join(report_lines) + "\n",
        "issues": issues,
        "warnings": warnings,
        "suggestions": suggestions,
    }
