# Deployment Guide

This application deploys as a monorepo with separate hosting:
- **API:** Render (using blueprint from `render.yaml`)
- **Web:** Vercel (monorepo with `web/` root directory)

## Deployment Order (IMPORTANT)

**Deploy in this exact order to avoid CORS headaches:**

1. Deploy API to Render first (get API URL)
2. Deploy web to Vercel (using API URL from step 1)
3. Copy Vercel production domain
4. Update `ALLOWED_ORIGINS` in Render dashboard with Vercel domain
5. Restart Render service (or redeploy) for CORS to take effect

If you skip step 4, streaming will appear broken (it's just CORS blocking requests).

---

## Render Deployment (API)

### Initial Setup

1. **Connect Repository**
   - Go to [Render Dashboard](https://dashboard.render.com/)
   - Click "New" → "Blueprint"
   - Connect your GitHub repository
   - Render will detect `render.yaml` and create services automatically

2. **Configure Secrets (Optional)**
   - Navigate to your `niels-gpt-api` service in the dashboard
   - Go to "Environment" tab
   - **Leave `HF_TOKEN` unset unless you hit HuggingFace rate limits**
   - If you need to set it:
     - Get your token from https://huggingface.co/settings/tokens
     - Add it in Render dashboard ONLY (not in code)
     - **Important:** `sync: false` in `render.yaml` means this value is set in the dashboard only, NOT synced from the repo. Committing changes to render.yaml will NOT update this secret.

3. **Note the API URL**
   - After deployment, Render provides a URL like `https://niels-gpt-api.onrender.com`
   - You'll need this for the Vercel deployment

### Blueprint Configuration

The `render.yaml` configures:
- Service: `niels-gpt-api`
- Region: `virginia` (US East)
- Plan: `starter`
- Root directory: `api/`
- Build: `pip install -r requirements.txt`
- Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

### CORS Configuration (CRITICAL)

The `ALLOWED_ORIGINS` environment variable uses exact-match CORS checking. It must include all origins that will call the API:
- `https://nielseriknandal.com` (your personal site)
- Your Vercel **production** domain (e.g., `https://niels-gpt-app.vercel.app`)
- `http://localhost:3000` (for local development)

**⚠️ CORS Workflow (do this AFTER Vercel deployment):**
1. Deploy web to Vercel
2. Copy the production URL from Vercel dashboard
3. Go to Render dashboard → niels-gpt-api → Environment
4. Update `ALLOWED_ORIGINS` to include your Vercel domain
5. **Manually restart the service** or trigger a redeploy

**Symptoms of missing CORS:** Browser console shows CORS errors, streaming appears to hang/fail silently.

### Checkpoint Download Behavior

On first startup (or after a restart without persistent disk), the API will:
1. Check if `checkpoints/best.pt` exists
2. If missing, download from HuggingFace Hub (`nnandal/niels-gpt`)
3. Return 503 with `model_ready: false` during download
4. Return 200 with `model_ready: true` once loaded

**Cold start time:** ~30-60 seconds depending on network speed.

**Optional:** Add a persistent disk in Render to cache the checkpoint across restarts:
- Service Settings → Disks → Add Disk
- Mount path: `/opt/render/project/src/api/checkpoints`
- Size: 1 GB (minimum)

### Health Check

```bash
curl https://niels-gpt-api.onrender.com/health
```

Expected response:
```json
{
  "status": "ok",
  "model_ready": true
}
```

---

## Vercel Deployment (Web)

### Initial Setup

1. **Import Repository**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "Add New" → "Project"
   - Import your GitHub repository

2. **Configure Project**
   - **Root Directory:** `web/`
   - **Framework Preset:** Next.js (auto-detected)
   - **Build Command:** `npm run build` (default)
   - **Output Directory:** `.next` (default)

3. **Add Environment Variable**

   **⚠️ CRITICAL:** `NEXT_PUBLIC_API_BASE_URL` is bundled into the client JavaScript at build time. Changing this variable in Vercel settings requires redeploying to take effect. You cannot change it on-the-fly.

   - Go to Settings → Environment Variables
   - Add:
     ```
     NEXT_PUBLIC_API_BASE_URL=https://niels-gpt-api.onrender.com
     ```
   - Apply to: Production, Preview, and Development

4. **Deploy**
   - Click "Deploy"
   - Note the deployed URL (e.g., `https://niels-gpt-app.vercel.app`)

5. **Update API CORS**
   - Return to Render dashboard
   - Update `ALLOWED_ORIGINS` to include your Vercel URL

---

## Personal Site Integration

To integrate with https://nielseriknandal.com:

1. **Ensure CORS is configured**
   - `ALLOWED_ORIGINS` in Render must include `https://nielseriknandal.com`

2. **Call API directly from your site**
   - Use the Render API URL directly (same as Vercel uses)
   - No iframe needed - direct fetch from client-side JavaScript
   - Use the same SSE streaming protocol as `web/src/lib/sse.ts`

3. **Example integration**
   ```javascript
   const API_BASE_URL = 'https://niels-gpt-api.onrender.com';

   // Stream chat completion
   await streamSSE(
     `${API_BASE_URL}/chat/stream`,
     {
       messages: [{role: "user", content: "hello"}],
       max_new_tokens: 256,
       temperature: 0.9,
       top_k: 50,
       seed: 42,
       trace_layer: 3
     },
     (event) => {
       if (event.event === "token") {
         // Handle token
       } else if (event.event === "trace") {
         // Handle trace
       } else if (event.event === "done") {
         // Handle completion
       }
     }
   );
   ```

---

## Deployment Checklist

### Before deploying:
- [ ] API tests pass: `cd api && pytest`
- [ ] Web builds: `cd web && npm run build`
- [ ] Update `ALLOWED_ORIGINS` placeholder in `render.yaml` with actual domains

### After Render deploy:
- [ ] Health check returns `model_ready: true`
- [ ] Note API URL for Vercel configuration

### After Vercel deploy:
- [ ] Note Vercel URL
- [ ] Update `ALLOWED_ORIGINS` in Render dashboard to include Vercel domain
- [ ] Test API call from Vercel UI (CORS should work)

### For personal site:
- [ ] Add `https://nielseriknandal.com` to `ALLOWED_ORIGINS` in Render
- [ ] Test API call from personal site (CORS should work)

---

## Troubleshooting

### API returns 503 on first request
- Checkpoint is still downloading (check logs in Render dashboard)
- Wait 30-60 seconds and retry
- UI should show "Model loading" toast

### CORS errors in browser console
- Check `ALLOWED_ORIGINS` in Render dashboard includes your frontend domain
- Restart Render service after changing environment variables

### Vercel deployment fails with build error
- Check that `NEXT_PUBLIC_API_BASE_URL` is set in environment variables
- Verify `web/` directory is set as root directory in project settings

### API is slow to respond
- Free tier Render instances spin down after inactivity
- First request after spin-down takes ~30 seconds to wake up
- Consider upgrading to a paid plan to keep instance always-on
