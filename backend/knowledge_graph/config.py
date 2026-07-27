import os
from dataclasses import dataclass


@dataclass
class Settings:
    # --- OpenRouter (mesma API key do chat) ---
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "")
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    EMBEDDING_MODEL: str = "openai/text-embedding-3-small"
    EMBEDDING_DIMENSIONS: int = 1536

    # --- Search thresholds ---
    SIMILARITY_THRESHOLD: float = 0.75  # mínimo pra considerar relevante
    SIMILARITY_HIGH: float = 0.92  # acima disso = mesmo assunto, atualiza nó
    TOP_K: int = 5  # quantos nós retornar na busca

    # --- Context limits ---
    MAX_CONTEXT_TOKENS: int = 4000  # limite de tokens pro contexto recuperado

    # --- Logging ---
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")


settings = Settings()
