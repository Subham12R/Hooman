import asyncio
import json
import logging
import os
import uuid

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from context_manager import build_context, summarize_overflow
from database import (
    create_provider,
    create_session,
    delete_provider,
    delete_session,
    get_provider_config,
    get_providers,
    get_session,
    get_session_messages,
    get_sessions,
    init_db,
    rename_session,
    save_message,
    update_provider,
)
from providers.registry import get_provider

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("hooman")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event():
    logger.info("Initializing database...")
    init_db()


class CreateSessionRequest(BaseModel):
    id: str
    title: str


class RenameSessionRequest(BaseModel):
    title: str


class ProviderRequest(BaseModel):
    name: str
    provider_type: str
    model: str
    base_url: str = ""
    api_key: str = ""
    is_active: bool = False


@app.get("/api/sessions")
def list_sessions():
    try:
        return get_sessions()
    except Exception as e:
        logger.error(f"Error listing sessions: {e}")
        return {"error": str(e)}


@app.post("/api/sessions")
def api_create_session(req: CreateSessionRequest):
    try:
        create_session(req.id, req.title)
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Error creating session: {e}")
        return {"error": str(e)}


@app.put("/api/sessions/{session_id}")
def api_rename_session(session_id: str, req: RenameSessionRequest):
    try:
        rename_session(session_id, req.title)
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Error renaming session: {e}")
        return {"error": str(e)}


@app.delete("/api/sessions/{session_id}")
def api_delete_session(session_id: str):
    try:
        delete_session(session_id)
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Error deleting session: {e}")
        return {"error": str(e)}


@app.get("/api/sessions/{session_id}/messages")
def list_session_messages(session_id: str):
    try:
        return get_session_messages(session_id)
    except Exception as e:
        logger.error(f"Error loading session messages: {e}")
        return {"error": str(e)}


@app.get("/api/providers")
def api_get_providers():
    try:
        return get_providers()
    except Exception as e:
        logger.error(f"Error loading providers: {e}")
        return {"error": str(e)}


@app.post("/api/providers")
def api_create_provider(req: ProviderRequest):
    try:
        provider_id = str(uuid.uuid4())
        create_provider(provider_id, req.dict())
        return {"status": "ok", "id": provider_id}
    except Exception as e:
        logger.error(f"Error creating provider: {e}")
        return {"error": str(e)}


@app.put("/api/providers/{provider_id}")
def api_update_provider(provider_id: str, req: ProviderRequest):
    try:
        update_provider(provider_id, req.dict())
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Error updating provider: {e}")
        return {"error": str(e)}


@app.delete("/api/providers/{provider_id}")
def api_delete_provider(provider_id: str):
    try:
        delete_provider(provider_id)
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Error deleting provider: {e}")
        return {"error": str(e)}


@app.get("/health")
def health():
    return {"status": "ok"}


def parse_mode(user_text: str):
    if user_text.startswith("[Search:") and user_text.endswith("]"):
        return "research", user_text[8:-1].strip()
    if user_text.startswith("[Canvas:") and user_text.endswith("]"):
        return "agent", user_text[8:-1].strip()
    if user_text.startswith("[Think:") and user_text.endswith("]"):
        return "think", user_text[7:-1].strip()
    return "chat", user_text


def build_system_prompt(mode: str, existing_summary: str):
    system_content = (
        "You are Hooman AI, a helpful desktop assistant.\n\n"
        "STRICT FORMATTING INSTRUCTIONS:\n"
        "- Do not use emojis under any circumstances.\n"
        "- Do not use em dashes under any circumstances.\n"
        "Use clear sections and short paragraphs when the answer is complex."
    )

    if mode == "research":
        system_content += (
            "\n\nRESEARCH MODE:\n"
            "Plan the answer, identify what information is needed, state any limits, "
            "then synthesize a structured result. If you do not have live source access, "
            "say so and separate known facts from assumptions."
        )
    elif mode == "agent":
        system_content += (
            "\n\nAGENT MODE:\n"
            "Break the task into visible steps, do the useful work available in this chat, "
            "and finish with a concise result and next action."
        )
    elif mode == "think":
        system_content += (
            "\n\nDEEP THINK MODE:\n"
            "Reason carefully, but keep private chain-of-thought private. Provide a brief "
            "decision trace with assumptions, approach, and conclusion."
        )

    if existing_summary:
        system_content += f"\n\nSummary of older conversation:\n{existing_summary}"

    return system_content


