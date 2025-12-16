# PR-08b: fastapi inference backend (sse + traces + limits)

repo: niels-gpt-app
scope: api only

## goal
ship a small fastapi service that:
- downloads (if missing) and loads the niels-gpt checkpoint at startup
- exposes an SSE streaming chat endpoint that emits:
  - generated tokens
  - per-step top-k + entropy
  - per-step attention row for a selected layer (all heads)
- enforces:
  - max prompt bytes (16384) -> 413 json error
  - rate limit (10 req/min/ip, burst 3) -> 429 json error
- supports CORS for:
  - https://nielseriknandal.com
  - localhost dev
  - placeholder for demo origin (configurable)
- provides an on-demand endpoint to fetch the full attention matrix for a selected layer/head (for the UI toggle)

## non-goals
- any web UI
- auth/login/accounts/db
- kv-cache optimization
- multi-model loading / hot reload
- training in production

## repo layout (must create)
api/
  app/
    __init__.py
    main.py
    config.py
    checkpoint.py
    rate_limit.py
    schemas.py
    sse.py
    generation.py
  tests/
    test_limits.py
    test_sse_protocol.py
    test_full_attn.py
  requirements.txt
  README.md

## dependencies (api/requirements.txt)
- fastapi
- uvicorn[standard]
- pydantic
- torch
- huggingface-hub
- niels-gpt (the model library) pinned to the tagged version that includes forward_with_attn_trace
  - use a placeholder git URL if needed; do NOT invent local path installs.

example line (you may need to edit URL, but include it in requirements):
  niels-gpt @ git+https://github.com/NielsdaWheelz/niels-gpt

## imports from model library (must use)
from niels_gpt.model.gpt import GPT
from niels_gpt.config import ModelConfig
from niels_gpt.tokenizer import encode, decode
from niels_gpt.chat_format import format_chat, extract_assistant_reply

and the new method:
model.forward_with_attn_trace(x, trace_layer=..., return_full_attn=...)

## runtime decisions (fixed)
- python: 3.11
- device: cpu only in production (render). allow "mps" if running locally on mac, but default cpu.
- prompt cap: 16_384 bytes on the formatted transcript (utf-8)
- rate limit: 10 requests/min/ip, burst 3 (in-memory)
- streaming: SSE
- dropdown sets layer in request; head selection is client-side for streaming traces
- attention streamed: selected layer only, all heads (H=4)
- full-matrix toggle: separate endpoint returns (t,t) matrix for selected layer/head

## env config (api/app/config.py)
- API_HOST (default "0.0.0.0")
- API_PORT (default 8000)
- DEVICE (default "cpu")  # allow "mps" locally
- CKPT_REPO_ID (default "NielsdaWheelz/niels-gpt")
- CKPT_FILENAME (default "best.pt")
- CKPT_DIR (default "./checkpoints")  # under api/
- CKPT_PATH (default "{CKPT_DIR}/{CKPT_FILENAME}")
- MAX_PROMPT_BYTES (default 16384)
- RATE_LIMIT_PER_MIN (default 10)
- RATE_LIMIT_BURST (default 3)
- ALLOWED_ORIGINS (default:
    "https://nielseriknandal.com,http://localhost:3000,http://localhost:5173"
  )
- HF_TOKEN optional (pass-through for hf download auth)

## checkpoint download/load (api/app/checkpoint.py)
implement:
- ensure_checkpoint() -> Path
  - if CKPT_PATH exists: return it
  - else download from HF Hub using huggingface_hub.hf_hub_download with:
      repo_id=CKPT_REPO_ID, filename=CKPT_FILENAME, local_dir=CKPT_DIR, local_dir_use_symlinks=False
- load_model() -> (model, cfg)
  - torch.load checkpoint (map_location=device)
  - uses the niels-gpt checkpoint format from your training repo:
      dict with keys: model_cfg, model_state, ...
  - cfg = ModelConfig(**ckpt["model_cfg"])
  - model = GPT(cfg); model.load_state_dict(ckpt["model_state"]); model.to(device); model.eval()

NOTE: tests must not download or load real ckpt. structure code so app can be created with a dummy model.

## app factory (api/app/main.py)
- provide create_app(*, model=None, cfg=None) -> FastAPI
  - if model/cfg are None: load real model at startup
  - else use provided (tests)
- expose module-level `app = create_app()`

add routes:
- GET /health -> {"ok": true}

## schemas (api/app/schemas.py)
pydantic models:

ChatMessage:
- role: Literal["system","user","assistant"]
- content: str

ChatRequest:
- messages: list[ChatMessage]
- max_new_tokens: int = 256
- temperature: float = 0.9
- top_k: int | None = 50
- seed: int = 42
- trace_layer: int  # required; 0 <= < cfg.L

FullAttnRequest:
- messages: list[ChatMessage]
- trace_layer: int
- head: int
- seed: int = 42  # only affects sampling if generation is involved; here it's for consistency
- max_new_tokens: int = 0  # default: no generation, inspect prompt only

