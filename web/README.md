# niels-gpt web UI

Next.js web interface for niels-gpt with streaming chat and attention visualization.

## Features

- Real-time streaming chat interface with SSE
- Attention visualization:
  - Token stream with attention spotlight highlighting
  - Top-K candidate bubbles with probability-based sizing
  - Confidence glow based on entropy
  - Replay controls to scrub through generation steps
- Full attention matrix viewer (heatmap)
- Layer and head selection
- Error handling for rate limiting and prompt size limits

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables:

Create a `.env.local` file in the `web/` directory:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

Or use the default (http://localhost:8000) if the API is running locally.

3. Make sure the API is running on port 8000 (or your configured port):

```bash
# In the api/ directory
python -m api.main
```

## Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Production Build

```bash
npm run build
npm start
```

## Usage

1. Type a message in the chat input on the right pane
2. Press Enter or click Send to submit
3. Watch the streaming response in the chat and the attention visualization on the left
4. Use the controls to:
   - Select different layers (affects next request)
   - Select different heads (updates visualization immediately)
   - Scrub through generation steps with the replay slider
   - Play/pause automatic replay animation
   - View the full attention matrix in a modal

## Architecture

```
web/
├── app/
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Main page with state management
│   └── globals.css         # Global styles
├── src/
│   ├── lib/
│   │   ├── api.ts          # API client helpers
│   │   ├── sse.ts          # SSE parser for POST requests
│   │   ├── types.ts        # TypeScript types
│   │   └── entropy.ts      # Confidence/entropy helpers
│   └── components/
│       ├── ChatPane.tsx           # Chat UI
│       ├── InspectorPane.tsx      # Visualization container
│       ├── ControlsBar.tsx        # Layer/head/replay controls
│       ├── TokenStream.tsx        # Token sequence with attention spotlight
│       ├── TopKBubbles.tsx        # Candidate token bubbles
│       ├── FullMatrixModal.tsx    # Attention heatmap modal
│       └── Toast.tsx              # Error notifications
└── package.json
```

## API Contract

The frontend expects the following endpoints:

- `POST /chat/stream` - SSE stream with token and trace events
- `POST /inspect/full_attn` - Full attention matrix data

See [docs/pr-08c.md](../docs/pr-08c.md) and [docs/interfaces.md](../docs/interfaces.md) for full API specifications.
