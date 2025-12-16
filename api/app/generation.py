"""Generation logic with SSE streaming and attention traces."""

from typing import Iterator
import torch
import torch.nn.functional as F

from niels_gpt.model.gpt import GPT
from niels_gpt.config import ModelConfig
from niels_gpt.tokenizer import encode, decode
from niels_gpt.chat_format import format_chat, extract_assistant_reply

from .token_utils import token_display


def stream_chat_events(
    model: GPT,
    cfg: ModelConfig,
    *,
    messages: list[dict],
    max_new_tokens: int,
    temperature: float,
    top_k: int | None,
    seed: int,
    trace_layer: int,
    device: str,
) -> Iterator[dict]:
    """
    Stream chat events with tokens and attention traces.

    Yields dicts with keys:
        - event: "token" | "trace" | "done"
        - data: event-specific data dict

    Raises:
        ValueError: If trace_layer is out of bounds
    """
    # Validate trace layer
    if not (0 <= trace_layer < cfg.L):
        raise ValueError(f"trace_layer must be in [0, {cfg.L - 1}], got {trace_layer}")

    # Build and encode transcript
    transcript = format_chat(messages)
    prompt_ids = encode(transcript)  # CPU int64
    ids = prompt_ids.clone()

    # Track where generation starts
    prompt_len = len(prompt_ids)

    # Create CPU generator for reproducibility
    generator = torch.Generator(device="cpu")
    generator.manual_seed(seed)

    # Generation loop
    for step in range(max_new_tokens):
        # Crop to context window
        ctx = ids[-cfg.T:] if len(ids) > cfg.T else ids

        # Forward pass with attention trace
        ctx_batch = ctx[None, :].to(device)  # (1, t)
        with torch.no_grad():
            logits, trace = model.forward_with_attn_trace(
                ctx_batch,
                trace_layer=trace_layer,
                return_full_attn=False
            )

        # Get last position logits
        logits_last = logits[0, -1].cpu()  # (V,)

        # Sample next token
        if temperature == 0:
            # Greedy
            next_token = logits_last.argmax().item()
            # For entropy/topk, use uniform distribution at the greedy choice
            probs = torch.zeros_like(logits_last)
            probs[next_token] = 1.0
        else:
            # Temperature scaling
            scaled = logits_last / temperature

            # Top-k filtering
            if top_k is not None:
                topk_vals, topk_indices = torch.topk(scaled, min(top_k, len(scaled)))
                # Set all non-topk logits to -inf
                mask = torch.full_like(scaled, float('-inf'))
                mask[topk_indices] = scaled[topk_indices]
                scaled = mask

            # Compute probabilities
            probs = F.softmax(scaled, dim=-1)

            # Sample
            next_token = torch.multinomial(probs, num_samples=1, generator=generator).item()

        # Compute entropy and top-10
        # Clip probs for numerical stability
        probs_safe = probs.clamp(min=1e-12)
        entropy = -(probs * torch.log(probs_safe)).sum().item()

        # Get top 10
        top10_probs, top10_indices = torch.topk(probs, min(10, len(probs)))
        topk_list = [
            {
                "token_id": int(top10_indices[i]),
                "token_text": decode(torch.tensor([top10_indices[i]], dtype=torch.int64)),
                "token_display": token_display(int(top10_indices[i])),
                "prob": float(top10_probs[i])
            }
            for i in range(len(top10_indices))
        ]

        # Decode token text
        token_text = decode(torch.tensor([next_token], dtype=torch.int64))
        token_disp = token_display(next_token)

        # Extract attention row for last position
        attn_row = trace["attn_row"]  # (1, H, t)
        attn_list = attn_row[0].cpu().tolist()  # (H, t)

        # Emit token event
        yield {
            "event": "token",
            "data": {
                "step": step,
                "token_id": next_token,
                "token_text": token_text,
                "token_display": token_disp
            }
        }

        # Emit trace event
        yield {
            "event": "trace",
            "data": {
                "step": step,
                "entropy": entropy,
                "topk": topk_list,
                "attn": attn_list
            }
        }

        # Append next token
        ids = torch.cat([ids, torch.tensor([next_token], dtype=torch.int64)])

        # Check for stop sequences in generated portion
        generated_ids = ids[prompt_len:]
        generated_bytes = bytes(generated_ids.tolist())

        # Stop if we see role tags in the generated portion
        if b"\nuser: " in generated_bytes or b"\nsystem: " in generated_bytes:
            # Find the stop position
            user_pos = generated_bytes.find(b"\nuser: ")
            system_pos = generated_bytes.find(b"\nsystem: ")

            # Take the earliest stop position
            stop_positions = [p for p in [user_pos, system_pos] if p != -1]
            if stop_positions:
                stop_pos = min(stop_positions)
                # Truncate before the stop tag
                ids = torch.cat([
                    prompt_ids,
                    generated_ids[:stop_pos]
                ])
            break

    # Decode final text and extract reply
    decoded_text = decode(ids)
    reply = extract_assistant_reply(decoded_text)

    # Emit done event
    yield {
        "event": "done",
        "data": {
            "reply": reply
        }
    }


def generate_full_attn(
    model: GPT,
    cfg: ModelConfig,
    *,
    messages: list[dict],
    trace_layer: int,
    head: int,
    device: str,
) -> dict:
    """
    Generate full attention matrix for a given layer and head.

    Args:
        model: GPT model
        cfg: Model config
        messages: Chat messages
        trace_layer: Layer index to trace
        head: Head index to extract
        device: Device to run on

    Returns:
        Dict with keys: layer, head, tokens, attn

    Raises:
        ValueError: If trace_layer or head are out of bounds
    """
    # Validate inputs
    if not (0 <= trace_layer < cfg.L):
        raise ValueError(f"trace_layer must be in [0, {cfg.L - 1}], got {trace_layer}")
    if not (0 <= head < cfg.H):
        raise ValueError(f"head must be in [0, {cfg.H - 1}], got {head}")

    # Build and encode transcript
    transcript = format_chat(messages)
    prompt_ids = encode(transcript)  # CPU int64

    # Crop to context window
    ctx = prompt_ids[-cfg.T:] if len(prompt_ids) > cfg.T else prompt_ids
    t = len(ctx)

    # Forward pass with full attention
    ctx_batch = ctx[None, :].to(device)  # (1, t)
    with torch.no_grad():
        logits, trace = model.forward_with_attn_trace(
            ctx_batch,
            trace_layer=trace_layer,
            return_full_attn=True
        )

    # Extract full attention matrix for selected head
    attn_full = trace["attn_full"]  # (1, H, t, t)
    attn_matrix = attn_full[0, head, :t, :t].cpu().tolist()  # (t, t)

    # Decode tokens
    token_ids = ctx.tolist()
    tokens = [decode(torch.tensor([tid], dtype=torch.int64)) for tid in token_ids]
    tokens_display = [token_display(tid) for tid in token_ids]

    return {
        "layer": trace_layer,
        "head": head,
        "token_ids": token_ids,
        "tokens": tokens,
        "tokens_display": tokens_display,
        "attn": attn_matrix
    }