ErrorResponse:
- error: str
- code: str

## prompt handling rules (must match your model training)
- format transcript using niels_gpt.chat_format.format_chat(messages)
- that output must end with "assistant: "
- compute prompt_bytes = transcript.encode("utf-8")
- if len(prompt_bytes) > MAX_PROMPT_BYTES:
  - return JSON 413 with ErrorResponse(code="prompt_too_large")

## generation + traces (api/app/generation.py)
implement a streaming generator function:

stream_chat_events(
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
) -> Iterator[dict]

behavior:
1) build transcript = format_chat(messages)
2) encode prompt -> prompt_ids (cpu int64)
3) enforce trace_layer bounds (0..cfg.L-1) else 422 json error
4) implement autoregressive loop for up to max_new_tokens:
   - crop context to last cfg.T tokens before each forward
   - call model.forward_with_attn_trace(ctx[None,:].to(device), trace_layer=trace_layer, return_full_attn=False)
     returns logits (1,t,V) and trace dict with attn_row (1,H,t)
   - take logits_last = logits[0,-1] (V,)
   - compute sampling distribution:
       if temperature == 0: greedy argmax
       else:
         scaled = logits_last / temperature
         if top_k is not None: keep top_k largest logits (exactly top_k survivors)
         probs = softmax(scaled)
   - compute:
       - entropy = -sum(probs * log(probs+1e-12))
       - top10 = topk(probs, k=10)
   - sample next token using torch.multinomial on CPU with torch.Generator(device="cpu") seeded with `seed`
     (same approach as your local generate.py)
   - append next token id to ids (keep ids on cpu)
   - stop sequences:
       stop if generated bytes contain b"\nuser: " or b"\nsystem: " beginning at/after the prompt boundary.
       truncate before the stop tag (do not include it).
   - emit per step two events:
       {"event":"token", "data": {...}}
       {"event":"trace", "data": {...}}
     where:
       token data:
         step, token_id, token_text
         token_text must be obtained by decoding the single byte id robustly (use tokenizer.decode on a 1-token tensor)
       trace data:
         step,
         entropy,
         topk: [{token_id, token_text, prob}] (prob float),
         attn: attention row for last token from traced layer: shape (H, t) serialized to nested python lists
         (attn must correspond to the current step’s context length)
5) after loop or stop:
   - decode full transcript+completion text
   - reply = extract_assistant_reply(decoded_text)
   - emit {"event":"done","data":{"reply": reply}}

## sse wiring (api/app/sse.py + route)
- implement SSE formatting helper:
  - yield strings like:
    event: token
    data: {...json...}

- route: POST /chat/stream
  - if prompt too large or rate-limited: return JSON error (not SSE)
  - else return StreamingResponse with media_type="text/event-stream"

## full attention endpoint (on-demand)
route: POST /inspect/full_attn
- build transcript from messages
- encode prompt ids
- ctx = last cfg.T tokens
- call model.forward_with_attn_trace(... return_full_attn=True) for selected layer
- extract head matrix:
    attn = attn_full[0, head, :t, :t] -> (t,t)
- return JSON:
  {
    "layer": int,
    "head": int,
    "tokens": [token_text for each position in ctx],  # length t
    "attn": [[...]]  # t x t floats
  }
- validate head bounds 0..cfg.H-1; else 422

NOTE: this endpoint must not stream.

## rate limit (api/app/rate_limit.py)
- implement in-memory token bucket keyed by client ip:
  - capacity = RATE_LIMIT_BURST
  - refill rate = RATE_LIMIT_PER_MIN / 60 tokens per second
- apply per request to /chat/stream and /inspect/full_attn
- if exceeded: return 429 ErrorResponse(code="rate_limited")

ip detection:
- use request.client.host
- (do not implement proxy headers in v0)

## cors
- use fastapi CORSMiddleware
- origins from ALLOWED_ORIGINS env var comma-separated

## tests (api/tests)
tests MUST NOT download or load real checkpoint.

- use create_app(model=dummy, cfg=dummy_cfg) with a dummy model that implements forward_with_attn_trace and returns deterministic logits/attn.

1) test_limits.py
- prompt too large -> 413 json + code prompt_too_large
- rate limit -> 429 json + code rate_limited

2) test_sse_protocol.py
- POST /chat/stream returns 200 and content-type text/event-stream
- consumes first few SSE events and verifies ordering: token then trace then ... then done
- verifies trace contains attn as nested lists and topk length 10

3) test_full_attn.py
- POST /inspect/full_attn returns expected keys and correct matrix shape sizes

## run instructions (api/README.md)
- how to run locally:
  - cd api
  - python -m uvicorn app.main:app --reload --port 8000
- how to curl:
  - curl -N -X POST http://localhost:8000/chat/stream -H "Content-Type: application/json" -d '{...}'
- mention HF_TOKEN optional

## allowed file changes
ADD ONLY under api/ as listed above. do not edit anything outside api/.
