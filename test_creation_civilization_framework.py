import unittest

from creation_civilization_framework import describe_creation_civilization_framework


class CreationCivilizationFrameworkTests(unittest.TestCase):
    def test_describe_creation_civilization_framework_lists_creation_and_framework_capabilities(self):
        result = describe_creation_civilization_framework()
        self.assertIn('TitanAI Creation Civilization Framework Era', result)
        self.assertIn('V3901', result)
        self.assertIn('V4000', result)
        self.assertIn('V3991', result)
        self.assertIn('V4100', result)


if __name__ == '__main__':
    unittest.main()
