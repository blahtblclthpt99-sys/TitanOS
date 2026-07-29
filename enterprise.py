from dataclasses import dataclass, field
from typing import List


@dataclass
class Department:
    name: str
    purpose: str
    agents: List[str] = field(default_factory=list)


DEPARTMENTS: List[Department] = [
    Department("Engineering Division", "Architecture, coding, testing, and delivery", ["Architecture Agent", "Frontend Agent", "Backend Agent", "Database Agent", "QA Agent"]),
    Department("Security Division", "Threat detection, compliance, and security review", ["Security Analyst", "Threat Hunter", "Compliance Agent"]),
    Department("Product Division", "Roadmaps, UX, growth, and experimentation", ["Product Manager", "UX Researcher", "Growth Analyst"]),
    Department("Operations Division", "Deployments, monitoring, incidents, and reliability", ["DevOps Agent", "Monitoring Agent", "Incident Manager"]),
]


def describe_enterprise_structure() -> str:
    lines = ["TitanAI Enterprise Structure", ""]
    for department in DEPARTMENTS:
        lines.append(f"- {department.name}: {department.purpose}")
        lines.append(f"  Agents: {', '.join(department.agents)}")
    return "\n".join(lines)
