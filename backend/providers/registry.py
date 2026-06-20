import os
from .anthropic_provider import AnthropicProvider
from .openai_compatible import OpenAICompatibleProvider


def get_provider():
    active = os.getenv("ACTIVE_PROVIDER", "anthropic")

    if active == "anthropic":
        return AnthropicProvider({
            "api_key": os.getenv("ANTHROPIC_API_KEY"),
            "model": os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6"),
        })

    if active == "groq":
        return OpenAICompatibleProvider({
            "api_key": os.getenv("GROQ_API_KEY"),
            "base_url": "https://api.groq.com/openai/v1",
            "model": os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
        })

    if active == "ollama":
        return OpenAICompatibleProvider({
            "api_key": "ollama",
            "base_url": os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1"),
            "model": os.getenv("OLLAMA_MODEL", "llama3.1"),
        })

    raise ValueError(f"Unknown provider: {active}")