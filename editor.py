from pathlib import Path
from typing import Optional


def read_file(path: str) -> str:
    file_path = Path(path)
    if not file_path.exists():
        raise FileNotFoundError(path)
    return file_path.read_text(encoding="utf-8")


def create_file(path: str, content: str = "") -> str:
    file_path = Path(path)
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text(content, encoding="utf-8")
    return f"Created {file_path}"


def edit_file(path: str, content: str) -> str:
    file_path = Path(path)
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text(content, encoding="utf-8")
    return f"Updated {file_path}"


def rename_file(old_path: str, new_path: str) -> str:
    old = Path(old_path)
    new = Path(new_path)
    old.rename(new)
    return f"Renamed {old} -> {new}"


def delete_file(path: str, confirm: bool = False) -> str:
    file_path = Path(path)
    if not confirm:
        return f"Deletion requires confirmation. Use 'delete {path} confirm'."
    if file_path.exists():
        file_path.unlink()
        return f"Deleted {file_path}"
    return f"Nothing to delete at {file_path}"
