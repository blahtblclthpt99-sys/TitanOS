import unittest

from next_generation_intelligence_architecture import describe_next_generation_intelligence_architecture


class NextGenerationIntelligenceArchitectureTests(unittest.TestCase):
    def test_describe_next_generation_intelligence_architecture_lists_core_era_capabilities(self):
        result = describe_next_generation_intelligence_architecture()
        self.assertIn('TitanAI Next Generation Intelligence Architecture Era', result)
        self.assertIn('V2001', result)
        self.assertIn('V2010', result)
        self.assertIn('V2030', result)
        self.assertIn('V2050', result)
        self.assertIn('V2100', result)
        self.assertIn('V2150', result)


if __name__ == '__main__':
    unittest.main()
