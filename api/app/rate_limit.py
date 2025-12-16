"""In-memory token bucket rate limiter."""

import time
from collections import defaultdict
from dataclasses import dataclass

from .config import RATE_LIMIT_PER_MIN, RATE_LIMIT_BURST


@dataclass
class TokenBucket:
    """Token bucket for rate limiting."""
    tokens: float
    last_refill: float


class RateLimiter:
    """In-memory token bucket rate limiter keyed by IP address."""

    def __init__(self, capacity: int, refill_rate: float):
        """
        Args:
            capacity: Maximum tokens (burst size)
            refill_rate: Tokens per second
        """
        self.capacity = capacity
        self.refill_rate = refill_rate
        self.buckets: dict[str, TokenBucket] = defaultdict(
            lambda: TokenBucket(tokens=capacity, last_refill=time.time())
        )

    def allow(self, ip: str) -> bool:
        """
        Check if request is allowed and consume a token.

        Args:
            ip: Client IP address

        Returns:
            True if allowed, False if rate limited
        """
        bucket = self.buckets[ip]
        now = time.time()

        # Refill tokens based on elapsed time
        elapsed = now - bucket.last_refill
        bucket.tokens = min(
            self.capacity,
            bucket.tokens + elapsed * self.refill_rate
        )
        bucket.last_refill = now

        # Try to consume a token
        if bucket.tokens >= 1.0:
            bucket.tokens -= 1.0
            return True

        return False

    def reset(self):
        """Reset all buckets (for testing)."""
        self.buckets.clear()


# Global rate limiter instance
rate_limiter = RateLimiter(
    capacity=RATE_LIMIT_BURST,
    refill_rate=RATE_LIMIT_PER_MIN / 60.0
)
