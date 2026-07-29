import unittest

from terminal import run_command


class TerminalTests(unittest.TestCase):
    def test_run_command_returns_stdout_and_returncode(self):
        result = run_command('python --version', cwd='.')
        self.assertIn('returncode', result)
        self.assertIn('stdout', result)
        self.assertIn('stderr', result)


if __name__ == '__main__':
    unittest.main()
