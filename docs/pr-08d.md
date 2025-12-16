pr-08d spec: polish + deploy + render-mode toggle

goal

make niels-gpt-app fully runnable end-to-end (local + deployed) with:
	•	a two-track “render mode” toggle in the ui: ascii vs utf-8, without breaking the attention inspector
	•	a render blueprint (render.yaml) that deploys the api in virginia (us-east)  ￼
	•	a single root README that is the canonical setup/deploy walkthrough (api/ and web/ readmes, if kept, should just point to root)
	•	clear dev/prod behavior for checkpoint download (automatic on startup; optional manual prefetch)

non-goals
	•	no auth, no db, no multi-worker rate limit correctness
	•	no hot-reload checkpoint swapping (still “load one at startup”)
	•	no new visualization concept beyond the render-mode toggle + existing inspector

repo shape

single repo with:
	•	api/ (fastapi, downloads ckpt from hf on startup if missing)
	•	web/ (next.js ui)

decisions locked (do not change)
	•	render region: virginia (closest to ny that render offers)  ￼
	•	api called from:
	•	demo ui (web/ on vercel)
	•	personal site https://nielseriknandal.com (no iframe)
	•	api limits:
	•	prompt bytes cap 16384 → 413 json (not sse)
	•	rate limit 10/min/ip, burst 3 → 429 json (not sse)
	•	checkpoint path in deployed api: local cache dir + hf download if missing
	•	env var for web: NEXT_PUBLIC_API_BASE_URL

render-mode toggle requirements

you already have “byte token display” (token_display, \xNN etc). now add a two-track display with a toggle:
	•	mode = ascii
	•	primary: token stream boxes show ascii track
	•	printable ascii (byte 32–126): show char
	•	else: show · (middle dot) as placeholder
	•	on hover/tooltip: show the existing token_display (e.g. \x0a)
	•	secondary: utf-8 decoded track shown but visually deemphasized
	•	mode = utf-8
	•	primary: show a decoded “assistant completion so far” track
	•	computed by concatenating token_text from streamed tokens (not token_display)
	•	displayed in a <pre>/monospace block with wrapping
	•	secondary: ascii token boxes remain visible (so attention viz still makes sense), but deemphasized

constraints:
	•	do not change api payloads to implement this (ui-only)
	•	keep head dropdown client-side; layer dropdown affects requests only (already true)
	•	keep replay working: render mode must apply to replayed step too

dev/prod checkpoint behavior (document + optional helper)
	•	api downloads checkpoint from hf hub automatically when missing (startup hook/lifespan). this is enough for both dev and prod.
	•	add optional manual prefetch script in this repo:
	•	api/tools/download_checkpoint.py that downloads to api/checkpoints/ (or whatever your api already uses)
	•	this is for “i want to download once before running server”, not required for correctness.

render blueprint (render.yaml) requirements
	•	root render.yaml using render’s blueprint spec  ￼
	•	a single web service for api:
	•	rootDir: api for monorepo layout  ￼
	•	env: python
	•	region: virginia  ￼
	•	startCommand must bind to $PORT (render requirement)  ￼
	•	set env vars in blueprint where safe; secrets (HF_TOKEN) should be marked so they aren’t committed in plain text (render supports secret env config in blueprint)  ￼

acceptance checks

local:
	•	api:
	•	cd api && pytest
	•	cd api && uvicorn app.main:app --reload --port 8000 works
	•	web:
	•	cd web && npm run build succeeds
	•	locally, toggle ascii/utf-8 changes rendering without breaking attention highlight
deployed:
	•	render /health returns ok and model_ready: true
	•	vercel ui can chat + stream tokens
	•	full-matrix modal still works
	•	prompt-too-large returns 413 json
	•	rate limited returns 429 json

⸻

walkthrough (human steps)

0) local dev (first run)
	1.	api

cd api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# optional: prefetch checkpoint (otherwise it downloads on first server start)
python tools/download_checkpoint.py
uvicorn app.main:app --reload --port 8000

	2.	web

cd web
npm install
cp .env.local.example .env.local
# set NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
npm run dev

1) render deploy (api)

you’re using a blueprint, so render reads render.yaml directly. render supports regions including virginia; the blueprint spec uses region: virginia and you can’t change it after creation.  ￼

human steps:
	1.	create a new render “blueprint” deploy from your repo (connect github)
	2.	confirm the service is created from render.yaml
	3.	set any secrets in render dashboard (optional):
	•	HF_TOKEN if you hit hf rate limits (otherwise skip)
	4.	after first deploy, copy the render service url (this becomes your api base url)

notes:
	•	render expects the process to bind $PORT, which your start command does.  ￼
	•	checkpoint:
	•	on a cold start, the api will download best.pt from hf if it’s missing. that’s fine for a demo; it just increases cold-start time.

2) vercel deploy (web)

you’re deploying from a monorepo; you set the vercel project’s root directory to web/.  ￼

human steps:
	1.	import the same github repo into vercel
	2.	in project settings:
	•	root directory: web/
	3.	add env var:
	•	NEXT_PUBLIC_API_BASE_URL = https://<your-render-api-host>
	4.	deploy

note: NEXT_PUBLIC_* vars are exposed client-side and typically get bundled at build time, so changing the api url usually means redeploy.  ￼

3) wire personal site (no iframe)

your personal site should just call the render api directly.
	•	set api ALLOWED_ORIGINS to include https://nielseriknandal.com and your vercel demo domain.
	•	in the personal site frontend, set its api base url to the same render url and reuse the same streaming protocol.

4) sanity checklist after deploy
	•	render:
	•	GET /health shows model_ready: true
	•	vercel ui:
	•	can stream tokens (not buffered)
	•	render mode toggle works (ascii vs utf-8)
	•	layer dropdown changes trace layer on the next request
	•	head dropdown changes instantly (client-side)
	•	full matrix button works
