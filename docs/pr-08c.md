# PR-08c: next.js demo UI (chat + attention spotlight + streaming)

repo: niels-gpt-app
scope: web only (do not modify api/)

## goal
build a next.js web app that:
- provides a chat UI that streams responses from POST /chat/stream (SSE)
- shows a “generation inspector” that feels magical but is grounded:
  - attention spotlight over prior tokens for a selected head
  - top-k “bubble” candidates per step (not bar charts)
  - a simple confidence glow driven by entropy
  - replay controls (scrub steps after generation)
- supports:
  - layer dropdown (sent in request as trace_layer)
  - head dropdown (client-side selection from streamed attn heads)
  - on-demand full attention matrix toggle via POST /inspect/full_attn

## non-goals
- no auth, no db, no styling framework wars
- no embeddings, no RAG
- no “explain like i’m five” text walls in the UI
- no additional backend endpoints

## fixed backend contract (already implemented)
Environment:
- NEXT_PUBLIC_API_BASE_URL points to API base
Endpoints:
- POST {base}/chat/stream -> SSE stream
- POST {base}/inspect/full_attn -> JSON
- GET  {base}/health -> JSON (optional use)

SSE events:
- event: token
  data: {step, token_id, token_text, token_display}
- event: trace
  data: {step, entropy, topk:[{token_id, token_text, token_display, prob} x10], attn: H x t float list}
- event: done
  data: {reply}

Error responses (JSON, not SSE):
- 413: {error, code:"prompt_too_large"}
- 429: {error, code:"rate_limited"}

Full attn endpoint:
request: {messages, trace_layer, head}
response: {layer, head, token_ids, tokens_display, attn} where attn is t x t

## UI layout
single page app at `/` with split layout:

RIGHT PANE (chat):
- chat history list
- text input (enter to send, shift+enter newline)
- send button
- stop button while streaming
- error toast / inline error for 413/429/other

LEFT PANE (inspector):
A) controls row:
- layer dropdown: 0..3 (hardcode 4 layers)
- head dropdown: 0..3 (derived from trace attn length, default 0)
- toggle: “full matrix” (opens modal)
- replay controls:
  - live indicator while streaming
  - slider from step 0..last_step after generation
  - play/pause button that animates slider forward

B) “token stream” view (the money shot):
- render the assistant completion as a sequence of token spans
- when a step is selected (live or replay):
  - highlight previous tokens according to attention weights for selected head
  - show a pulse animation on the most-attended few tokens
- show current token (just produced) with a subtle outline

C) “top-k bubbles”:
- show 10 candidate bubbles for the selected step:
  - display token_display + prob
  - the chosen token “pops” (scale animation)
- keep this minimal; it should feel alive, not analytical.

D) confidence glow:
- compute a scalar from entropy for the selected step
- apply as subtle glow/blur intensity on the inspector card

## interaction model
- user types message -> client sends POST /chat/stream with:
  {messages, max_new_tokens, temperature, top_k, seed, trace_layer}
- client parses SSE stream from a POST request (manual reader; EventSource cannot POST)
- client builds:
  - assistant_text (concatenate token_text)
  - steps[] with:
    {step, token_id, token_text, token_display, entropy, topk[], attn}
- after done:
  - append assistant reply to chat history
  - keep steps for replay

Layer/head semantics:
- changing trace_layer only affects the next request
- changing head updates the visualization instantly from stored attn rows

Full matrix toggle:
- when clicked:
  - call POST /inspect/full_attn with current chat messages, trace_layer, head
  - display modal with:
    - a canvas heatmap of attn (t x t)
    - tokens_display on top and left (truncate to avoid UI meltdown)
  - close modal button

## implementation constraints
- use next.js App Router
- minimal deps; allowed:
  - framer-motion (for tasteful animations)
  - no chart libs
- style: tailwind (assume next template supports it)
- no server components for logic; keep it simple (client components)

## file structure (must create)
web/
  package.json
  next.config.js (or .mjs)
  tsconfig.json
  postcss.config.js
  tailwind.config.ts
  app/
    layout.tsx
    page.tsx
    globals.css
  src/
    lib/
      api.ts               # API_BASE + request helpers
      sse.ts               # POST+SSE parser
      types.ts             # TS types for events/requests
      entropy.ts           # small helpers
    components/
      ChatPane.tsx
      InspectorPane.tsx
      TokenStream.tsx
      TopKBubbles.tsx
      FullMatrixModal.tsx
      ControlsBar.tsx
      Toast.tsx
  README.md

## acceptance checks (manual)
1) local dev works:
- run API on :8000
- run web on :3000
- send message -> see streaming tokens and attention spotlight
2) head dropdown changes spotlight immediately
3) replay slider scrubs the spotlight and bubbles
4) 413 and 429 show a clear user-facing error
5) full matrix modal renders without freezing (cap max rendered tokens to 128 if needed)

## allowed file changes
ADD/MODIFY: only under web/
DO NOT TOUCH: api/
