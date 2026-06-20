import json
import os
import logging
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from providers.anthropic_provider import AnthropicProvider

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("hooman")

app = FastAPI()

cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.websocket("/ws/chat")
async def chat_ws(websocket: WebSocket):
    await websocket.accept()
    history: list[dict] = []

    try:
        while True:
            raw = await websocket.receive_text()

            try:
                payload = json.loads(raw)
                user_text = payload.get("text", "")
                model = payload.get("model", os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6"))
            except (json.JSONDecodeError, AttributeError):
                user_text = raw
                model = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6")

            if not user_text:
                continue

            history.append({"role": "user", "content": user_text})

            provider = AnthropicProvider({
                "api_key": os.getenv("ANTHROPIC_API_KEY"),
                "model": model,
            })

            full_response = ""
            try:
                async for chunk in provider.generate(history):
                    full_response += chunk
                    await websocket.send_json({"type": "delta", "text": chunk})

                history.append({"role": "assistant", "content": full_response})
                await websocket.send_json({"type": "done"})

            except Exception as e:
                logger.error(f"Generation error: {e}")
                await websocket.send_json({"type": "error", "message": str(e)})

    except Exception as e:
        logger.warning(f"WebSocket closed: {e}")
