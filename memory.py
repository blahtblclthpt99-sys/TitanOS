import json
import re
from pathlib import Path
from typing import Any, Dict, List


def _strip_json_comments(text: str) -> str:
    text = re.sub(r'//.*$', '', text, flags=re.MULTILINE)
    text = re.sub(r'/\*.*?\*/', '', text, flags=re.DOTALL)
    return text


def import_cursor_data(source: str | Path, memory: Dict[str, Any] | None = None) -> Dict[str, Any]:
    current = memory if memory is not None else load_memory()
    path = Path(source)
    if not path.exists():
        raise FileNotFoundError(f"Cursor data file not found: {path}")

    raw_text = path.read_text(encoding="utf-8")
    payload = None
    try:
        payload = json.loads(_strip_json_comments(raw_text))
    except json.JSONDecodeError as exc:
        try:
            payload = json.loads(_strip_json_comments(raw_text).replace("\n", "").replace("\t", ""))
        except Exception:
            payload = None

    entries = []
    if payload is None:
        if raw_text.strip():
            entries.append({"section": "cursor_raw", "value": raw_text.strip()})
        else:
            raise ValueError("Cursor data did not contain importable content")
    if isinstance(payload, dict):
        if isinstance(payload.get("messages"), list):
            for item in payload["messages"]:
                if isinstance(item, dict):
                    role = item.get("role", "unknown")
                    content = item.get("content", "")
                    if isinstance(content, list):
                        content = "\n".join(str(part.get("text", part)) for part in content if isinstance(part, dict))
                    if isinstance(content, str) and content.strip():
                        entries.append({"section": f"cursor_{role}", "value": content.strip()})
        elif isinstance(payload.get("data"), list):
            for item in payload["data"]:
                if isinstance(item, dict):
                    role = item.get("type", "cursor")
                    content = item.get("content") or item.get("text") or ""
                    if isinstance(content, str) and content.strip():
                        entries.append({"section": f"cursor_{role}", "value": content.strip()})
        else:
            for key, value in payload.items():
                if isinstance(value, str) and value.strip():
                    entries.append({"section": f"cursor_{key}", "value": value.strip()})
                elif isinstance(value, dict):
                    details = json.dumps(value, ensure_ascii=False, sort_keys=True)
                    if details.strip():
                        entries.append({"section": f"cursor_{key}", "value": details})
                elif isinstance(value, list):
                    details = json.dumps(value, ensure_ascii=False, sort_keys=True)
                    if details.strip():
                        entries.append({"section": f"cursor_{key}", "value": details})
    elif isinstance(payload, list):
        for item in payload:
            if isinstance(item, dict):
                role = item.get("role", "cursor")
                content = item.get("content") or item.get("text") or ""
                if isinstance(content, str) and content.strip():
                    entries.append({"section": f"cursor_{role}", "value": content.strip()})

    if not entries:
        raise ValueError("Cursor data did not contain importable content")

    events = current.setdefault("events", [])
    if not isinstance(events, list):
        events = []
        current["events"] = events

    events.extend(entries)
    save_memory(current)
    return current

MEMORY_FILE = Path(__file__).resolve().parent / "memory" / "history.json"


def load_memory() -> Dict[str, Any]:
    MEMORY_FILE.parent.mkdir(parents=True, exist_ok=True)
    if MEMORY_FILE.exists():
        try:
            data = json.loads(MEMORY_FILE.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                return data
            return {"events": data}
        except Exception:
            return {"events": []}
    return {"events": []}


def save_memory(memory: Dict[str, Any]) -> None:
    MEMORY_FILE.parent.mkdir(parents=True, exist_ok=True)
    MEMORY_FILE.write_text(json.dumps(memory, indent=2), encoding="utf-8")


def remember(section: str, value: str, memory: Dict[str, Any] | None = None) -> Dict[str, Any]:
    current = memory if memory is not None else load_memory()
    events = current.setdefault("events", [])
    if not isinstance(events, list):
        events = []
        current["events"] = events
    events.append({"section": section, "value": value})
    save_memory(current)
    return current


def summarize_memory(memory: Dict[str, Any]) -> str:
    events = memory.get("events", [])
    if not events:
        return "Memory is empty. Use 'remember <section> <value>' to add notes."
    by_section: Dict[str, List[str]] = {}
    for entry in events:
        if isinstance(entry, dict) and "section" in entry and "value" in entry:
            by_section.setdefault(entry["section"], []).append(entry["value"])
    lines = [f"Memory entries: {len(events)}"]
    for section, values in by_section.items():
        lines.append(f"- {section}: {len(values)}")
    return "\n".join(lines)


def set_active_task(task: str, memory: Dict[str, Any] | None = None) -> Dict[str, Any]:
    current = memory if memory is not None else load_memory()
    current["active_task"] = task
    save_memory(current)
    return current


def get_active_task(memory: Dict[str, Any]) -> str:
    task = memory.get("active_task")
    return str(task) if task else "No active task"
