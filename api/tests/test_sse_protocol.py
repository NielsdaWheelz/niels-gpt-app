"""Tests for SSE protocol and event ordering."""

import pytest
from fastapi.testclient import TestClient
import json

from app.main import create_app


@pytest.fixture
def client(dummy_model, dummy_cfg):
    """Create test client with dummy model."""
    app = create_app(model=dummy_model, cfg=dummy_cfg)
    return TestClient(app)


def test_sse_stream_returns_200_and_correct_content_type(client):
    """Test that SSE endpoint returns 200 and text/event-stream."""
    payload = {
        "messages": [
            {"role": "user", "content": "hello"}
        ],
        "trace_layer": 0,
        "max_new_tokens": 5
    }

    response = client.post("/chat/stream", json=payload)

    assert response.status_code == 200
    assert "text/event-stream" in response.headers["content-type"]


def test_sse_event_ordering(client):
    """Test that SSE events are emitted in correct order: token, trace, ..., done."""
    payload = {
        "messages": [
            {"role": "user", "content": "hello"}
        ],
        "trace_layer": 0,
        "max_new_tokens": 3
    }

    response = client.post("/chat/stream", json=payload)

    # Parse SSE events
    events = parse_sse_events(response.text)

    # Should have at least: token, trace (per step), then done
    assert len(events) > 0

    # Check ordering: alternating token/trace, then done at end
    event_types = [e["event"] for e in events]

    # Last event should be "done"
    assert event_types[-1] == "done"

    # Before done, should have alternating token and trace
    before_done = event_types[:-1]
    for i in range(0, len(before_done), 2):
        if i < len(before_done):
            assert before_done[i] == "token"
        if i + 1 < len(before_done):
            assert before_done[i + 1] == "trace"


def test_sse_trace_contains_attn_and_topk(client):
    """Test that trace events contain attention and topk fields."""
    payload = {
        "messages": [
            {"role": "user", "content": "hello"}
        ],
        "trace_layer": 0,
        "max_new_tokens": 2
    }

    response = client.post("/chat/stream", json=payload)
    events = parse_sse_events(response.text)

    # Find trace events
    trace_events = [e for e in events if e["event"] == "trace"]
    assert len(trace_events) > 0

    # Check trace structure
    for trace_event in trace_events:
        data = trace_event["data"]
        assert "attn" in data
        assert "topk" in data
        assert "entropy" in data
        assert "step" in data

        # attn should be nested lists (H heads, each with attention weights)
        assert isinstance(data["attn"], list)
        assert len(data["attn"]) > 0
        assert isinstance(data["attn"][0], list)

        # topk should have 10 items (or less if vocab is smaller)
        assert isinstance(data["topk"], list)
        assert len(data["topk"]) <= 10
        if len(data["topk"]) > 0:
            assert "token_id" in data["topk"][0]
            assert "token_text" in data["topk"][0]
            assert "prob" in data["topk"][0]


def test_sse_done_contains_reply(client):
    """Test that done event contains reply field."""
    payload = {
        "messages": [
            {"role": "user", "content": "hello"}
        ],
        "trace_layer": 0,
        "max_new_tokens": 2
    }

    response = client.post("/chat/stream", json=payload)
    events = parse_sse_events(response.text)

    # Find done event
    done_events = [e for e in events if e["event"] == "done"]
    assert len(done_events) == 1

    # Check done structure
    data = done_events[0]["data"]
    assert "reply" in data
    assert isinstance(data["reply"], str)


def parse_sse_events(text: str) -> list[dict]:
    """
    Parse SSE events from response text.

    Args:
        text: Raw SSE response text

    Returns:
        List of event dicts with "event" and "data" keys
    """
    events = []
    lines = text.strip().split('\n')

    current_event = None
    current_data = None

    for line in lines:
        if line.startswith("event: "):
            current_event = line[7:].strip()
        elif line.startswith("data: "):
            current_data = json.loads(line[6:].strip())
        elif line == "" and current_event and current_data is not None:
            events.append({"event": current_event, "data": current_data})
            current_event = None
            current_data = None

    # Handle last event if stream ended without trailing empty line
    if current_event and current_data is not None:
        events.append({"event": current_event, "data": current_data})

    return events
