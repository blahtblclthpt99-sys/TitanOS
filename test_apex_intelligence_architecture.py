import unittest

from apex_intelligence_architecture import describe_apex_intelligence_architecture


class ApexIntelligenceArchitectureTests(unittest.TestCase):
    def test_describe_apex_intelligence_architecture_lists_core_era_capabilities(self):
        result = describe_apex_intelligence_architecture()
        self.assertIn('TitanAI Apex Intelligence Architecture Era', result)
        self.assertIn('V2301', result)
        self.assertIn('V2310', result)
        self.assertIn('V2350', result)
        self.assertIn('V2400', result)
        self.assertIn('V2500', result)


if __name__ == '__main__':
    unittest.main()
