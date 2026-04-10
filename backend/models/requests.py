from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Literal


class PresentationRequest(BaseModel):
    title:     str        = Field(..., min_length=1, max_length=200)
    topics:    List[str]  = Field(..., min_length=1, max_length=20)
    num_slides: int       = Field(default=5, ge=2, le=15)
    context:   str        = Field(default="", max_length=5000)
    tone:      str        = Field(default="professional")
    theme:     str        = Field(default="neon")
    force_provider: str | None = Field(default=None)

    @field_validator("topics")
    @classmethod
    def validate_topics(cls, v: List[str]) -> List[str]:
        sanitised = [t.strip()[:80] for t in v if t.strip()]
        if not sanitised:
            raise ValueError("At least one topic is required.")
        return sanitised

    @field_validator("tone")
    @classmethod
    def validate_tone(cls, v: str) -> str:
        allowed = {"professional", "executive", "technical", "academic", "sales", "simple"}
        return v.lower() if v.lower() in allowed else "professional"


class SlideData(BaseModel):
    title: str
    content: List[str]
    code: Optional[str] = None
    language: Optional[str] = None
    notes: Optional[str] = ""
    image_query: Optional[str] = None
    image_base64: Optional[str] = None


class ExportRequest(BaseModel):
    title: str
    slides: List[SlideData]
    theme: str = "neon"


class RegenerateSlideRequest(BaseModel):
    title: str
    context: str
    tone: str
    existing_titles: List[str]


class RegenerateImageRequest(BaseModel):
    query: str


class UserRegister(BaseModel):
    email: str
    password: str
    full_name: str
    # role is intentionally excluded — users cannot self-assign roles


class UserLogin(BaseModel):
    email: str
    password: str
    login_as: str


class AdminCreateUser(BaseModel):
    email: str
    password: str
    full_name: str
    role: str = "user"


class UpdateRoleRequest(BaseModel):
    role: Literal["user", "admin"]


class UpdatePasswordRequest(BaseModel):
    password: str = Field(..., min_length=8, max_length=128)


class UpdateStatusRequest(BaseModel):
    status: Literal["active", "suspended", "pending"]
