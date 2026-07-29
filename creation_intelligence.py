from dataclasses import dataclass
from typing import List


@dataclass
class CreationCapability:
    name: str
    purpose: str
    category: str


CREATION_CAPABILITIES: List[CreationCapability] = [
    CreationCapability("AI Autonomous Platform Builder", "Creates platforms instead of isolated applications", "Platform"),
    CreationCapability("AI Ecosystem Generator", "Creates interconnected products and services", "Ecosystem"),
    CreationCapability("AI Marketplace Generator", "Builds buyers, sellers, payments, and trust systems", "Marketplace"),
    CreationCapability("AI Social Platform Builder", "Creates communities and networks", "Community"),
    CreationCapability("AI Communication Platform Builder", "Creates messaging, collaboration, and notification systems", "Communication"),
    CreationCapability("AI Logistics Platform Builder", "Creates routing, tracking, and dispatch systems", "Logistics"),
    CreationCapability("AI Healthcare Platform Builder", "Creates healthcare software infrastructure", "Healthcare"),
    CreationCapability("AI Education Platform Builder", "Creates learning ecosystems", "Education"),
    CreationCapability("AI Finance Platform Builder", "Creates financial tools and operating systems", "Finance"),
    CreationCapability("AI Industry Solution Generator", "Creates specialized systems for vertical domains", "Industry"),
    CreationCapability("AI Enterprise Operating System", "Manages entire companies and their operations", "Enterprise"),
    CreationCapability("AI Organization Simulator", "Models company performance and operating behavior", "Strategy"),
    CreationCapability("AI Workforce Forecasting", "Predicts hiring needs, workloads, and skill gaps", "Operations"),
    CreationCapability("AI Strategic Intelligence", "Supports leadership decisions with structured insight", "Strategy"),
    CreationCapability("AI Executive Simulation", "Tests strategies before execution", "Strategy"),
    CreationCapability("AI Scenario Planning", "Models future possibilities and strategic options", "Strategy"),
    CreationCapability("AI Risk Prediction", "Finds threats early", "Risk"),
    CreationCapability("AI Opportunity Discovery", "Finds growth opportunities", "Strategy"),
    CreationCapability("AI Competitive Intelligence", "Studies competitors and market positioning", "Strategy"),
    CreationCapability("AI Market Creation Engine", "Finds new markets and business opportunities", "Strategy"),
    CreationCapability("AI Autonomous Investment Analysis", "Evaluates opportunities and prioritizes investment", "Finance"),
    CreationCapability("AI Portfolio Intelligence", "Manages projects, products, and initiatives", "Portfolio"),
    CreationCapability("AI Resource Allocation Engine", "Determines where resources should go", "Operations"),
    CreationCapability("AI Priority Optimization", "Finds the highest-value work and sequencing", "Operations"),
    CreationCapability("AI Strategic Roadmap Generator", "Creates long-term plans and execution paths", "Strategy"),
    CreationCapability("AI Mission Management", "Keeps organizations aligned around goals", "Governance"),
    CreationCapability("AI Goal Tracking System", "Tracks goal progress and execution", "Operations"),
    CreationCapability("AI Performance Intelligence", "Measures outcomes and organizational health", "Operations"),
    CreationCapability("AI Continuous Improvement System", "Always searches for improvements and growth", "Operations"),
    CreationCapability("AI Evolution Governance", "Controls how TitanAI improves itself safely", "Governance"),
]


def describe_creation_intelligence() -> str:
    lines = ["TitanAI Creation Intelligence Layer", "", "This layer frames TitanAI as a creator of platforms, ecosystems, and autonomous operating systems.", ""]
    for capability in CREATION_CAPABILITIES:
        lines.append(f"- {capability.name} [{capability.category}]")
        lines.append(f"  {capability.purpose}")
    return "\n".join(lines)
