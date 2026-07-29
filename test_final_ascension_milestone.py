import unittest

from final_ascension_milestone import describe_final_ascension_milestone


class FinalAscensionMilestoneTests(unittest.TestCase):
    def test_describe_final_ascension_milestone_lists_core_milestones(self):
        result = describe_final_ascension_milestone()
        self.assertIn('TitanAI Final Ascension Milestone Era', result)
        self.assertIn('V4901', result)
        self.assertIn('V4990', result)
        self.assertIn('V5000', result)


if __name__ == '__main__':
    unittest.main()
