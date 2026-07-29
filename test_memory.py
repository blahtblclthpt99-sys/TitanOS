import unittest

from memory import load_memory, remember, summarize_memory


class MemoryTests(unittest.TestCase):
    def test_memory_tracks_entries_and_summarizes_them(self):
        memory = load_memory()
        remember('task', 'inspect startup path', memory)
        summary = summarize_memory(memory)
        self.assertIn('Memory entries', summary)
        self.assertIn('task', summary)


if __name__ == '__main__':
    unittest.main()
