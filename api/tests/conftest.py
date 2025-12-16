"""Pytest fixtures for API tests."""

import pytest
import torch
from dataclasses import dataclass

from app.rate_limit import rate_limiter


@dataclass
class DummyConfig:
    """Dummy model config for testing."""
    V: int = 256
    T: int = 256
    C: int = 64
    L: int = 4
    H: int = 4
    D: int = 16
    d_ff: int = 256
    dropout: float = 0.1


class DummyModel:
    """Dummy model that returns deterministic outputs without real computation."""

    def forward_with_attn_trace(self, x, trace_layer=0, return_full_attn=False):
        """
        Dummy forward pass with attention trace.

        Args:
            x: (B, T) token ids
            trace_layer: Layer to trace
            return_full_attn: Whether to return full attention matrix

        Returns:
            (logits, trace) tuple
        """
        B, T = x.shape
        V = 256
        H = 4

        # Create deterministic logits that favor token 72 ('H')
        logits = torch.zeros(B, T, V)
        logits[:, :, 72] = 10.0  # Make 'H' highly probable

        # Create dummy attention
        if return_full_attn:
            # Full attention matrix (B, H, T, T)
            attn_full = torch.ones(B, H, T, T) / T  # Uniform attention
            trace = {"attn_full": attn_full}
        else:
            # Just the last row (B, H, T)
            attn_row = torch.ones(B, H, T) / T
            trace = {"attn_row": attn_row}

        return logits, trace

    def eval(self):
        """Dummy eval mode."""
        return self

    def to(self, device):
        """Dummy to device."""
        return self


@pytest.fixture
def dummy_model():
    """Provide a dummy model for testing."""
    return DummyModel()


@pytest.fixture
def dummy_cfg():
    """Provide a dummy config for testing."""
    return DummyConfig()


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    """Reset rate limiter before each test."""
    rate_limiter.reset()
    yield
    rate_limiter.reset()
