import subprocess
import sys
import unittest
from pathlib import Path


class MainBootstrapTests(unittest.TestCase):
    def test_importing_main_does_not_start_the_repl(self):
        workspace = Path(__file__).resolve().parent
        result = subprocess.run(
            [sys.executable, "-c", "import main; print('import ok')"],
            cwd=str(workspace),
            capture_output=True,
            text=True,
            timeout=10,
        )

        self.assertEqual(result.returncode, 0, msg=result.stderr)
        self.assertIn("import ok", result.stdout)


if __name__ == "__main__":
    unittest.main()
