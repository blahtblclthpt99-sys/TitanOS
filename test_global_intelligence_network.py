import unittest

from global_intelligence_network import describe_global_intelligence_network


class GlobalIntelligenceNetworkTests(unittest.TestCase):
    def test_describe_global_intelligence_network_lists_core_layers(self):
        result = describe_global_intelligence_network()
        self.assertIn('TitanAI Global Intelligence Network Era', result)
        self.assertIn('V5701', result)
        self.assertIn('V5900', result)
        self.assertIn('TitanAI Global Intelligence Network Framework', result)


if __name__ == '__main__':
    unittest.main()
