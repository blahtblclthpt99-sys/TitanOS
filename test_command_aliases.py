import unittest

from main import build_known_command_list, handle_command


class CommandAliasTests(unittest.TestCase):
    def test_known_command_list_includes_slang_and_typos(self):
        commands = build_known_command_list()
        self.assertIn("scan", commands)
        self.assertIn("scann", commands)
        self.assertIn("pln", commands)
        self.assertIn("qa", commands)
        self.assertIn("memry", commands)

    def test_help_command_lists_aliases(self):
        response = handle_command("help")
        self.assertIn("Known commands", response)
        self.assertIn("scan", response.lower())


if __name__ == "__main__":
    unittest.main()
