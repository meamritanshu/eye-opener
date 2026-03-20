import os
from dotenv import load_dotenv


load_dotenv()


CEREBRAS_API_KEY = os.getenv("CEREBRAS_API_KEY", "").strip()
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "").strip()
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "XianYu_bi/DeepSeek-R1-Distill-Qwen-14B-Q3_K_M:latest")
USE_LOCAL_LLM = os.getenv("USE_LOCAL_LLM", "true").lower() == "true"

CEREBRAS_MODEL = "llama3.3-70b"
GROQ_MODEL = "llama-3.3-70b-versatile"
GITHUB_QUALITY_MODEL = "gpt-4.1-mini"

FLASK_ENV = os.getenv("FLASK_ENV", "development")
FLASK_PORT = int(os.getenv("FLASK_PORT", "5000"))
CHROMA_DB_PATH = os.getenv("CHROMA_DB_PATH", "./chroma_db")


# Production mode detection
IS_PRODUCTION = os.getenv("RAILWAY_ENVIRONMENT") is not None or FLASK_ENV == "production"

# Force cloud LLM in production (no local Ollama on Railway)
if IS_PRODUCTION:
    USE_LOCAL_LLM = False


def get_config_warnings() -> list[str]:
    warnings: list[str] = []
    if not (USE_LOCAL_LLM or CEREBRAS_API_KEY or GROQ_API_KEY or GITHUB_TOKEN):
        warnings.append(
            "No LLM credentials configured. Enable USE_LOCAL_LLM or set at least one of CEREBRAS_API_KEY, GROQ_API_KEY, or GITHUB_TOKEN."
        )
    return warnings


CONFIG_WARNINGS = get_config_warnings()
CONFIG_ERRORS: list[str] = []


def get_settings_dict() -> dict:
    """Return current configurable settings as a plain dict for the API."""
    return {
        "USE_LOCAL_LLM": USE_LOCAL_LLM,
        "OLLAMA_BASE_URL": OLLAMA_BASE_URL,
        "OLLAMA_MODEL": OLLAMA_MODEL,
        "CEREBRAS_API_KEY": CEREBRAS_API_KEY,
        "CEREBRAS_MODEL": CEREBRAS_MODEL,
        "GROQ_API_KEY": GROQ_API_KEY,
        "GROQ_MODEL": GROQ_MODEL,
        "GITHUB_TOKEN": GITHUB_TOKEN,
        "GITHUB_QUALITY_MODEL": GITHUB_QUALITY_MODEL,
        "FLASK_PORT": FLASK_PORT,
    }
