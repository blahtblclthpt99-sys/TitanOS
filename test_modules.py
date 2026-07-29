import unittest

from modules import list_modules


class ModuleTests(unittest.TestCase):
    def test_list_modules_returns_grouped_capabilities(self):
        result = list_modules()
        self.assertIn('Capability Modules', result)
        self.assertIn('Core AI', result)
        self.assertIn('Engineering', result)


if __name__ == '__main__':
    unittest.main()
