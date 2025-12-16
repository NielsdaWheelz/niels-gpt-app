"""FastAPI application factory and routes."""

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from niels_gpt.chat_format import format_chat

from .checkpoint import load_model
from .config import ALLOWED_ORIGINS, MAX_PROMPT_BYTES, DEVICE
from .schemas import ChatRequest, FullAttnRequest, ErrorResponse
from .rate_limit import rate_limiter
from .generation import stream_chat_events, generate_full_attn
from .sse import stream_sse_events


def create_app(*, model=None, cfg=None, load_on_startup: bool = True) -> FastAPI:
    """
    Create FastAPI application.

    Args:
        model: Optional GPT model (for testing). If None, loads on startup.
        cfg: Optional ModelConfig (for testing). If None, loads on startup.
        load_on_startup: If True and model/cfg are None, load during startup event.
                        If False, load immediately (for backwards compat).

    Returns:
        FastAPI application instance
    """
    # Define lifespan for model loading
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        # Startup: load model if needed
        if not app.state.model_ready and load_on_startup:
            _model, _cfg = load_model()
            app.state.model = _model
            app.state.cfg = _cfg
            app.state.model_ready = True
        yield
        # Shutdown: cleanup if needed
        pass

    app = FastAPI(title="niels-gpt Inference API", lifespan=lifespan)

    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Store model and config in app state (may be None initially)
    app.state.model = model
    app.state.cfg = cfg
    app.state.model_ready = model is not None and cfg is not None

    @app.get("/health")
    async def health():
        """Health check endpoint."""
        return {"ok": True, "model_ready": app.state.model_ready}

    @app.post("/chat/stream")
    async def chat_stream(request: Request, req: ChatRequest):
        """
        Stream chat completion with SSE.

        Returns SSE stream with token and trace events.
        """
        # Check model ready
        if not app.state.model_ready:
            return JSONResponse(
                status_code=503,
                content=ErrorResponse(
                    error="Model not ready yet, please retry",
                    code="model_loading"
                ).model_dump()
            )

        # Check rate limit
        client_ip = request.client.host
        if not rate_limiter.allow(client_ip):
            return JSONResponse(
                status_code=429,
                content=ErrorResponse(
                    error="Rate limit exceeded",
                    code="rate_limited"
                ).model_dump()
            )

        # Check prompt size
        messages_dict = [msg.model_dump() for msg in req.messages]
        transcript = format_chat(messages_dict)
        prompt_bytes = transcript.encode("utf-8")
        if len(prompt_bytes) > MAX_PROMPT_BYTES:
            return JSONResponse(
                status_code=413,
                content=ErrorResponse(
                    error=f"Prompt too large: {len(prompt_bytes)} bytes (max {MAX_PROMPT_BYTES})",
                    code="prompt_too_large"
                ).model_dump()
            )

        # Validate trace_layer
        if not (0 <= req.trace_layer < app.state.cfg.L):
            raise HTTPException(
                status_code=422,
                detail=f"trace_layer must be in [0, {app.state.cfg.L - 1}]"
            )

        # Generate events
        try:
            events = stream_chat_events(
                model=app.state.model,
                cfg=app.state.cfg,
                messages=messages_dict,
                max_new_tokens=req.max_new_tokens,
                temperature=req.temperature,
                top_k=req.top_k,
                seed=req.seed,
                trace_layer=req.trace_layer,
                device=DEVICE,
            )

            # Stream as SSE with proper headers
            return StreamingResponse(
                stream_sse_events(events),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "X-Accel-Buffering": "no",
                    "Connection": "keep-alive",
                },
            )
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e))

    @app.post("/inspect/full_attn")
    async def inspect_full_attn(request: Request, req: FullAttnRequest):
        """
        Get full attention matrix for a given layer and head.

        Returns JSON with tokens and attention matrix.
        """
        # Check model ready
        if not app.state.model_ready:
            return JSONResponse(
                status_code=503,
                content=ErrorResponse(
                    error="Model not ready yet, please retry",
                    code="model_loading"
                ).model_dump()
            )

        # Check rate limit
        client_ip = request.client.host
        if not rate_limiter.allow(client_ip):
            return JSONResponse(
                status_code=429,
                content=ErrorResponse(
                    error="Rate limit exceeded",
                    code="rate_limited"
                ).model_dump()
            )

        # Check prompt size
        messages_dict = [msg.model_dump() for msg in req.messages]
        transcript = format_chat(messages_dict)
        prompt_bytes = transcript.encode("utf-8")
        if len(prompt_bytes) > MAX_PROMPT_BYTES:
            return JSONResponse(
                status_code=413,
                content=ErrorResponse(
                    error=f"Prompt too large: {len(prompt_bytes)} bytes (max {MAX_PROMPT_BYTES})",
                    code="prompt_too_large"
                ).model_dump()
            )

        # Generate full attention
        try:
            result = generate_full_attn(
                model=app.state.model,
                cfg=app.state.cfg,
                messages=messages_dict,
                trace_layer=req.trace_layer,
                head=req.head,
                device=DEVICE,
            )
            return result
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e))

    return app


# Module-level app for production (deferred model loading)
app = create_app(load_on_startup=True)