def workflow_steps(mode: str):
    if mode == "research":
        return [
            "Planning research path",
            "Gathering available context",
            "Checking evidence gaps",
            "Synthesizing structured answer",
        ]
    if mode == "agent":
        return [
            "Understanding request",
            "Choosing next action",
            "Executing available step",
            "Preparing result",
        ]
    if mode == "think":
        return [
            "Parsing the problem",
            "Reviewing conversation context",
            "Weighting tradeoffs",
            "Writing final answer",
        ]
    return [
        "Reading conversation context",
        "Gathering relevant information",
        "Generating response",
    ]


async def run_generation(websocket: WebSocket, payload: dict):
    user_text = payload.get("text", "").strip()
    model = payload.get("model")
    provider_id = payload.get("provider_id")
    session_id = payload.get("session_id") or str(uuid.uuid4())
    request_id = payload.get("request_id") or str(uuid.uuid4())

    if not user_text:
        return

    mode, clean_text = parse_mode(user_text)
    if not get_session(session_id):
        create_session(session_id, "New Chat")

    save_message(str(uuid.uuid4()), session_id, "user", clean_text)
    await websocket.send_json({
        "type": "accepted",
        "session_id": session_id,
        "request_id": request_id,
    })

    db_messages = get_session_messages(session_id)
    session_data = get_session(session_id)
    existing_summary = session_data["summary"] if session_data else ""
    active_messages, overflow_messages = build_context(db_messages, existing_summary)
    provider_config = get_provider_config(provider_id)
    provider = get_provider(model, provider_config)

    steps = workflow_steps(mode)
    for index, step in enumerate(steps):
        await websocket.send_json({
            "type": "workflow",
            "session_id": session_id,
            "request_id": request_id,
            "steps": [
                {
                    "id": f"step-{i}",
                    "text": item,
                    "status": "completed" if i < index else "running" if i == index else "pending",
                }
                for i, item in enumerate(steps)
            ],
        })
        if index < len(steps) - 1:
            await asyncio.sleep(0.15)

    prompt_context = [{"role": "system", "content": build_system_prompt(mode, existing_summary)}] + [
        {"role": m["role"], "content": m["content"]}
        for m in active_messages
    ]

    full_response = ""
    try:
        async for chunk in provider.generate(prompt_context):
            full_response += chunk
            await websocket.send_json({
                "type": "delta",
                "text": chunk,
                "session_id": session_id,
                "request_id": request_id,
            })

        save_message(str(uuid.uuid4()), session_id, "assistant", full_response)
        await websocket.send_json({
            "type": "done",
            "session_id": session_id,
            "request_id": request_id,
            "steps": [
                {"id": f"step-{i}", "text": item, "status": "completed"}
                for i, item in enumerate(steps)
            ],
        })

        if overflow_messages:
            asyncio.create_task(summarize_overflow(session_id, existing_summary, overflow_messages))
    except asyncio.CancelledError:
        await websocket.send_json({
            "type": "stopped",
            "session_id": session_id,
            "request_id": request_id,
        })
        raise
    except Exception as e:
        logger.error(f"Generation error: {e}")
        await websocket.send_json({
            "type": "error",
            "message": str(e),
            "session_id": session_id,
            "request_id": request_id,
        })


@app.websocket("/ws/chat")
async def chat_ws(websocket: WebSocket):
    await websocket.accept()
    tasks: dict[str, asyncio.Task] = {}

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                payload = json.loads(raw)
            except json.JSONDecodeError:
                payload = {"text": raw}

            message_type = payload.get("type", "chat")
            if message_type == "stop":
                request_id = payload.get("request_id")
                task = tasks.get(request_id)
                if task and not task.done():
                    task.cancel()
                continue

            request_id = payload.get("request_id") or str(uuid.uuid4())
            payload["request_id"] = request_id
            task = asyncio.create_task(run_generation(websocket, payload))
            tasks[request_id] = task
            task.add_done_callback(lambda done_task, rid=request_id: tasks.pop(rid, None))
    except WebSocketDisconnect:
        for task in tasks.values():
            task.cancel()
    except Exception as e:
        logger.warning(f"WebSocket closed: {e}")
        for task in tasks.values():
            task.cancel()
