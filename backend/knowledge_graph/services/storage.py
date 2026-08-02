import json
import logging
import os
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from knowledge_graph.config import settings

logger = logging.getLogger(__name__)

_file_path: Path | None = None
_lock = threading.Lock()

# --- Data stores (in-memory) ---
_nodes: dict[str, dict] = {}  # id -> node dict (com embedding como list)
_relations: dict[str, dict] = {}  # id -> relation dict
_embeddings_matrix: np.ndarray | None = None  # (N, dims) matriz de embeddings
_embedding_ids: list[str] = []  # ordem dos IDs na matriz


def _get_file_path() -> Path:
    global _file_path
    if _file_path is None:
        data_dir = Path(os.environ.get("APPDATA", Path.home())) / "23code" / "knowledge_graph"
        data_dir.mkdir(parents=True, exist_ok=True)
        _file_path = data_dir / "knowledge_graph.json"
    return _file_path


def _rebuild_index():
    """Reconstrói a matriz numpy de embeddings a partir dos nós em memória."""
    global _embeddings_matrix, _embedding_ids

    ids = []
    vectors = []
    for node_id, node in _nodes.items():
        emb = node.get("embedding")
        if emb:
            ids.append(node_id)
            vectors.append(emb)

    if vectors:
        _embeddings_matrix = np.array(vectors, dtype=np.float32)
        # Normaliza pra cosine similarity via dot product
        norms = np.linalg.norm(_embeddings_matrix, axis=1, keepdims=True)
        norms[norms == 0] = 1
        _embeddings_matrix = _embeddings_matrix / norms
    else:
        _embeddings_matrix = None

    _embedding_ids = ids


def load():
    """Carrega dados do JSON pra memória."""
    with _lock:
        path = _get_file_path()
        if not path.exists():
            logger.info("STORAGE_LOAD | no file found, starting fresh")
            _nodes.clear()
            _relations.clear()
            _rebuild_index()
            return

        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)

            _nodes.clear()
            _relations.clear()

            for n in data.get("nodes", []):
                _nodes[n["id"]] = n

            for r in data.get("relations", []):
                _relations[r["id"]] = r

            _rebuild_index()
            logger.info(
                "STORAGE_LOAD | nodes=%d | relations=%d | file=%s",
                len(_nodes), len(_relations), path,
            )
        except Exception as e:
            logger.error("STORAGE_LOAD_FAILED | error=%s", str(e))


def save():
    """Salva dados da memória pro JSON."""
    with _lock:
        path = _get_file_path()
        data = {
            "nodes": list(_nodes.values()),
            "relations": list(_relations.values()),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        try:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2, default=str)
            logger.info("STORAGE_SAVE | nodes=%d | relations=%d", len(_nodes), len(_relations))
        except Exception as e:
            logger.error("STORAGE_SAVE_FAILED | error=%s", str(e))


# --- Node CRUD ---

def create_node(
    content: str,
    embedding: list[float],
    node_type: str,
    project_id: str,
    metadata: dict | None = None,
) -> dict:
    node_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    node = {
        "id": node_id,
        "content": content,
        "embedding": embedding,
        "node_type": node_type,
        "project_id": project_id,
        "metadata": metadata or {},
        "created_at": now,
        "updated_at": now,
    }

    with _lock:
        _nodes[node_id] = node
        _rebuild_index()

    save()
    logger.info("NODE_CREATED | id=%s | type=%s | project=%s", node_id, node_type, project_id)
    return node


def get_node(node_id: str) -> dict | None:
    return _nodes.get(node_id)


def update_node(node_id: str, content: str, embedding: list[float]) -> dict | None:
    with _lock:
        node = _nodes.get(node_id)
        if not node:
            return None
        node["content"] = content
        node["embedding"] = embedding
        node["updated_at"] = datetime.now(timezone.utc).isoformat()
        _rebuild_index()

    save()
    logger.info("NODE_UPDATED | id=%s", node_id)
    return node


def delete_node(node_id: str) -> bool:
    with _lock:
        if node_id not in _nodes:
            return False
        del _nodes[node_id]
        # Remove relações relacionadas
        to_remove = [
            rid for rid, r in _relations.items()
            if r["source_node_id"] == node_id or r["target_node_id"] == node_id
        ]
        for rid in to_remove:
            del _relations[rid]
        _rebuild_index()

    save()
    logger.info("NODE_DELETED | id=%s", node_id)
    return True


