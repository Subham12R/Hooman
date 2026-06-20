from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_headers=["*"],
    allow_methods=["*"],
)

@app.get("/")
def read_root():
    return {"message": "server is running"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}

@app.websocket("/ws")
async def chat_ws(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_text(f"Message received: {data}")
    except Exception as e:
        print(f"WebSocket connection closed: {e}")
    finally:
        await websocket.close()
        