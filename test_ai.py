import unittest

from ai import ask


class AskFallbackTests(unittest.TestCase):
    def test_ask_returns_local_fallback_without_client(self):
        response = ask("hello there", client=None)
        self.assertIn("TitanAI", response)
        self.assertIn("local", response.lower())


if __name__ == "__main__":
    unittest.main()
