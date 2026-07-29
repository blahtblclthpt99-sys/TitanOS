import unittest

from autonomous_civilization_expansion import describe_autonomous_civilization_expansion


class AutonomousCivilizationExpansionTests(unittest.TestCase):
    def test_describe_autonomous_civilization_expansion_lists_scale_and_integration_capabilities(self):
        result = describe_autonomous_civilization_expansion()
        self.assertIn('TitanAI Autonomous Civilization Expansion Era', result)
        self.assertIn('V4101', result)
        self.assertIn('V4210', result)
        self.assertIn('V4300', result)
        self.assertIn('V4310', result)


if __name__ == '__main__':
    unittest.main()
