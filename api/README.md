# niels-gpt Inference API

FastAPI backend for streaming chat inference with attention visualization.

## Features

- Server-Sent Events (SSE) streaming for real-time token generation
- Per-step attention traces with entropy and top-k probabilities
- Full attention matrix inspection for selected layers and heads
- Prompt size limits (16KB) and rate limiting (10 req/min/ip)
- CORS support for web frontends
- Automatic checkpoint download from HuggingFace Hub

## Installation

```bash
cd api
pip install -r requirements.txt
```

## Running Locally

Start the server with uvicorn:

```bash
cd api
python -m uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`.

Visit `http://localhost:8000/docs` for interactive API documentation.

## Environment Variables

Configure the API using these environment variables:

- `API_HOST` - Host to bind to (default: `0.0.0.0`)
- `API_PORT` - Port to listen on (default: `8000`)
- `DEVICE` - PyTorch device: `cpu` or `mps` (default: `cpu`)
- `CKPT_REPO_ID` - HuggingFace repo ID (default: `nnandal/niels-gpt`)
- `CKPT_FILENAME` - Checkpoint filename (default: `best.pt`)
- `CKPT_DIR` - Local checkpoint directory (default: `./checkpoints`)
- `MAX_PROMPT_BYTES` - Max prompt size in bytes (default: `16384`)
- `RATE_LIMIT_PER_MIN` - Requests per minute per IP (default: `10`)
- `RATE_LIMIT_BURST` - Burst capacity (default: `3`)
- `ALLOWED_ORIGINS` - Comma-separated CORS origins (default: `https://nielseriknandal.com,http://localhost:3000,http://localhost:5173`)
- `HF_TOKEN` - HuggingFace API token (optional, for private repos)

## API Endpoints

### Health Check

```bash
curl http://localhost:8000/health
```

### Stream Chat Completion

Stream a chat completion with SSE:

```bash
curl -N -X POST http://localhost:8000/chat/stream \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "tell me about niels"}
    ],
    "max_new_tokens": 100,
    "temperature": 0.9,
    "top_k": 50,
    "seed": 42,
    "trace_layer": 3
  }'
```

**Request Body:**
- `messages` - List of chat messages with `role` and `content`
- `max_new_tokens` - Maximum tokens to generate (default: 256)
- `temperature` - Sampling temperature (default: 0.9)
- `top_k` - Top-k filtering (default: 50)
- `seed` - Random seed for reproducibility (default: 42)
- `trace_layer` - Layer index to trace (0 to L-1)

**Response Events:**

The endpoint streams SSE events in this order:

1. **token** - Generated token
   ```json
   {"step": 0, "token_id": 72, "token_text": "H"}
   ```

2. **trace** - Attention trace for the token
   ```json
   {
     "step": 0,
     "entropy": 2.45,
     "topk": [
       {"token_id": 72, "token_text": "H", "prob": 0.85},
       ...
     ],
     "attn": [[0.1, 0.2, ...], ...]
   }
   ```

3. **done** - Final reply (sent once at end)
   ```json
   {"reply": "niels is..."}
   ```

### Inspect Full Attention

Get the full attention matrix for a specific layer and head:

```bash
curl -X POST http://localhost:8000/inspect/full_attn \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "hello"}
    ],
    "trace_layer": 3,
    "head": 0
  }'
```

**Request Body:**
- `messages` - Chat messages
- `trace_layer` - Layer index (0 to L-1)
- `head` - Head index (0 to H-1)
- `seed` - Random seed (default: 42)
- `max_new_tokens` - Tokens to generate before inspection (default: 0)

**Response:**
```json
{
  "layer": 3,
  "head": 0,
  "tokens": ["h", "e", "l", "l", "o"],
  "attn": [
    [1.0, 0.0, 0.0, 0.0, 0.0],
    [0.5, 0.5, 0.0, 0.0, 0.0],
    ...
  ]
}
```

## Error Responses

### 413 Prompt Too Large

```json
{
  "error": "Prompt too large: 20000 bytes (max 16384)",
  "code": "prompt_too_large"
}
```

### 429 Rate Limited

```json
{
  "error": "Rate limit exceeded",
  "code": "rate_limited"
}
```

### 422 Validation Error

```json
{
  "detail": "trace_layer must be in [0, 3]"
}
```

## Testing

Run the test suite:

```bash
cd api
pytest
```

Tests use a dummy model and do not download real checkpoints.

## Architecture

- `app/main.py` - FastAPI app factory and routes
- `app/config.py` - Environment configuration
- `app/checkpoint.py` - Checkpoint download and loading
- `app/schemas.py` - Pydantic request/response models
- `app/generation.py` - Token generation and attention tracing
- `app/rate_limit.py` - Token bucket rate limiter
- `app/sse.py` - Server-Sent Events formatting
- `tests/` - Test suite with dummy model

## Deployment

The API is designed to run on CPU (e.g., Render free tier). For local development on Apple Silicon, set `DEVICE=mps` to use the Metal Performance Shaders backend.

**Production checklist:**
- Set `HF_TOKEN` if using a private checkpoint repo
- Configure `ALLOWED_ORIGINS` for your frontend domain
- Adjust rate limits if needed
- Ensure checkpoint directory is writable
