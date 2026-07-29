import argparse
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

try:
    from openai import OpenAI
except Exception:  # pragma: no cover - optional dependency guard
    OpenAI = None

from ai import ask, build_engineering_plan, build_workflow_summary
from architect import analyze_architecture
from architecture_plan import describe_architecture
from cost import estimate_costs
from editor import create_file, delete_file, edit_file, read_file, rename_file
from advanced_creation_intelligence import describe_advanced_creation_intelligence
from advanced_intelligence import describe_advanced_intelligence
from apex_intelligence_architecture import describe_apex_intelligence_architecture
from beyond_operating_systems_intelligence import describe_beyond_operating_systems_intelligence
from business_intelligence import describe_business_intelligence
from coordination_intelligence import describe_coordination_intelligence
from civilization_layer_intelligence import describe_civilization_layer_intelligence
from hyper_scale_intelligence import describe_hyper_scale_intelligence
from creation_intelligence import describe_creation_intelligence
from civilization_intelligence import describe_civilization_intelligence
from digital_civilization_intelligence import describe_digital_civilization_intelligence
from enterprise import describe_enterprise_structure
from enterprise_intelligence import describe_enterprise_intelligence
from ecosystem_intelligence import describe_ecosystem_intelligence
from ecosystem_management_intelligence import describe_ecosystem_management_intelligence
from identity_core import describe_identity_core, describe_titanai_vision
from infrastructure_intelligence import describe_infrastructure_intelligence
from infrastructure_era_intelligence import describe_infrastructure_era_intelligence
from logger import log
from next_generation_intelligence_architecture import describe_next_generation_intelligence_architecture
from omega_intelligence_framework import describe_omega_intelligence_framework
from platform_intelligence import describe_platform_intelligence
from research_intelligence import describe_research_intelligence
from memory import get_active_task, import_cursor_data, load_memory, remember, set_active_task, summarize_memory
from modules import list_modules
from orchestrator import Orchestrator
from platform import list_platform_capabilities
from qa import build_project_review, run_qa
from refactor import suggest_refactors
from risk import evaluate_risk
from scanner import scan_project, summarize_architecture, summarize_scan, write_scan_report
from self_improvement import describe_self_improvement
from singularity_engineering_architecture import describe_singularity_engineering_architecture
from ultimate_autonomous_engineering_ecosystem import describe_ultimate_autonomous_engineering_ecosystem
from infinite_engineering_intelligence import describe_infinite_engineering_intelligence
from eternal_intelligence_architecture import describe_eternal_intelligence_architecture
from omniscient_engineering_framework import describe_omniscient_engineering_framework
from universal_autonomous_technology_framework import describe_universal_autonomous_technology_framework
from final_ascension_milestone import describe_final_ascension_milestone
from real_world_autonomous_implementation import describe_real_world_autonomous_implementation
from autonomous_operations_era import describe_autonomous_operations_era
from autonomous_software_company import describe_autonomous_software_company
from autonomous_technology_empire import describe_autonomous_technology_empire
from global_intelligence_network import describe_global_intelligence_network
from universal_autonomous_civilization import describe_universal_autonomous_civilization
from creation_civilization_framework import describe_creation_civilization_framework
from autonomous_civilization_expansion import describe_autonomous_civilization_expansion
from infinite_evolution_architecture import describe_infinite_evolution_architecture
from autonomous_intelligence_expansion import describe_autonomous_intelligence_expansion
from autonomous_enterprise_civilization import describe_autonomous_enterprise_civilization
from terminal import run_command
from config import PROJECT_FOLDER, REPORT_FOLDER, BACKUP_FOLDER, LOG_FOLDER

WORKSPACE_ROOT = Path(__file__).resolve().parent

load_dotenv(dotenv_path=WORKSPACE_ROOT / ".env")

client = None
api_key = os.getenv("OPENAI_API_KEY", "").strip()
if api_key and OpenAI is not None:
    client = OpenAI(api_key=api_key)

instructions_path = WORKSPACE_ROOT / "instructions.txt"
if instructions_path.exists():
    with instructions_path.open(encoding="utf-8") as handle:
        rules = handle.read()
else:
    rules = ""

memory = load_memory()
orchestrator = Orchestrator(str(WORKSPACE_ROOT))

