"""Tests for full attention matrix endpoint."""

import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture
def client(dummy_model, dummy_cfg):
    """Create test client with dummy model."""
    app = create_app(model=dummy_model, cfg=dummy_cfg)
    return TestClient(app)


def test_full_attn_returns_correct_keys(client):
    """Test that full_attn endpoint returns expected keys."""
    payload = {
        "messages": [
            {"role": "user", "content": "hello"}
        ],
        "trace_layer": 0,
        "head": 0
    }

    response = client.post("/inspect/full_attn", json=payload)

    assert response.status_code == 200
    data = response.json()

    # Check expected keys
    assert "layer" in data
    assert "head" in data
    assert "tokens" in data
    assert "attn" in data

    # Check types
    assert isinstance(data["layer"], int)
    assert isinstance(data["head"], int)
    assert isinstance(data["tokens"], list)
    assert isinstance(data["attn"], list)


def test_full_attn_matrix_shape(client):
    """Test that attention matrix has correct shape (t x t)."""
    payload = {
        "messages": [
            {"role": "user", "content": "hello"}
        ],
        "trace_layer": 0,
        "head": 0
    }

    response = client.post("/inspect/full_attn", json=payload)

    assert response.status_code == 200
    data = response.json()

    # Get dimensions
    tokens = data["tokens"]
    attn = data["attn"]
    t = len(tokens)

    # Attention matrix should be (t, t)
    assert len(attn) == t
    for row in attn:
        assert len(row) == t


def test_full_attn_tokens_match_length(client):
    """Test that tokens list length matches attention matrix dimensions."""
    payload = {
        "messages": [
            {"role": "user", "content": "hello"}
        ],
        "trace_layer": 0,
        "head": 1
    }

    response = client.post("/inspect/full_attn", json=payload)

    assert response.status_code == 200
    data = response.json()

    t = len(data["tokens"])
    attn_rows = len(data["attn"])

    assert t == attn_rows


def test_full_attn_invalid_layer(client, dummy_cfg):
    """Test that invalid layer index returns 422."""
    payload = {
        "messages": [
            {"role": "user", "content": "hello"}
        ],
        "trace_layer": dummy_cfg.L + 1,  # Out of bounds
        "head": 0
    }

    response = client.post("/inspect/full_attn", json=payload)

    assert response.status_code == 422


def test_full_attn_invalid_head(client, dummy_cfg):
    """Test that invalid head index returns 422."""
    payload = {
        "messages": [
            {"role": "user", "content": "hello"}
        ],
        "trace_layer": 0,
        "head": dummy_cfg.H + 1  # Out of bounds
    }

    response = client.post("/inspect/full_attn", json=payload)

    assert response.status_code == 422


def test_full_attn_returns_correct_layer_head(client):
    """Test that response contains correct layer and head values."""
    payload = {
        "messages": [
            {"role": "user", "content": "hello"}
        ],
        "trace_layer": 2,
        "head": 3
    }

    response = client.post("/inspect/full_attn", json=payload)

    assert response.status_code == 200
    data = response.json()

    assert data["layer"] == 2
    assert data["head"] == 3
