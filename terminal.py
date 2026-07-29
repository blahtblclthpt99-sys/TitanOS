import subprocess
from typing import Dict


def run_command(command: str, cwd: str | None = None) -> Dict[str, object]:
    completed = subprocess.run(command, shell=True, cwd=cwd, capture_output=True, text=True)
    return {
        "command": command,
        "returncode": completed.returncode,
        "stdout": completed.stdout.strip(),
        "stderr": completed.stderr.strip(),
    }
