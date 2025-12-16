"""Pydantic schemas for API requests and responses."""

from typing import Literal
from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    max_new_tokens: int = 256
    temperature: float = 0.9
    top_k: int | None = 50
    seed: int = 42
    trace_layer: int


class FullAttnRequest(BaseModel):
    messages: list[ChatMessage]
    trace_layer: int
    head: int
    seed: int = 42
    max_new_tokens: int = 0


class ErrorResponse(BaseModel):
    error: str
    code: str
