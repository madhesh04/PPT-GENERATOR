from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
from typing import List


class Settings(BaseSettings):
    # MongoDB
    mongodb_uri: str = "mongodb://localhost:27017"
    
    # Timesheet Auth DB (external)
    timesheet_mongodb_uri: str = ""  # Falls back to mongodb_uri if empty
    timesheet_db_name: str = "Timesheet-Application"

    # Auth
    jwt_secret: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440  # 24 hours
    
    # LLM
    groq_api_key: str
    nvidia_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"
    nvidia_model: str = "meta/llama-3.1-405b-instruct"
    
    # Image APIs
    unsplash_access_key: str = ""
    freepik_api_key: str = ""
    pollinations_api_key: str = ""
    
    # App
    # frontend_url supports comma-separated values for multi-origin CORS
    # e.g. "https://app.example.com,https://staging.example.com"
    frontend_url: str = "http://localhost:5173"
    # Public URL of this backend — used in OAuth discovery metadata.
    # For local dev use ngrok/tunnel URL; for production use your deployed URL.
    backend_url: str = "http://localhost:8000"
    ppt_font: str = "Calibri"
    mcp_token_expire_hours: int = 24

    model_config = SettingsConfigDict(
        env_file=".env", 
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def cors_origins(self) -> List[str]:
        """
        Parse frontend_url as a comma-separated list of allowed origins.
        Always includes localhost variants for development.
        """
        base = [url.strip().rstrip("/") for url in self.frontend_url.split(",") if url.strip()]
        # Always allow local dev origins
        dev_origins = ["http://localhost:5173", "http://127.0.0.1:5173"]
        return list(set(base + dev_origins))


@lru_cache()
def get_settings() -> Settings:
    s = Settings()
    # Startup Guard: refuse to start with an insecure default JWT secret
    if not s.jwt_secret or s.jwt_secret == "super-secret-key-change-me":
        raise ValueError(
            "JWT_SECRET is not set or is set to the default insecure value. Refusing to start."
        )
    return s


settings = get_settings()
