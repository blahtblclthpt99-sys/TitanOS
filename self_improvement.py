from dataclasses import dataclass, field
from typing import List


@dataclass
class ImprovementCapability:
    name: str
    purpose: str
    category: str


IMPROVEMENT_CAPABILITIES: List[ImprovementCapability] = [
    ImprovementCapability("Self-Optimization Engine", "Analyzes workflow efficiency and improves prompts, agents, and tools", "Optimization"),
    ImprovementCapability("Workflow Architect", "Designs safer, more reliable execution workflows", "Workflow"),
    ImprovementCapability("Tool Creator", "Builds new internal tools to solve recurring tasks", "Tooling"),
    ImprovementCapability("Agent Creation System", "Creates specialized agents for new domains", "Agents"),
    ImprovementCapability("Experiment Laboratory", "Runs controlled experiments and benchmarks before adoption", "Research"),
    ImprovementCapability("Benchmark Engine", "Measures code and AI quality against defined criteria", "Quality"),
    ImprovementCapability("Model Router", "Chooses the most suitable model for each task", "Modeling"),
    ImprovementCapability("Cost Intelligence", "Balances quality and cost across tools and models", "Cost"),
    ImprovementCapability("Autonomous Debugging", "Investigates failures and proposes verified fixes", "Debugging"),
    ImprovementCapability("Security Researcher", "Tracks vulnerabilities and attack patterns", "Security"),
    ImprovementCapability("Compliance Automation", "Maintains policies, audit trails, and governance", "Governance"),
    ImprovementCapability("Knowledge Compression", "Summarizes large systems into useful strategic context", "Memory"),
    ImprovementCapability("Truth Verification", "Checks evidence, consistency, and reliability before trust", "Reasoning"),
]


def describe_self_improvement() -> str:
    lines = ["TitanAI Self-Improvement Blueprint", "", "Core principle: improvements must be tested, reviewed, and rollback-safe.", ""]
    for capability in IMPROVEMENT_CAPABILITIES:
        lines.append(f"- {capability.name} [{capability.category}]")
        lines.append(f"  {capability.purpose}")
    return "\n".join(lines)
