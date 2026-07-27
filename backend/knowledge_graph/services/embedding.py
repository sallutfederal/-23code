import logging

import httpx

from knowledge_graph.config import settings

logger = logging.getLogger(__name__)

_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(
            base_url=settings.OPENROUTER_BASE_URL,
            headers={
                "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                "HTTP-Referer": "http://localhost:5173",
                "X-Title": "23code-knowledge-graph",
            },
            timeout=30.0,
        )
    return _client


async def generate_embedding(text: str) -> list[float]:
    """
    Gera embedding via OpenRouter API (formato OpenAI compatível).

    Modelo: openai/text-embedding-3-small (1536 dims)
    Custo: ~$0.02/1M tokens
    """
    client = _get_client()

    response = await client.post(
        "/embeddings",
        json={
            "model": settings.EMBEDDING_MODEL,
            "input": text,
        },
    )
    response.raise_for_status()

    data = response.json()
    embedding = data["data"][0]["embedding"]

    logger.info(
        "EMBEDDING_GENERATED | model=%s | dims=%d | input_chars=%d",
        settings.EMBEDDING_MODEL,
        len(embedding),
        len(text),
    )
    return embedding


async def generate_embeddings_batch(texts: list[str]) -> list[list[float]]:
    """Gera embeddings pra múltiplos textos de uma vez."""
    client = _get_client()

    response = await client.post(
        "/embeddings",
        json={
            "model": settings.EMBEDDING_MODEL,
            "input": texts,
        },
    )
    response.raise_for_status()

    data = response.json()
    embeddings = [item["embedding"] for item in data["data"]]

    logger.info(
        "EMBEDDING_BATCH | model=%s | count=%d | dims=%d",
        settings.EMBEDDING_MODEL,
        len(texts),
        len(embeddings[0]) if embeddings else 0,
    )
    return embeddings
