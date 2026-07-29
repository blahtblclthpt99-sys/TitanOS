import unittest

from architecture_plan import describe_architecture


class ArchitecturePlanTests(unittest.TestCase):
    def test_describe_architecture_lists_layers_and_structure(self):
        result = describe_architecture()
        self.assertIn('TitanAI Architecture Blueprint', result)
        self.assertIn('Core Kernel', result)
        self.assertIn('agents/', result)
        self.assertIn('memory/', result)


if __name__ == '__main__':
    unittest.main()
