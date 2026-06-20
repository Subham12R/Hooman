import anthropic
from .base import BaseProvider


class AnthropicProvider(BaseProvider):
    def __init__(self, config: dict):
        super().__init__(config)
        self.client = anthropic.AsyncAnthropic(api_key=config["api_key"])
        self.model = config["model"]

    async def generate(self, messages: list[dict]):
        system_prompt = None
        filtered_messages = []
        for msg in messages:
            if msg["role"] == "system":
                system_prompt = msg["content"]
            else:
                filtered_messages.append({
                    "role": msg["role"],
                    "content": msg["content"]
                })

        kwargs = {
            "model": self.model,
            "max_tokens": 1024,
            "messages": filtered_messages,
        }
        if system_prompt:
            kwargs["system"] = system_prompt

        async with self.client.messages.stream(**kwargs) as stream:
            async for text in stream.text_stream:
                yield text