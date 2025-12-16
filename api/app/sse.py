"""Server-Sent Events (SSE) formatting utilities."""

import json
from typing import Iterator


def format_sse_event(event: str, data: dict) -> str:
    """
    Format an SSE event.

    Args:
        event: Event name (e.g., "token", "trace", "done")
        data: Event data dict (will be JSON-encoded)

    Returns:
        Formatted SSE event string with trailing newline
    """
    data_json = json.dumps(data, separators=(',', ':'))
    return f"event: {event}\ndata: {data_json}\n\n"


def stream_sse_events(events: Iterator[dict]) -> Iterator[str]:
    """
    Convert event dicts to SSE-formatted strings.

    Args:
        events: Iterator of event dicts with keys "event" and "data"

    Yields:
        SSE-formatted strings
    """
    for event_dict in events:
        yield format_sse_event(event_dict["event"], event_dict["data"])