for folder in [PROJECT_FOLDER, REPORT_FOLDER, BACKUP_FOLDER, LOG_FOLDER]:
    resolved_folder = WORKSPACE_ROOT / folder if not Path(folder).is_absolute() else Path(folder)
    resolved_folder.mkdir(parents=True, exist_ok=True)


def titan_ai(command):
    return ask(command, rules=rules, client=client)


def build_known_command_list() -> list[str]:
    return [
        "scan",
        "scann",
        "scn",
        "arch",
        "architecture",
        "architcture",
        "plan",
        "pln",
        "plann",
        "qa",
        "qaa",
        "review",
        "rvw",
        "memory",
        "mem",
        "memry",
        "task",
        "current",
        "run",
        "create",
        "edit",
        "rename",
        "delete",
        "remember",
        "read",
        "workflow",
        "modules",
        "platform",
        "help",
        "exit",
        "quit",
    ]


def normalize_command(text: str) -> str:
    normalized = text.strip().lower()
    aliases = {
        "scann": "scan",
        "scn": "scan",
        "architcture": "architecture",
        "arch": "architecture",
        "plann": "plan",
        "pln": "plan",
        "qaa": "qa",
        "rvw": "review",
        "mem": "memory",
        "memry": "memory",
        "remembr": "remember",
        "rember": "remember",
        "creat": "create",
        "editt": "edit",
        "renam": "rename",
        "delte": "delete",
        "del": "delete",
        "wrkflow": "workflow",
        "mods": "modules",
        "plat": "platform",
        "hhelp": "help",
    }
    return aliases.get(normalized, normalized)


