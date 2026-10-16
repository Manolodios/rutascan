"""Shared schema helpers."""

from __future__ import annotations

from pydantic import BaseModel


class Message(BaseModel):
    detail: str
    code: str | None = None


class ErrorOut(BaseModel):
    """Standard error envelope returned by handlers: {detail, code}."""

    detail: str
    code: str | None = None
