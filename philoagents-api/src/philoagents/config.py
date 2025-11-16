from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", extra="ignore", env_file_encoding="utf-8"
    )

    # --- GROQ Configuration ---
    GROQ_API_KEY: str
    GROQ_LLM_MODEL: str = "llama-3.3-70b-versatile"
    GROQ_LLM_MODEL_CONTEXT_SUMMARY: str = "llama-3.1-8b-instant"

    # --- GEMINI Configuration ---
    GEMINI_API_KEY: str
    GEMINI_LLM_MODEL: str = "gemini-2.5-flash"
    GEMINI_LLM_MODEL_CONTEXT_SUMMARY: str = "gemini-2.5-flash-lite"

    # --- LangSmith Configuration ---
    LANGSMITH_API_KEY: str | None = Field(default=None)

    # --- MongoDB Configuration ---
    MONGODB_URI: str = "mongodb://philoagents:philoagents@local_dev_atlas:27017/?directConnection=true"
    MONGODB_DB_NAME: str = "philoagents"
    MONGODB_USER_COLLECTION: str = "business_users"

    # --- Agents Configuration ---
    TOTAL_MESSAGES_SUMMARY_TRIGGER: int = 14
    TOTAL_MESSAGES_AFTER_SUMMARY: int = 5

    # --- Paths Configuration ---
    # EVALUATION_DATASET_FILE_PATH: Path = Path("data/evaluation_dataset.json")
    # EXTRACTION_METADATA_FILE_PATH: Path = Path("data/extraction_metadata.json")


settings = Settings() # type: ignore
