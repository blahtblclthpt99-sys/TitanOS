from pathlib import Path

from ai import build_engineering_plan, build_workflow_summary
from architect import analyze_architecture
from cost import estimate_costs
from memory import get_active_task, load_memory, remember, set_active_task, summarize_memory
from qa import build_project_review, run_qa
from refactor import suggest_refactors
from risk import evaluate_risk
from scanner import scan_project, summarize_architecture, summarize_scan, write_scan_report
from terminal import run_command


class AgentLoop:
    def __init__(self, root: str):
        self.root = Path(root).resolve()
        self.memory = load_memory()

    def run(self, command: str) -> str:
        text = command.strip()
        lowered = text.lower()

        if lowered in {"exit", "quit"}:
            return "Goodbye!"
        if lowered.startswith("scan"):
            result = scan_project(str(self.root))
            report_path = write_scan_report(result, str(self.root / "reports" / "project_scan.md"))
            remember("decisions", f"Scanned project with {result['file_count']} files", self.memory)
            return summarize_scan(result) + f"\n\nReport path: {report_path}"
        if lowered.startswith("memory"):
            return summarize_memory(self.memory)
        if lowered.startswith("task "):
            task = text.split(maxsplit=1)[1]
            set_active_task(task, self.memory)
            return f"Active task set: {task}"
        if lowered.startswith("current"):
            return f"Active task: {get_active_task(self.memory)}"
        if lowered.startswith("architecture"):
            result = scan_project(str(self.root))
            report_path = write_scan_report(result, str(self.root / "reports" / "architecture_summary.md"))
            return summarize_architecture(result) + f"\n\nReport path: {report_path}"
        if lowered.startswith("review"):
            result = build_project_review(str(self.root))
            report_path = self.root / "reports" / "project_review.md"
            report_path.write_text(result["report"], encoding="utf-8")
            return result["summary"] + f"\n\nReport path: {report_path}"
        if lowered.startswith("plan"):
            task = text[5:].strip() if len(text) > 4 else "inspect the current project"
            return build_engineering_plan(task)
        if lowered.startswith("workflow"):
            return build_workflow_summary()
        if lowered.startswith("architect"):
            return analyze_architecture(str(self.root))
        if lowered.startswith("refactor"):
            return suggest_refactors(str(self.root))
        if lowered.startswith("risk"):
            task = text.split(maxsplit=1)[1] if len(text.split()) > 1 else "review the current change"
            return evaluate_risk(task)
        if lowered.startswith("cost"):
            return estimate_costs(str(self.root))
        if lowered.startswith("run "):
            command_text = text.split(maxsplit=1)[1]
            result = run_command(command_text, cwd=str(self.root))
            remember("exec", f"{result['command']} :: returncode={result['returncode']}", self.memory)
            return "\n".join([
                f"Command: {result['command']}",
                f"Return code: {result['returncode']}",
                *(["Stdout:", result["stdout"]] if result.get("stdout") else []),
                *(["Stderr:", result["stderr"]] if result.get("stderr") else []),
            ])
        if lowered.startswith("qa"):
            result = run_qa(str(self.root))
            return "\n".join([f"QA status: {result['status']}", f"Python files checked: {result['python_files']}"] + (["Errors:"] + [f"- {item}" for item in result.get("errors", [])] if result.get("errors") else []) + (["Warnings:"] + [f"- {item}" for item in result.get("warnings", [])] if result.get("warnings") else []))
        return f"Unknown command: {command}"
