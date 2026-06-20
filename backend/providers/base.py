from abc import ABC, abstractmethod
from typing import AsyncIterator

class BaseProvider(ABC):
    def __init__(self, config: dict):
        self.config = config

    @abstractmethod
    async def generate(self, message: list[dict]) -> AsyncIterator[str]:
        """Generate a response based on the input message."""
        pass