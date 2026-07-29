import unittest

from autonomous_software_company import describe_autonomous_software_company


class AutonomousSoftwareCompanyTests(unittest.TestCase):
    def test_describe_autonomous_software_company_lists_core_layers(self):
        result = describe_autonomous_software_company()
        self.assertIn('TitanAI Autonomous Software Company Era', result)
        self.assertIn('V5301', result)
        self.assertIn('V5450', result)
        self.assertIn('V5500', result)


if __name__ == '__main__':
    unittest.main()
