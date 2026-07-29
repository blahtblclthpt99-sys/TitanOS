import tempfile
import unittest
from pathlib import Path

from qa import build_project_review, run_qa


class ReviewTests(unittest.TestCase):
    def test_run_qa_reports_expected_keys(self):
        result = run_qa('.')
        self.assertIsInstance(result['python_files'], int)
        self.assertIn('status', result)
        self.assertIn('errors', result)
        self.assertIn('warnings', result)

    def test_build_project_review_returns_summary(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            Path(tmpdir, 'sample.py').write_text("print('hi')\n", encoding='utf-8')
            result = build_project_review(tmpdir)
            self.assertIn('summary', result)
            self.assertIn('status', result)
            self.assertIn('issues', result)
            self.assertIn('warnings', result)


if __name__ == '__main__':
    unittest.main()
