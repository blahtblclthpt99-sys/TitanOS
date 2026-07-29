import unittest

from civilization_intelligence import describe_civilization_intelligence


class CivilizationIntelligenceTests(unittest.TestCase):
    def test_describe_civilization_intelligence_lists_global_and_personal_layers(self):
        result = describe_civilization_intelligence()
        self.assertIn('TitanAI Civilization Intelligence Layer', result)
        self.assertIn('AI Global Knowledge Network', result)
        self.assertIn('AI Personal Operating System', result)
        self.assertIn('AI Universal Intelligence Interface', result)
        self.assertIn('TitanAI Intelligence Civilization Platform', result)


if __name__ == '__main__':
    unittest.main()
