import unittest

from research_intelligence import describe_research_intelligence
from business_intelligence import describe_business_intelligence
from creation_intelligence import describe_creation_intelligence


class ResearchBusinessCreationTests(unittest.TestCase):
    def test_research_layer_contains_research_capabilities(self):
        result = describe_research_intelligence()
        self.assertIn('TitanAI Research Intelligence Layer', result)
        self.assertIn('AI Hypothesis Generator', result)
        self.assertIn('TitanAI Research Intelligence Core', result)

    def test_business_layer_contains_operating_system_capabilities(self):
        result = describe_business_intelligence()
        self.assertIn('TitanAI Business Intelligence Layer', result)
        self.assertIn('AI Human-AI Partnership Engine', result)
        self.assertIn('TitanAI Intelligence Operating System', result)

    def test_creation_layer_contains_platform_and_governance_capabilities(self):
        result = describe_creation_intelligence()
        self.assertIn('TitanAI Creation Intelligence Layer', result)
        self.assertIn('AI Autonomous Platform Builder', result)
        self.assertIn('AI Evolution Governance', result)


if __name__ == '__main__':
    unittest.main()
