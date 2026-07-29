from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List


@dataclass
class ProjectRecord:
    name: str
    status: str = "active"
    owner: str = "TitanAI"
    notes: List[str] = field(default_factory=list)


class Orchestrator:
    def __init__(self, root: str | None = None):
        self.root = Path(root or '.').resolve()
        self.projects: Dict[str, ProjectRecord] = {
            "TitanOS": ProjectRecord("TitanOS", status="active", notes=["Core product platform"]),
            "DealForge": ProjectRecord("DealForge", status="active", notes=["Marketplace and growth"]),
        }

    def list_projects(self) -> str:
        lines = ["Project Registry", ""]
        for name, record in self.projects.items():
            lines.append(f"- {name} [{record.status}]")
            lines.append(f"  Owner: {record.owner}")
            for note in record.notes:
                lines.append(f"  - {note}")
        return "\n".join(lines)

    def add_project(self, name: str, status: str = "active", owner: str = "TitanAI") -> str:
        self.projects[name] = ProjectRecord(name=name, status=status, owner=owner)
        return f"Added project: {name}"

    def build_plan(self, project_name: str) -> str:
        project = self.projects.get(project_name)
        if not project:
            return f"Project not found: {project_name}"
        return "\n".join([
            f"Execution Plan for {project_name}",
            "1. Confirm requirements and success criteria.",
            "2. Review architecture, dependencies, and risks.",
            "3. Implement the smallest safe change.",
            "4. Validate with testing and verification.",
            "5. Deploy, monitor, and document results.",
        ])
