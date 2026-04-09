from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
from typing import List, Optional
import os

class Settings(BaseSettings):
    # MongoDB
    mongodb_uri: str = "mongodb://localhost:27017"
    
    # Auth
    jwt_secret: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440 # 24 hours
    
    # LLM
    groq_api_key: str
    nvidia_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"
    nvidia_model: str = "meta/llama-3.1-405b-instruct" # Example default
    
    # Image APIs
    unsplash_access_key: str = ""
    freepik_api_key: str = ""
    pollinations_api_key: str = ""
    
    # App
    frontend_url: str = "http://localhost:5173"
    master_email: str = "admin@skynet.ai"
    ppt_ttl_seconds: int = 300
    ppt_font: str = "Calibri"

    model_config = SettingsConfigDict(
        env_file=".env", 
        env_file_encoding="utf-8",
        extra="ignore"
    )

@lru_cache()
def get_settings() -> Settings:
    settings = Settings()
    # Startup Guard as recommended by Senior Review
    if not settings.jwt_secret or settings.jwt_secret == "super-secret-key-change-me":
        raise ValueError("JWT_SECRET is not set or is set to the default insecure value. Refusing to start.")
    return settings

settings = get_settings()
