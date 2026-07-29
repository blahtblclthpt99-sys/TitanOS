import unittest

from enterprise import describe_enterprise_structure


class EnterpriseTests(unittest.TestCase):
    def test_describe_enterprise_structure_lists_departments(self):
        result = describe_enterprise_structure()
        self.assertIn('TitanAI Enterprise Structure', result)
        self.assertIn('Engineering Division', result)
        self.assertIn('Security Division', result)
        self.assertIn('Operations Division', result)


if __name__ == '__main__':
    unittest.main()
