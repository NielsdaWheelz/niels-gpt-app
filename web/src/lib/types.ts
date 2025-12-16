// Message types for chat history
export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

// Request payload for POST /chat/stream
export interface ChatStreamRequest {
  messages: Message[];
  max_new_tokens: number;
  temperature: number;
  top_k: number;
  seed: number;
  trace_layer: number;
}

// SSE event types from backend
export interface TokenEvent {
  step: number;
  token_id: number;
  token_text: string;
  token_display: string;
}

export interface TopKCandidate {
  token_id: number;
  token_text: string;
  token_display: string;
  prob: number;
}

export interface TraceEvent {
  step: number;
  entropy: number;
  topk: TopKCandidate[];
  attn: number[][]; // H x t (heads x sequence length)
}

export interface DoneEvent {
  reply: string;
}

// Combined step data for visualization
export interface StepData {
  step: number;
  token_id: number;
  token_text: string;
  token_display: string;
  entropy: number;
  topk: TopKCandidate[];
  attn: number[][]; // H x t
}

// SSE event wrapper
export interface SSEEvent {
  event: string;
  data: any;
}

// Error response types
export interface ErrorResponse {
  error: string;
  code: "prompt_too_large" | "rate_limited" | string;
}

// Full attention request/response
export interface FullAttentionRequest {
  messages: Message[];
  trace_layer: number;
  head: number;
}

export interface FullAttentionResponse {
  layer: number;
  head: number;
  token_ids: number[];
  tokens_display: string[];
  attn: number[][]; // t x t
}
