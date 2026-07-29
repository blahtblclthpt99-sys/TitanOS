from dataclasses import dataclass
from typing import List


@dataclass
class ResearchCapability:
    name: str
    purpose: str
    category: str


RESEARCH_CAPABILITIES: List[ResearchCapability] = [
    ResearchCapability("AI Research Network", "Connects research agents for analysis, synthesis, and discovery", "Research"),
    ResearchCapability("AI Scientific Literature Engine", "Reads papers, documents, patents, and standards", "Research"),
    ResearchCapability("AI Hypothesis Generator", "Creates possible solutions, experiments, and predictions", "Research"),
    ResearchCapability("AI Experiment Designer", "Creates procedures, variables, measures, and analysis plans", "Research"),
    ResearchCapability("AI Research Validation System", "Checks evidence quality, reproducibility, and accuracy", "Governance"),
    ResearchCapability("AI Knowledge Discovery Engine", "Finds connections between unrelated information", "Knowledge"),
    ResearchCapability("AI Innovation Ranking System", "Scores ideas by impact, difficulty, cost, and probability of success", "Strategy"),
    ResearchCapability("AI Breakthrough Detection", "Identifies new patterns, unexpected results, and emerging opportunities", "Research"),
    ResearchCapability("AI Research Collaboration Network", "Lets multiple research agents collaborate effectively", "Research"),
    ResearchCapability("AI Digital Laboratory", "Creates virtual experiments and research environments", "Research"),
    ResearchCapability("AI Simulation Intelligence", "Runs business, engineering, and user simulations", "Simulation"),
    ResearchCapability("AI Complex Systems Modeler", "Understands systems with many moving parts", "Modeling"),
    ResearchCapability("AI Predictive Modeling Engine", "Forecasts outcomes, risks, and trends", "Prediction"),
    ResearchCapability("AI Optimization Laboratory", "Tests thousands of possible improvements", "Optimization"),
    ResearchCapability("AI Algorithm Discovery System", "Creates new algorithms and optimization methods", "Algorithms"),
    ResearchCapability("AI Mathematics Assistant", "Supports proofs, calculations, and optimization problems", "Math"),
    ResearchCapability("AI Engineering Simulation", "Tests designs before they are constructed", "Simulation"),
    ResearchCapability("AI Digital Prototype Generator", "Creates concepts, models, and demonstrations", "Product"),
    ResearchCapability("AI Virtual Testing Environment", "Allows safe, realistic experimentation", "Testing"),
    ResearchCapability("TitanAI Research Intelligence Core", "Acts as a complete research assistant ecosystem", "Research"),
]


def describe_research_intelligence() -> str:
    lines = ["TitanAI Research Intelligence Layer", "", "This layer frames TitanAI as a research and discovery platform for science, strategy, and experimentation.", ""]
    for capability in RESEARCH_CAPABILITIES:
        lines.append(f"- {capability.name} [{capability.category}]")
        lines.append(f"  {capability.purpose}")
    return "\n".join(lines)
