from dataclasses import dataclass, field
from pathlib import Path
from typing import List


@dataclass
class Layer:
    name: str
    purpose: str


LAYERS: List[Layer] = [
    Layer("Core Kernel", "Routes requests, enforces permissions, and coordinates agents"),
    Layer("Engineering", "Architecture, coding, testing, refactoring, review"),
    Layer("Business", "Roadmaps, product value, experiments, growth"),
    Layer("Operations", "Deployment, monitoring, security, incident response"),
]


def describe_architecture() -> str:
    lines = ["TitanAI Architecture Blueprint", "", "Core structure:"]
    for layer in LAYERS:
        lines.append(f"- {layer.name}: {layer.purpose}")
    lines.extend(["", "Suggested folder structure:", "- core/", "- agents/", "- tools/", "- memory/", "- reports/", "- tests/"])
    return "\n".join(lines)
