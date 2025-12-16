"""Tests for rate limiting and prompt size limits."""

import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture
def client(dummy_model, dummy_cfg):
    """Create test client with dummy model."""
    app = create_app(model=dummy_model, cfg=dummy_cfg)
    return TestClient(app)


def test_prompt_too_large(client):
    """Test that oversized prompts return 413 with correct error code."""
    # Create a message that exceeds MAX_PROMPT_BYTES (16384)
    large_content = "x" * 20000

    response = client.post(
        "/chat/stream",
        json={
            "messages": [
                {"role": "user", "content": large_content}
            ],
            "trace_layer": 0
        }
    )

    assert response.status_code == 413
    data = response.json()
    assert data["code"] == "prompt_too_large"
    assert "error" in data


def test_rate_limit(client):
    """Test that rate limiting returns 429 with correct error code."""
    # Make valid request payload
    payload = {
        "messages": [
            {"role": "user", "content": "hello"}
        ],
        "trace_layer": 0,
        "max_new_tokens": 10
    }

    # Make requests until rate limited
    # Rate limit is 10/min with burst 3, so we can make 3 quick requests
    # then should be rate limited
    responses = []
    for i in range(5):
        response = client.post("/chat/stream", json=payload)
        responses.append(response)

    # At least one should be rate limited
    rate_limited = [r for r in responses if r.status_code == 429]
    assert len(rate_limited) > 0

    # Check error format
    data = rate_limited[0].json()
    assert data["code"] == "rate_limited"
    assert "error" in data


def test_rate_limit_full_attn(client):
    """Test that rate limiting also applies to full_attn endpoint."""
    # Make valid request payload
    payload = {
        "messages": [
            {"role": "user", "content": "hello"}
        ],
        "trace_layer": 0,
        "head": 0
    }

    # Make requests until rate limited
    responses = []
    for i in range(5):
        response = client.post("/inspect/full_attn", json=payload)
        responses.append(response)

    # At least one should be rate limited
    rate_limited = [r for r in responses if r.status_code == 429]
    assert len(rate_limited) > 0

    # Check error format
    data = rate_limited[0].json()
    assert data["code"] == "rate_limited"
    assert "error" in data


def test_valid_prompt_size(client):
    """Test that valid prompt sizes are accepted."""
    payload = {
        "messages": [
            {"role": "user", "content": "hello"}
        ],
        "trace_layer": 0,
        "max_new_tokens": 10
    }

    response = client.post("/chat/stream", json=payload)

    # Should not be 413
    assert response.status_code != 413
