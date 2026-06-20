import anthropic
from .base import BaseProvider


class AnthropicProvider(BaseProvider):
    def __init__(self, config: dict):
        super().__init__(config)
        self.client = anthropic.AsyncAnthropic(api_key=config["api_key"])
        self.model = config["model"]

    async def generate(self, messages: list[dict]):
        async with self.client.messages.stream(
            model=self.model,
            max_tokens=1024,
            messages=messages,
        ) as stream:
            async for text in stream.text_stream:
                yield text