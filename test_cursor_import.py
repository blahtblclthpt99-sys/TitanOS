import json
import tempfile
import unittest
from pathlib import Path

from memory import import_cursor_data, load_memory


class CursorImportTests(unittest.TestCase):
    def test_import_cursor_data_from_json_file(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "cursor.json"
            path.write_text(json.dumps({"messages": [{"role": "user", "content": "hello from cursor"}]}), encoding="utf-8")

            memory = load_memory()
            imported = import_cursor_data(path, memory)

            self.assertIn("events", imported)
            self.assertTrue(any(entry.get("value", "").startswith("hello from cursor") for entry in imported["events"]))

    def test_import_cursor_data_falls_back_to_raw_text_when_json_is_invalid(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "cursor.txt"
            path.write_text("raw cursor config content", encoding="utf-8")

            memory = load_memory()
            imported = import_cursor_data(path, memory)

            self.assertIn("events", imported)
            self.assertTrue(any(entry.get("value", "").startswith("raw cursor config content") for entry in imported["events"]))


if __name__ == "__main__":
    unittest.main()
