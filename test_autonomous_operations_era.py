import unittest

from autonomous_operations_era import describe_autonomous_operations_era


class AutonomousOperationsEraTests(unittest.TestCase):
    def test_describe_autonomous_operations_era_lists_core_layers(self):
        result = describe_autonomous_operations_era()
        self.assertIn('TitanAI Autonomous Operations Era', result)
        self.assertIn('V5101', result)
        self.assertIn('V5200', result)
        self.assertIn('V5300', result)


if __name__ == '__main__':
    unittest.main()
