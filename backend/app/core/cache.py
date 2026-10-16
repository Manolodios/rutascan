"""Redis cache with an in-process fallback.

Redis is used for: PIN brute-force rate limiting, short-TTL caches (license
lookups, device touch throttling) and refresh-token revocation. When Redis is
unreachable the process degrades gracefully to an in-memory store so single-
node/dev installs keep working.
"""

from __future__ import annotations

import logging
import threading
import time
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class RateLimitResult:
    allowed: bool
    remaining: int
    retry_after: int  # seconds until the window resets (0 when allowed)


class Cache:
    def __init__(self) -> None:
        self._redis = None
        self._memory: dict[str, tuple[float | None, Any]] = {}
        self._lock = threading.Lock()

    # ------------------------------------------------------------- init
    def init(self, url: str) -> None:
        try:
            import redis  # noqa: PLC0415

            client = redis.Redis.from_url(
                url, decode_responses=True, socket_connect_timeout=2, socket_timeout=2
            )
            client.ping()
            self._redis = client
            logger.info("Cache: connected to Redis at %s", url)
        except Exception as exc:  # pragma: no cover - depends on environment
            self._redis = None
            logger.warning("Cache: Redis unavailable (%s). Using in-memory fallback.", exc)

    @property
    def backend(self) -> str:
        return "redis" if self._redis is not None else "memory"

    # ---------------------------------------------------------- basics
    def get(self, key: str) -> Any | None:
        if self._redis is not None:
            try:
                return self._redis.get(key)
            except Exception:  # pragma: no cover
                self._redis = None
        with self._lock:
            entry = self._memory.get(key)
            if entry is None:
                return None
            expires_at, value = entry
            if expires_at is not None and expires_at < time.time():
                self._memory.pop(key, None)
                return None
            return value

    def set(self, key: str, value: Any, ttl_seconds: int | None = None) -> None:
        if self._redis is not None:
            try:
                if ttl_seconds:
                    self._redis.set(key, value, ex=ttl_seconds)
                else:
                    self._redis.set(key, value)
                return
            except Exception:  # pragma: no cover
                self._redis = None
        with self._lock:
            expires_at = time.time() + ttl_seconds if ttl_seconds else None
            self._memory[key] = (expires_at, value)

    def delete(self, key: str) -> None:
        if self._redis is not None:
            try:
                self._redis.delete(key)
                return
            except Exception:  # pragma: no cover
                self._redis = None
        with self._lock:
            self._memory.pop(key, None)

    def incr(self, key: str, ttl_seconds: int) -> int:
        if self._redis is not None:
            try:
                pipe = self._redis.pipeline()
                pipe.incr(key)
                pipe.ttl(key)
                count, ttl = pipe.execute()
                if ttl is None or int(ttl) < 0:
                    self._redis.expire(key, ttl_seconds)
                return int(count)
            except Exception:  # pragma: no cover
                self._redis = None
        with self._lock:
            now = time.time()
            expires_at, value = self._memory.get(key, (None, 0))
            if expires_at is None or expires_at < now:
                expires_at, value = now + ttl_seconds, 0
            value = int(value) + 1
            self._memory[key] = (expires_at, value)
            return value

    def ttl(self, key: str) -> int:
        if self._redis is not None:
            try:
                ttl = self._redis.ttl(key)
                return max(0, int(ttl))
            except Exception:  # pragma: no cover
                self._redis = None
        with self._lock:
            entry = self._memory.get(key)
            if not entry or entry[0] is None:
                return 0
            return max(0, int(entry[0] - time.time()))

    def healthy(self) -> bool:
        if self._redis is not None:
            try:
                return bool(self._redis.ping())
            except Exception:  # pragma: no cover
                return False
        return False


cache = Cache()


# ------------------------------------------------------------ rate limit ---
def check_rate_limit(
    scope: str, identifier: str, max_attempts: int, window_seconds: int
) -> RateLimitResult:
    key = f"rl:{scope}:{identifier}"
    current = cache.get(key)
    if current is None:
        return RateLimitResult(allowed=True, remaining=max_attempts, retry_after=0)
    current = int(current)
    if current >= max_attempts:
        return RateLimitResult(
            allowed=False, remaining=0, retry_after=cache.ttl(key) or window_seconds
        )
    return RateLimitResult(
        allowed=True, remaining=max_attempts - current, retry_after=0
    )


def register_failed_attempt(scope: str, identifier: str, window_seconds: int) -> int:
    return cache.incr(f"rl:{scope}:{identifier}", window_seconds)


def reset_rate_limit(scope: str, identifier: str) -> None:
    cache.delete(f"rl:{scope}:{identifier}")
