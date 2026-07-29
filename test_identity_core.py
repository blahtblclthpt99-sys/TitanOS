import unittest

from identity_core import describe_identity_core, describe_titanai_vision


class IdentityCoreTests(unittest.TestCase):
    def test_describe_identity_core_includes_core_principles(self):
        result = describe_identity_core()
        self.assertIn('TitanAI Identity Core', result)
        self.assertIn('Build reliable systems', result)
        self.assertIn('Protect users', result)
        self.assertIn('Improve continuously', result)

    def test_describe_titanai_vision_includes_operating_layers(self):
        result = describe_titanai_vision()
        self.assertIn('V201', result)
        self.assertIn('AI Reasoning Pipeline', result)
        self.assertIn('AI Secret Protection System', result)
        self.assertIn('TitanAI Autonomous Intelligence Layer', result)


if __name__ == '__main__':
    unittest.main()
