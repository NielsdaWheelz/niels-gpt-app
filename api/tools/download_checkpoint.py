#!/usr/bin/env python3
"""
Manual checkpoint download script.

This script downloads and replaces the checkpoint from HuggingFace Hub.
It will always download a fresh copy, removing any existing checkpoint.

Usage:
    python tools/download_checkpoint.py
"""

import sys
from pathlib import Path

# Add parent directory to path so we can import from app
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.checkpoint import ensure_checkpoint
from app.config import CKPT_PATH, CKPT_REPO_ID, CKPT_FILENAME


def main():
    """Download checkpoint, replacing any existing version."""
    print(f"Checkpoint configuration:")
    print(f"  Repository: {CKPT_REPO_ID}")
    print(f"  Filename: {CKPT_FILENAME}")
    print(f"  Target path: {CKPT_PATH}")
    print()

    # Remove existing checkpoint if present
    if CKPT_PATH.exists():
        print(f"Removing existing checkpoint at {CKPT_PATH}")
        CKPT_PATH.unlink()

    print("Downloading checkpoint from HuggingFace Hub...")
    try:
        downloaded_path = ensure_checkpoint()
        print(f"✓ Successfully downloaded checkpoint to {downloaded_path}")
        print(f"  Size: {downloaded_path.stat().st_size / (1024*1024):.1f} MB")
        return 0
    except Exception as e:
        print(f"✗ Error downloading checkpoint: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
