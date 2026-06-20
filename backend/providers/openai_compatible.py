from openai import AsyncOpenAI
from .base import BaseProvider


class OpenAICompatibleProvider(BaseProvider):
    def __init__(self, config: dict):
        super().__init__(config)
        self.client = AsyncOpenAI(
            api_key=config.get("api_key") or "not-needed",  # Ollama ignores this
            base_url=config["base_url"],
        )
        self.model = config["model"]

    async def generate(self, messages: list[dict]):
        stream = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            stream=True,
        )
        async for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta