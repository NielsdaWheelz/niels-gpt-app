# niels-gpt-app

Full-stack application for streaming chat inference with attention visualization, powered by a custom byte-level GPT model.

## What This Is

A monorepo containing:
- **api/** - FastAPI backend for streaming chat completions with attention trace visualization
- **web/** - Next.js frontend with real-time token streaming and interactive attention inspector

The model is a small (256-token context, 4-layer) decoder-only transformer trained from scratch on a mix of WikiText and personal corpus data, using byte-level tokenization (vocab size = 256).

## Quick Start

### Local Development

**API:**
```bash
cd api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Web:**
```bash
cd web
npm install
cp .env.local.example .env.local
npm run dev
```

Visit http://localhost:3000 to use the UI.

### Deployment

See [docs/deploy.md](docs/deploy.md) for full deployment instructions (Render + Vercel).

## Environment Configuration

### API Environment Variables

Create `api/.env` (see `api/.env.example` for template):

| Variable | Default | Description |
|----------|---------|-------------|
| `DEVICE` | `cpu` | PyTorch device (`cpu` or `mps`) |
| `CKPT_REPO_ID` | `nnandal/niels-gpt` | HuggingFace repo for checkpoint |
| `CKPT_FILENAME` | `best.pt` | Checkpoint filename |
| `CKPT_DIR` | `checkpoints` | Local checkpoint directory |
| `ALLOWED_ORIGINS` | See example | Comma-separated CORS origins |
| `HF_TOKEN` | - | HuggingFace token (optional) |

**Example CORS origins:**
```
ALLOWED_ORIGINS=https://nielseriknandal.com,https://your-app.vercel.app,http://localhost:3000
```

### Web Environment Variables

Create `web/.env.local`:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

**⚠️ Important:** `NEXT_PUBLIC_*` variables are bundled into the client JavaScript at build time. Changing them in production requires redeploying.

## Features

### API
- Server-Sent Events (SSE) streaming for real-time token generation
- Per-step attention traces with entropy and top-k probabilities
- Full attention matrix inspection
- Prompt size limits (16KB) and rate limiting (10 req/min/ip)
- Automatic checkpoint download from HuggingFace Hub

### Web UI
- Real-time streaming chat interface
- **Render modes:** Toggle between ASCII (shows printable chars) and UTF-8 (shows decoded text)
- Attention visualization with replay controls
- Top-K candidate bubbles
- Confidence glow based on entropy
- Full attention matrix heatmap viewer

## Testing

```bash
# API tests
cd api && pytest

# Web build verification
cd web && npm run build
```

## Documentation

- [Deployment Guide](docs/deploy.md) - Render + Vercel deployment walkthrough
- [PR-08d Spec](docs/pr-08d.md) - Feature specification for render mode toggle
- [Interfaces](docs/interfaces.md) - API contracts and data shapes
- [Charter](docs/charter.md) - Project goals and constraints

## Architecture

**API (`api/`)**
- `app/main.py` - FastAPI app and routes
- `app/checkpoint.py` - Checkpoint download and loading
- `app/generation.py` - Token generation and attention tracing
- `tools/download_checkpoint.py` - Manual checkpoint prefetch script

**Web (`web/`)**
- `app/page.tsx` - Main page with state management
- `src/lib/sse.ts` - SSE parser for POST requests
- `src/components/` - React components for chat and visualization

## License

See individual license files in subdirectories if present.