def handle_command(command: str):
    text = command.strip()
    lowered = normalize_command(text)

    if lowered in {"exit", "quit"}:
        return "Goodbye!"

    if lowered in {"help", "?"}:
        known = ", ".join(build_known_command_list())
        return "Known commands: " + known

    if lowered.startswith("scan"):
        project_path = PROJECT_FOLDER
        if not Path(project_path).exists():
            Path(project_path).mkdir(parents=True, exist_ok=True)
        result = scan_project(project_path)
        report_path = write_scan_report(result, str(Path(REPORT_FOLDER) / "project_scan.md"))
        remember("decisions", f"Scanned project with {result['file_count']} files", memory)
        log(f"Scanned {project_path} and found {result['file_count']} files")
        return summarize_scan(result) + f"\n\nReport path: {report_path}"

    if lowered.startswith("memory"):
        return summarize_memory(memory)

    if lowered.startswith("import cursor"):
        parts = text.split(maxsplit=2)
        if len(parts) < 3:
            return "Usage: import cursor <path-to-cursor-json>"
        try:
            import_cursor_data(parts[2], memory)
            return f"Imported Cursor data from {parts[2]} into memory."
        except Exception as exc:
            return f"Import failed: {exc}"

    if lowered.startswith("task "):
        task = text.split(maxsplit=1)[1]
        set_active_task(task, memory)
        return f"Active task set: {task}"

    if lowered.startswith("current"):
        return f"Active task: {get_active_task(memory)}"

    if lowered.startswith("architecture"):
        project_path = PROJECT_FOLDER
        if not Path(project_path).exists():
            Path(project_path).mkdir(parents=True, exist_ok=True)
        result = scan_project(project_path)
        report_path = write_scan_report(result, str(Path(REPORT_FOLDER) / "architecture_summary.md"))
        log(f"Generated architecture summary for {project_path}")
        return summarize_architecture(result) + f"\n\nReport path: {report_path}"

    if lowered.startswith("remember "):
        _, section, *rest = text.split(maxsplit=2)
        value = rest[1] if len(rest) > 1 else rest[0]
        remember(section, value, memory)
        return f"Saved to {section}: {value}"

    if lowered.startswith("read "):
        path = text.split(maxsplit=1)[1]
        return read_file(path)

    if lowered.startswith("create "):
        path = text.split(maxsplit=1)[1]
        return create_file(path)

    if lowered.startswith("edit "):
        parts = text.split(maxsplit=2)
        if len(parts) < 3:
            return "Usage: edit <path> <content>"
        path = parts[1]
        content = parts[2]
        return edit_file(path, content)

    if lowered.startswith("rename "):
        parts = text.split(maxsplit=2)
        if len(parts) < 3:
            return "Usage: rename <old> <new>"
        return rename_file(parts[1], parts[2])

    if lowered.startswith("delete "):
        parts = text.split(maxsplit=2)
        if len(parts) < 2:
            return "Usage: delete <path> [confirm]"
        return delete_file(parts[1], confirm=len(parts) > 2 and parts[2].lower() == "confirm")

    if lowered.startswith("run "):
        command_text = text.split(maxsplit=1)[1]
        result = run_command(command_text, cwd=str(Path(__file__).resolve().parent))
        remember("exec", f"{result['command']} :: returncode={result['returncode']}", memory)
        log(f"Executed command: {result['command']}")
        output = [f"Command: {result['command']}", f"Return code: {result['returncode']}"]
        if result.get("stdout"):
            output.append("Stdout:")
            output.append(result["stdout"])
        if result.get("stderr"):
            output.append("Stderr:")
            output.append(result["stderr"])
        return "\n".join(output)

    if lowered.startswith("qa"):
        result = run_qa('.')
        lines = [f"QA status: {result['status']}", f"Python files checked: {result['python_files']}"]
        if result.get("errors"):
            lines.append("Errors:")
            lines.extend([f"- {item}" for item in result["errors"]])
        if result.get("warnings"):
            lines.append("Warnings:")
            lines.extend([f"- {item}" for item in result["warnings"]])
        return "\n".join(lines)

    if lowered.startswith("review"):
        result = build_project_review('.')
        report_path = Path(REPORT_FOLDER) / "project_review.md"
        report_path.write_text(result["report"], encoding="utf-8")
        return result["summary"] + f"\n\nReport path: {report_path}"

    if lowered.startswith("plan"):
        task = text[5:].strip() if len(text) > 4 else "inspect the current project"
        return build_engineering_plan(task)

    if lowered.startswith("workflow"):
        return build_workflow_summary()

    if lowered.startswith("modules"):
        return list_modules()

    if lowered.startswith("platform"):
        return list_platform_capabilities()

    if lowered.startswith("architecture blueprint"):
        return describe_architecture()

    if lowered.startswith("enterprise"):
        return describe_enterprise_structure()

    if lowered.startswith("identity"):
        return describe_identity_core()

    if lowered.startswith("vision"):
        return describe_titanai_vision()

    if lowered.startswith("intelligence"):
        return describe_enterprise_intelligence()

    if lowered.startswith("ecosystem"):
        return describe_ecosystem_intelligence()

    if lowered.startswith("ecosystem management"):
        return describe_ecosystem_management_intelligence()

    if lowered.startswith("infrastructure"):
        return describe_infrastructure_intelligence()

    if lowered.startswith("infrastructure era"):
        return describe_infrastructure_era_intelligence()

    if lowered.startswith("platform intelligence"):
        return describe_platform_intelligence()

    if lowered.startswith("research"):
        return describe_research_intelligence()

    if lowered.startswith("business"):
        return describe_business_intelligence()

    if lowered.startswith("creation civilization") or lowered.startswith("creation framework") or lowered.startswith("v39") or lowered.startswith("v40"):
        return describe_creation_civilization_framework()

    if lowered.startswith("autonomous expansion") or lowered.startswith("civilization expansion") or lowered.startswith("expansion") or lowered.startswith("v41") or lowered.startswith("v42") or lowered.startswith("v43") or lowered.startswith("v430"):
        return describe_autonomous_civilization_expansion()

    if lowered.startswith("infinite evolution") or lowered.startswith("evolution architecture") or lowered.startswith("v63") or lowered.startswith("v64") or lowered.startswith("v65"):
        return describe_infinite_evolution_architecture()

    if lowered.startswith("autonomous intelligence expansion") or lowered.startswith("intelligence expansion") or lowered.startswith("v65") or lowered.startswith("v66") or lowered.startswith("v67"):
        return describe_autonomous_intelligence_expansion()

    if lowered.startswith("autonomous enterprise") or lowered.startswith("enterprise civilization") or lowered.startswith("v67") or lowered.startswith("v68") or lowered.startswith("v69") or lowered.startswith("v70"):
        return describe_autonomous_enterprise_civilization()

    if lowered.startswith("creation"):
        return describe_creation_intelligence()

    if lowered.startswith("advanced creation"):
        return describe_advanced_creation_intelligence()

    if lowered.startswith("coordination"):
        return describe_coordination_intelligence()

    if lowered.startswith("hyper scale"):
        return describe_hyper_scale_intelligence()

    if lowered.startswith("beyond operating"):
        return describe_beyond_operating_systems_intelligence()

    if lowered.startswith("next generation"):
        return describe_next_generation_intelligence_architecture()

    if lowered.startswith("omega"):
        return describe_omega_intelligence_framework()

    if lowered.startswith("apex"):
        return describe_apex_intelligence_architecture()

    if lowered.startswith("singularity"):
        return describe_singularity_engineering_architecture()

    if lowered.startswith("ultimate") or lowered.startswith("v27") or lowered.startswith("v28") or lowered.startswith("v29"):
        return describe_ultimate_autonomous_engineering_ecosystem()

    if lowered.startswith("infinite") or lowered.startswith("v30"):
        return describe_infinite_engineering_intelligence()

    if lowered.startswith("eternal") or lowered.startswith("v31"):
        return describe_eternal_intelligence_architecture()

    if lowered.startswith("omniscient") or lowered.startswith("v33"):
        return describe_omniscient_engineering_framework()

    if lowered.startswith("universal") or lowered.startswith("v35"):
        return describe_universal_autonomous_technology_framework()

    if lowered.startswith("final ascension") or lowered.startswith("v49") or lowered.startswith("v50"):
        return describe_final_ascension_milestone()

    if lowered.startswith("real world") or lowered.startswith("v51") or lowered.startswith("v52"):
        return describe_real_world_autonomous_implementation()

    if lowered.startswith("autonomous operations") or lowered.startswith("operations") or lowered.startswith("v53"):
        return describe_autonomous_operations_era()

    if lowered.startswith("software company") or lowered.startswith("company") or lowered.startswith("v54"):
        return describe_autonomous_software_company()

    if lowered.startswith("technology empire") or lowered.startswith("empire") or lowered.startswith("v55"):
        return describe_autonomous_technology_empire()

    if lowered.startswith("global intelligence") or lowered.startswith("intelligence network") or lowered.startswith("v57") or lowered.startswith("v58") or lowered.startswith("v59"):
        return describe_global_intelligence_network()

    if lowered.startswith("universal civilization") or lowered.startswith("civilization") or lowered.startswith("v59") or lowered.startswith("v60"):
        return describe_universal_autonomous_civilization()

    if lowered.startswith("civilization layer"):
        return describe_civilization_layer_intelligence()

    if lowered.startswith("civilization"):
        return describe_civilization_intelligence()

    if lowered.startswith("digital civilization"):
        return describe_digital_civilization_intelligence()

    if lowered.startswith("advanced"):
        return describe_advanced_intelligence()

    if lowered.startswith("improve"):
        return describe_self_improvement()

    if lowered.startswith("projects"):
        return orchestrator.list_projects()

    if lowered.startswith("plan project"):
        parts = text.split(maxsplit=2)
        if len(parts) < 3:
            return "Usage: plan project <name>"
        return orchestrator.build_plan(parts[2])

    if lowered.startswith("add project"):
        parts = text.split(maxsplit=3)
        if len(parts) < 3:
            return "Usage: add project <name>"
        name = parts[2]
        return orchestrator.add_project(name)

    if lowered.startswith("architect"):
        return analyze_architecture('.')

    if lowered.startswith("refactor"):
        return suggest_refactors('.')

    if lowered.startswith("risk"):
        task = text.split(maxsplit=1)[1] if len(text.split()) > 1 else "review the current change"
        return evaluate_risk(task)

    if lowered.startswith("cost"):
        return estimate_costs('.')

    if lowered.startswith("product"):
        return "TitanAI Product Owner Mode: focus on onboarding friction, trust signals, and conversion risks in the current experience."

    return titan_ai(text)


def run_repl() -> int:
    print("TitanAI v1.0 Online")

    while True:
        try:
            command = input("\nTitanAI > ").strip()
        except EOFError:
            print()
            break

        if command.lower() == "exit":
            break

        if not command:
            continue

        result = handle_command(command)
        print("\n" + result)

    return 0


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="TitanAI local engineering assistant")
    parser.add_argument("--command", help="Run a single command and exit")
    parser.add_argument("--once", action="store_true", help="Execute one command from --command or stdin and exit")
    args = parser.parse_args(argv)

    if args.command:
        print(handle_command(args.command))
        return 0

    if args.once:
        try:
            command = input().strip()
        except EOFError:
            return 0
        if command:
            print(handle_command(command))
        return 0

    return run_repl()


if __name__ == "__main__":
    raise SystemExit(main())
