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
    include_images: bool       = Field(default=True)

    type:      str        = Field(default="ppt") # ppt or notes
    track:     Optional[str] = None
    client:    Optional[str] = None
    module:    Optional[str] = None
    course:    Optional[str] = None
    target_audience: Optional[str] = None

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
        allowed = {"professional", "executive", "technical", "academic", "sales", "simple", "casual", "creative"}
        return v.lower() if v.lower() in allowed else "professional"

    @field_validator("theme")
    @classmethod
    def validate_theme(cls, v: str) -> str:
        allowed = {"neon", "ocean", "emerald", "royal", "dark", "light", "carbon"}
        return v.lower() if v.lower() in allowed else "neon"


class NotesRequest(BaseModel):
    subject:   str        = Field(..., min_length=1, max_length=200)
    unit:      str        = Field(default="")
    topics:    List[str]  = Field(..., min_length=1, max_length=20)
    context:   str        = Field(default="", max_length=5000)
    pages:     int        = Field(default=3, ge=1, le=20)
    depth:     str        = Field(default="standard")
    format:    str        = Field(default="prose")
    track:     Optional[str] = None
    client:    Optional[str] = None
    force_provider: str | None = Field(default=None)

    @field_validator("topics")
    @classmethod
    def validate_topics(cls, v: List[str]) -> List[str]:
        sanitised = [t.strip()[:80] for t in v if t.strip()]
        if not sanitised:
            raise ValueError("At least one topic is required.")
        return sanitised


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
    existing_titles: List[str] = Field(default_factory=list)