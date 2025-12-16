import {
  ChatStreamRequest,
  FullAttentionRequest,
  FullAttentionResponse,
} from "./types";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

/**
 * Fetch full attention matrix from backend
 */
export async function fetchFullAttention(
  request: FullAttentionRequest
): Promise<FullAttentionResponse> {
  const response = await fetch(`${API_BASE_URL}/inspect/full_attn`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Check API health
 */
export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}
