import unittest

from digital_civilization_intelligence import describe_digital_civilization_intelligence


class DigitalCivilizationIntelligenceTests(unittest.TestCase):
    def test_describe_digital_civilization_intelligence_lists_platform_and_marketplace_capabilities(self):
        result = describe_digital_civilization_intelligence()
        self.assertIn('TitanAI Autonomous Digital Civilization Era', result)
        self.assertIn('AI Digital Civilization Framework', result)
        self.assertIn('TitanAI Platform Creation Engine', result)
        self.assertIn('TitanAI Digital Workforce Platform', result)
        self.assertIn('TitanAI Human Intelligence Amplifier', result)
        self.assertIn('AI Autonomous Global Marketplace', result)


if __name__ == '__main__':
    unittest.main()
