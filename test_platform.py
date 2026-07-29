import unittest

from platform import list_platform_capabilities


class PlatformTests(unittest.TestCase):
    def test_list_platform_capabilities_contains_core_layers(self):
        result = list_platform_capabilities()
        self.assertIn('TitanAI Platform Capabilities', result)
        self.assertIn('Operations Center', result)
        self.assertIn('Project Manager', result)
        self.assertIn('Data Analyst', result)


if __name__ == '__main__':
    unittest.main()
