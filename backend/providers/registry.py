import os
from .anthropic_provider import AnthropicProvider
from .openai_compatible import OpenAICompatibleProvider


def get_provider(model_override: str = None, provider_config: dict | None = None):
    if provider_config:
        provider_type = provider_config["provider_type"]
        if provider_type == "anthropic":
            return AnthropicProvider({
                "api_key": provider_config.get("api_key") or os.getenv("ANTHROPIC_API_KEY"),
                "model": model_override or provider_config["model"],
            })

        if provider_type in ("ollama", "openai_compatible"):
            return OpenAICompatibleProvider({
                "api_key": provider_config.get("api_key") or "not-needed",
                "base_url": provider_config.get("base_url") or "http://localhost:11434/v1",
                "model": model_override or provider_config["model"],
            })

        raise ValueError(f"Unknown provider: {provider_type}")

    active = os.getenv("ACTIVE_PROVIDER", "anthropic")

    if model_override:
        if model_override.startswith("qwen"):
            active = "ollama"
        elif model_override.startswith("claude"):
            active = "anthropic"

    if active == "anthropic":
        return AnthropicProvider({      
            "api_key": os.getenv("ANTHROPIC_API_KEY"),
            "model": model_override or os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6"),
        })

    if active == "groq":
        return OpenAICompatibleProvider({
            "api_key": os.getenv("GROQ_API_KEY"),
            "base_url": "https://api.groq.com/openai/v1",
            "model": model_override or os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
        })

    if active == "ollama":
        return OpenAICompatibleProvider({
            "api_key": "ollama",
            "base_url": os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1"),
            "model": model_override or os.getenv("OLLAMA_MODEL", "qwen3:14b"),
        })

    raise ValueError(f"Unknown provider: {active}")
