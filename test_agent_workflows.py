import unittest

from ai import build_engineering_plan, build_workflow_summary


class WorkflowTests(unittest.TestCase):
    def test_build_engineering_plan_returns_structured_plan(self):
        plan = build_engineering_plan("debug a login issue in TitanOS")
        self.assertIn('Plan', plan)
        self.assertIn('Verification', plan or 'verify' in plan.lower())
        self.assertTrue('1.' in plan or '- ' in plan)

    def test_build_workflow_summary_returns_practical_steps(self):
        summary = build_workflow_summary()
        self.assertTrue('workflow' in summary.lower() or 'workflow' in summary)
        self.assertTrue('memory' in summary.lower() or 'verification' in summary.lower())


if __name__ == '__main__':
    unittest.main()
