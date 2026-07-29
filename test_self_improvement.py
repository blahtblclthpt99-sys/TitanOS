import unittest

from self_improvement import describe_self_improvement


class SelfImprovementTests(unittest.TestCase):
    def test_describe_self_improvement_lists_core_capabilities(self):
        result = describe_self_improvement()
        self.assertIn('TitanAI Self-Improvement Blueprint', result)
        self.assertIn('Self-Optimization Engine', result)
        self.assertIn('Experiment Laboratory', result)
        self.assertIn('Compliance Automation', result)


if __name__ == '__main__':
    unittest.main()
