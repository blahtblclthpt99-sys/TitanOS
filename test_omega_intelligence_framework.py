import unittest

from omega_intelligence_framework import describe_omega_intelligence_framework


class OmegaIntelligenceFrameworkTests(unittest.TestCase):
    def test_describe_omega_intelligence_framework_lists_core_era_capabilities(self):
        result = describe_omega_intelligence_framework()
        self.assertIn('TitanAI Omega Intelligence Framework Era', result)
        self.assertIn('V2151', result)
        self.assertIn('V2160', result)
        self.assertIn('V2200', result)
        self.assertIn('V2250', result)
        self.assertIn('V2300', result)


if __name__ == '__main__':
    unittest.main()
