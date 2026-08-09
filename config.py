import os

try:
    from dotenv import load_dotenv
except ImportError:
    # Loading a local .env file is a convenience, not a runtime requirement.
    # Production supplies configuration through the process environment.
    def load_dotenv(*_args, **_kwargs):
        return False

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

MODEL = "gpt-5.5"

PROJECT_FOLDER = "projects/TitanOS"

REPORT_FOLDER = "reports"

BACKUP_FOLDER = "backups"

LOG_FOLDER = "logs"
