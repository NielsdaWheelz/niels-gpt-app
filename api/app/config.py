"""Environment configuration for the FastAPI inference backend."""

import os
from pathlib import Path

# Server config
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", "8000"))

# Device config
DEVICE = os.getenv("DEVICE", "cpu")

# Checkpoint config
CKPT_REPO_ID = os.getenv("CKPT_REPO_ID", "nnandal/niels-gpt")
CKPT_FILENAME = os.getenv("CKPT_FILENAME", "best.pt")
CKPT_DIR = Path(os.getenv("CKPT_DIR", "./checkpoints"))
CKPT_PATH = CKPT_DIR / CKPT_FILENAME

# Limits
MAX_PROMPT_BYTES = int(os.getenv("MAX_PROMPT_BYTES", "16384"))
RATE_LIMIT_PER_MIN = int(os.getenv("RATE_LIMIT_PER_MIN", "10"))
RATE_LIMIT_BURST = int(os.getenv("RATE_LIMIT_BURST", "3"))

# CORS
ALLOWED_ORIGINS_STR = os.getenv(
    "ALLOWED_ORIGINS",
    "https://nielseriknandal.com,http://localhost:3000,http://localhost:5173"
)
ALLOWED_ORIGINS = [origin.strip() for origin in ALLOWED_ORIGINS_STR.split(",")]

# HuggingFace auth (optional)
HF_TOKEN = os.getenv("HF_TOKEN", None)