def list_nodes(project_id: str | None = None) -> list[dict]:
    nodes = list(_nodes.values())
    if project_id:
        nodes = [n for n in nodes if n["project_id"] == project_id]
    return nodes


# --- Relation CRUD ---

def create_relation(
    source_id: str,
    target_id: str,
    relation_type: str,
) -> dict | None:
    # Verifica duplicata
    for r in _relations.values():
        if (r["source_node_id"] == source_id
                and r["target_node_id"] == target_id
                and r["relation_type"] == relation_type):
            return r

    rel_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    rel = {
        "id": rel_id,
        "source_node_id": source_id,
        "target_node_id": target_id,
        "relation_type": relation_type,
        "created_at": now,
    }

    with _lock:
        _relations[rel_id] = rel

    save()
    logger.info("RELATION_CREATED | source=%s | target=%s | type=%s", source_id, target_id, relation_type)
    return rel


def get_node_relations(node_id: str) -> tuple[list[dict], list[dict]]:
    """Retorna (outgoing, incoming) relações do nó."""
    outgoing = [r for r in _relations.values() if r["source_node_id"] == node_id]
    incoming = [r for r in _relations.values() if r["target_node_id"] == node_id]
    return outgoing, incoming


# --- Similarity Search ---

def search_similar(
    query_embedding: list[float],
    project_id: str,
    top_k: int = 5,
    threshold: float = 0.75,
) -> list[tuple[dict, float]]:
    """
    Busca por cosine similarity usando numpy.

    Retorna lista de (node, similarity) ordenada por similaridade decrescente.
    """
    if _embeddings_matrix is None or len(_embedding_ids) == 0:
        return []

    query = np.array(query_embedding, dtype=np.float32)
    query_norm = np.linalg.norm(query)
    if query_norm > 0:
        query = query / query_norm

    # Dot product = cosine similarity (já normalizados)
    similarities = _embeddings_matrix @ query

    # Filtra por project_id e threshold
    scored: list[tuple[str, float]] = []
    for i, node_id in enumerate(_embedding_ids):
        node = _nodes.get(node_id)
        if node and node["project_id"] == project_id:
            sim = float(similarities[i])
            if sim >= threshold:
                scored.append((node_id, sim))

    # Ordena por similaridade decrescente
    scored.sort(key=lambda x: x[1], reverse=True)

    results = []
    for node_id, sim in scored[:top_k]:
        results.append((_nodes[node_id], sim))

    logger.info(
        "SIMILARITY_SEARCH | project=%s | top_k=%d | threshold=%.2f | results=%d",
        project_id, top_k, threshold, len(results),
    )
    return results


class _StorageAPI:
    """Wrapper que expõe as funções do storage como métodos de instância."""

    def create_node(self, content, embedding, node_type, project_id, metadata=None):
        return create_node(content, embedding, node_type, project_id, metadata)

    def get_node(self, node_id):
        return get_node(node_id)

    def update_node(self, node_id, content, embedding):
        return update_node(node_id, content, embedding)

    def delete_node(self, node_id):
        return delete_node(node_id)

    def list_nodes(self, project_id=None):
        return list_nodes(project_id)

    def create_relation(self, source_id, target_id, relation_type):
        return create_relation(source_id, target_id, relation_type)

    def get_node_relations(self, node_id):
        return get_node_relations(node_id)

    def search_similar(self, query_embedding, project_id, top_k=5, threshold=0.75):
        return search_similar(query_embedding, project_id, top_k, threshold)

    def get_stats(self):
        return get_stats()


_storage_instance: _StorageAPI | None = None


def get_storage() -> _StorageAPI:
    """Retorna instância singleton do storage."""
    global _storage_instance
    if _storage_instance is None:
        _storage_instance = _StorageAPI()
    return _storage_instance


def get_stats() -> dict:
    """Retorna estatísticas do storage."""
    projects = set(n["project_id"] for n in _nodes.values())
    return {
        "total_nodes": len(_nodes),
        "total_relations": len(_relations),
        "projects": list(projects),
        "embedding_dim": settings.EMBEDDING_DIMENSIONS,
        "file_path": str(_get_file_path()),
    }
