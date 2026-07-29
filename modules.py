from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List


@dataclass
class CapabilityModule:
    name: str
    purpose: str
    commands: List[str]


MODULES: List[CapabilityModule] = [
    CapabilityModule("Core AI", "reasoning, planning, memory", ["plan", "workflow", "task", "current"]),
    CapabilityModule("Engineering", "architecture, refactoring, QA, testing", ["architect", "refactor", "qa", "review"]),
    CapabilityModule("Operations", "deployments, monitoring, incident checks", ["run", "risk", "cost"]),
    CapabilityModule("Product", "roadmap, user insight, growth", ["product", "review"]),
    CapabilityModule("Business", "pricing, growth, optimization", ["cost", "risk"]),
]


def list_modules() -> str:
    lines = ["Capability Modules", ""]
    for module in MODULES:
        lines.append(f"- {module.name}: {module.purpose}")
        lines.append(f"  Commands: {', '.join(module.commands)}")
    return "\n".join(lines)
