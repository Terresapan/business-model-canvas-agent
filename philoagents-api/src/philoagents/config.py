from pathlib import Path
import os

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Determine the environment based on the presence of a Cloud Run-specific variable
is_production = "K_SERVICE" in os.environ
ENV = "production" if is_production else "local"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env" if ENV == "local" else None,
        extra="ignore", 
        env_file_encoding="utf-8"
    )
    
    # --- GEMINI Configuration ---
    GEMINI_API_KEY: str
    GEMINI_LLM_MODEL: str = "gemini-2.5-flash"
    GEMINI_LLM_MODEL_CONTEXT_SUMMARY: str = "gemini-2.5-flash-lite"

    # --- LangSmith Configuration ---
    LANGSMITH_API_KEY: str | None = Field(default=None)
    LANGSMITH_TRACING: bool = True
    LANGSMITH_ENDPOINT: str = "https://api.smith.langchain.com"
    LANGSMITH_PROJECT: str = "Business Model Canvas"


    # --- MongoDB Configuration ---
    MONGODB_URI: str 
    MONGODB_DB_NAME: str = "philoagents"
    MONGODB_DB_DEV_NAME: str = "philoagents_dev"
    MONGODB_USER_COLLECTION: str = "business_users"

    @model_validator(mode='after')
    def set_db_name(self):
        if ENV == "local":
            self.MONGODB_DB_NAME = self.MONGODB_DB_DEV_NAME
        return self

    # --- Agents Configuration ---
    TOTAL_MESSAGES_SUMMARY_TRIGGER: int = 14
    TOTAL_MESSAGES_AFTER_SUMMARY: int = 5

    # --- Paths Configuration ---
    # EVALUATION_DATASET_FILE_PATH: Path = Path("data/evaluation_dataset.json")
    # EXTRACTION_METADATA_FILE_PATH: Path = Path("data/extraction_metadata.json")


settings = Settings() # type: ignore

# --- Export Settings to Environment Variables for LangChain Tracing ---
# LangChain libraries rely on environment variables for tracing configuration.
if settings.LANGSMITH_API_KEY:
    os.environ["LANGCHAIN_API_KEY"] = settings.LANGSMITH_API_KEY
    os.environ["LANGCHAIN_TRACING_V2"] = "true" if settings.LANGSMITH_TRACING else "false"
    os.environ["LANGCHAIN_ENDPOINT"] = settings.LANGSMITH_ENDPOINT
    os.environ["LANGCHAIN_PROJECT"] = settings.LANGSMITH_PROJECT
    
    # Ensure compatibility with different SDK versions
    os.environ["LANGSMITH_API_KEY"] = settings.LANGSMITH_API_KEY
    os.environ["LANGSMITH_TRACING"] = "true" if settings.LANGSMITH_TRACING else "false"
    os.environ["LANGSMITH_ENDPOINT"] = settings.LANGSMITH_ENDPOINT
    os.environ["LANGSMITH_PROJECT"] = settings.LANGSMITH_PROJECT
