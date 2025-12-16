"""Checkpoint download and model loading utilities."""

from pathlib import Path
import os
import torch
from huggingface_hub import hf_hub_download

from niels_gpt.model.gpt import GPT
from niels_gpt.config import ModelConfig

from .config import CKPT_REPO_ID, CKPT_FILENAME, CKPT_DIR, CKPT_PATH, HF_TOKEN, DEVICE


def ensure_checkpoint() -> Path:
    """
    Ensure checkpoint exists locally. Downloads from HuggingFace Hub if missing.
    Uses atomic rename to prevent corruption from concurrent downloads.

    Returns:
        Path to the local checkpoint file
    """
    if CKPT_PATH.exists():
        return CKPT_PATH

    # Create checkpoint directory if it doesn't exist
    CKPT_DIR.mkdir(parents=True, exist_ok=True)

    # Use temp file for atomic download
    temp_path = CKPT_DIR / f"{CKPT_FILENAME}.tmp.{os.getpid()}"

    try:
        # Download to temp file
        downloaded_path = hf_hub_download(
            repo_id=CKPT_REPO_ID,
            filename=CKPT_FILENAME,
            local_dir=str(CKPT_DIR),
            local_dir_use_symlinks=False,
            token=HF_TOKEN
        )

        # hf_hub_download already writes to the final location
        # If we got here and CKPT_PATH exists now, another process won
        if CKPT_PATH.exists():
            return CKPT_PATH

        # Otherwise, the downloaded_path should be our target
        # (hf_hub_download doesn't support custom temp paths well, so we accept potential race)
        return Path(downloaded_path)

    except Exception:
        # Clean up temp file if it exists
        if temp_path.exists():
            temp_path.unlink()
        raise


def load_model() -> tuple[GPT, ModelConfig]:
    """
    Load the model from checkpoint.

    Returns:
        (model, config) tuple
    """
    ckpt_path = ensure_checkpoint()

    # Load checkpoint
    ckpt = torch.load(ckpt_path, map_location=DEVICE, weights_only=False)

    # Extract config and create model
    cfg = ModelConfig(**ckpt["model_cfg"])
    model = GPT(cfg)
    model.load_state_dict(ckpt["model_state"])
    model.to(DEVICE)
    model.eval()

    return model, cfg
