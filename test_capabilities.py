import unittest

from architect import analyze_architecture
from cost import estimate_costs
from refactor import suggest_refactors
from risk import evaluate_risk


class CapabilityModuleTests(unittest.TestCase):
    def test_analyze_architecture_returns_architecture_summary(self):
        result = analyze_architecture('.')
        self.assertIn('Architecture Review', result)
        self.assertIn('Issues', result)

    def test_suggest_refactors_returns_actionable_items(self):
        result = suggest_refactors('.')
        self.assertIn('Refactor Suggestions', result)
        self.assertTrue(' - ' in result or '1.' in result)

    def test_evaluate_risk_returns_risk_details(self):
        result = evaluate_risk('deploy a new checkout flow')
        self.assertIn('Risk Assessment', result)
        self.assertIn('Score', result)

    def test_estimate_costs_returns_cost_summary(self):
        result = estimate_costs('.')
        self.assertIn('Cost Review', result)
        self.assertIn('Savings', result)


if __name__ == '__main__':
    unittest.main()
