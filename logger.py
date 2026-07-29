from datetime import datetime


def log(message: str) -> None:
    with open("logs/titan.log", "a", encoding="utf8") as handle:
        handle.write(f"[{datetime.now()}] {message}\n")
