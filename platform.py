from dataclasses import dataclass
from pathlib import Path
from typing import List


@dataclass
class PlatformCapability:
    name: str
    area: str
    description: str


PLATFORM_CAPABILITIES: List[PlatformCapability] = [
    PlatformCapability("Operations Center", "Operations", "Central dashboard for active projects, deployments, issues, and alerts"),
    PlatformCapability("Project Manager", "Operations", "Creates plans, milestones, dependencies, and delivery checkpoints"),
    PlatformCapability("Requirements Engineer", "Product", "Turns ideas into structured technical requirements"),
    PlatformCapability("Code Archaeologist", "Engineering", "Explains the purpose and usage of legacy code"),
    PlatformCapability("Migration Specialist", "Engineering", "Plans and validates major framework or platform migrations"),
    PlatformCapability("Performance Lab", "Engineering", "Measures performance and suggests optimization targets"),
    PlatformCapability("Accessibility Specialist", "Product", "Audits usability and accessibility concerns"),
    PlatformCapability("Localization Engine", "Product", "Prepares interfaces for regional and multilingual rollout"),
    PlatformCapability("Data Analyst", "Business", "Finds product and usage insights from customer and system data"),
    PlatformCapability("Trust & Safety", "Operations", "Looks for abuse, fraud, and risk patterns"),
]


def list_platform_capabilities() -> str:
    lines = ["TitanAI Platform Capabilities", ""]
    for capability in PLATFORM_CAPABILITIES:
        lines.append(f"- {capability.name} [{capability.area}]")
        lines.append(f"  {capability.description}")
    return "\n".join(lines)
