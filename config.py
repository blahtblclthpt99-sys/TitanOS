import os
from dotenv import load_dotenv

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

MODEL = "gpt-5.5"

PROJECT_FOLDER = "projects/TitanOS"

REPORT_FOLDER = "reports"

BACKUP_FOLDER = "backups"

LOG_FOLDER = "logs"
