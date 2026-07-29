import unittest

from civilization_layer_intelligence import describe_civilization_layer_intelligence


class CivilizationLayerIntelligenceTests(unittest.TestCase):
    def test_describe_civilization_layer_intelligence_lists_core_era_capabilities(self):
        result = describe_civilization_layer_intelligence()
        self.assertIn('TitanAI Advanced Intelligence Civilization Layer', result)
        self.assertIn('AI Universal Intelligence Mesh', result)
        self.assertIn('TitanAI Intelligence Mesh Core', result)
        self.assertIn('TitanAI Enterprise Creation Platform', result)
        self.assertIn('TitanAI Human Amplification Layer', result)


if __name__ == '__main__':
    unittest.main()
