"""Utilities for displaying byte-level tokens."""


def token_display(token_id: int) -> str:
    """
    Create human-readable display for a byte token.

    Args:
        token_id: Token ID (0-255 for byte-level tokens)

    Returns:
        Display string:
        - Printable ASCII: the character itself
        - Otherwise: \\xNN hex notation
    """
    if 32 <= token_id <= 126:  # Printable ASCII range
        return chr(token_id)
    else:
        return f"\\x{token_id:02x}"
