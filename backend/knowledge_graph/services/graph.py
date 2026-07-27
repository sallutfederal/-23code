import logging
import uuid

from knowledge_graph.services import storage
from knowledge_graph.schemas import (
    NodeCreate, NodeResponse, RelationResponse,
    NodeWithRelations, SearchResponse, GraphResponse,
)
from knowledge_graph.services.embedding import generate_embedding
from knowledge_graph.config import settings

logger = logging.getLogger(__name__)


def _node_to_response(node: dict, similarity: float | None = None) -> NodeResponse:
    return NodeResponse(
        id=uuid.UUID(node["id"]),
        content=node["content"],
        node_type=node["node_type"],
        project_id=node["project_id"],
        metadata=node.get("metadata", {}),
        created_at=node["created_at"],
        updated_at=node["updated_at"],
        similarity=similarity,
    )


def _relation_to_response(rel: dict) -> RelationResponse:
    return RelationResponse(
        id=uuid.UUID(rel["id"]),
        source_node_id=uuid.UUID(rel["source_node_id"]),
        target_node_id=uuid.UUID(rel["target_node_id"]),
        relation_type=rel["relation_type"],
        created_at=rel["created_at"],
    )


async def create_node(payload: NodeCreate) -> dict:
    """Cria um nó novo no grafo com embedding gerado."""
    embedding = await generate_embedding(payload.content)

    node = storage.create_node(
        content=payload.content,
        embedding=embedding,
        node_type=payload.node_type.value,
        project_id=payload.project_id,
        metadata=payload.metadata,
    )

    # Cria conexões se fornecidas
    relations_created = 0
    if payload.related_node_ids and payload.relation_type:
        for target_id in payload.related_node_ids:
            if str(target_id) == node["id"]:
                continue
            storage.create_relation(
                source_id=node["id"],
                target_id=str(target_id),
                relation_type=payload.relation_type.value,
            )
            relations_created += 1

        logger.info(
            "RELATIONS_CREATED | source=%s | count=%d | type=%s",
            node["id"], relations_created, payload.relation_type.value,
        )

    return node


async def search_similar(
    text_input: str,
    project_id: str,
    top_k: int = 5,
    threshold: float = 0.75,
) -> list[tuple[dict, float]]:
    """Busca por similaridade coseno usando numpy."""
    embedding = await generate_embedding(text_input)

    results = storage.search_similar(
        query_embedding=embedding,
        project_id=project_id,
        top_k=top_k,
        threshold=threshold,
    )

    logger.info(
        "SIMILARITY_SEARCH | project=%s | top_k=%d | threshold=%.2f | results=%d",
        project_id, top_k, threshold, len(results),
    )
    return results


async def get_node_relations(node_id: str) -> tuple[list[dict], list[dict]]:
    """Busca um nó + suas relações (1 hop)."""
    return storage.get_node_relations(node_id)


async def get_full_graph(node_id: str) -> GraphResponse | None:
    """Retorna nó + toda sua vizinhança de conexões."""
    node = storage.get_node(node_id)
    if not node:
        return None

    outgoing_rels, incoming_rels = storage.get_node_relations(node_id)

    outgoing_nodes = []
    for rel in outgoing_rels:
        target_node = storage.get_node(rel["target_node_id"])
        if target_node:
            outgoing_nodes.append(NodeWithRelations(
                node=_node_to_response(target_node),
                relations=[_relation_to_response(rel)],
            ))

    incoming_nodes = []
    for rel in incoming_rels:
        source_node = storage.get_node(rel["source_node_id"])
        if source_node:
            incoming_nodes.append(NodeWithRelations(
                node=_node_to_response(source_node),
                relations=[_relation_to_response(rel)],
            ))

    logger.info(
        "GRAPH_FETCHED | node=%s | outgoing=%d | incoming=%d",
        node_id, len(outgoing_nodes), len(incoming_nodes),
    )

    return GraphResponse(
        node=_node_to_response(node),
        outgoing=outgoing_nodes,
        incoming=incoming_nodes,
    )


async def update_node(node_id: str, content: str) -> dict | None:
    """Atualiza conteúdo e embedding de um nó existente."""
    new_embedding = await generate_embedding(content)
    node = storage.update_node(node_id, content, new_embedding)

    if node:
        logger.info("NODE_UPDATED | id=%s | content_len=%d", node_id, len(content))

    return node


async def create_relation(
    source_id: str,
    target_id: str,
    relation_type: str,
) -> dict | None:
    """Cria uma conexão entre dois nós."""
    rel = storage.create_relation(source_id, target_id, relation_type)

    if rel:
        logger.info(
            "RELATION_CREATED | source=%s | target=%s | type=%s",
            source_id, target_id, relation_type,
        )

    return rel


def _infer_relation_type(similarity: float) -> str:
    """Infere o tipo de relação baseado na similaridade."""
    if similarity > 0.92:
        return "evolui_de"
    elif similarity > 0.85:
        return "implementa"
    else:
        return "relacionado_a"


async def retrieval_pipeline(
    text_input: str,
    project_id: str,
    top_k: int = 5,
    threshold: float = 0.75,
    high_threshold: float = 0.92,
) -> SearchResponse:
    """
    Pipeline completo de retrieval + decisão.

    1. Busca nós similares
    2. Para cada nó, busca relações (1 hop)
    3. Decide: atualizar, conectar, ou criar novo
    """
    results = await search_similar(text_input, project_id, top_k, threshold)

    nodes_with_relations = []
    best_match = results[0] if results else None
    decision = "create_new"
    decision_details = "Nenhum nó similar encontrado acima do threshold."

    if best_match:
        best_node, best_similarity = best_match

        if best_similarity > high_threshold:
            decision = "update_existing"
            decision_details = (
                f"Similaridade alta ({best_similarity:.4f} > {high_threshold}). "
                f"Mesmo assunto — atualizar nó existente {best_node['id']}."
            )
        else:
            decision = "create_connected"
            relation_type = _infer_relation_type(best_similarity)
            decision_details = (
                f"Similaridade média ({best_similarity:.4f}). "
                f"Criar nó novo conectado via {relation_type}."
            )

    # Monta resposta com relações (1 hop)
    for node, similarity in results:
        outgoing, incoming = storage.get_node_relations(node["id"])

        outgoing_nodes = []
        for rel in outgoing:
            target_node = storage.get_node(rel["target_node_id"])
            if target_node:
                outgoing_nodes.append(NodeWithRelations(
                    node=_node_to_response(target_node),
                    relations=[_relation_to_response(rel)],
                ))

        incoming_nodes = []
        for rel in incoming:
            source_node = storage.get_node(rel["source_node_id"])
            if source_node:
                incoming_nodes.append(NodeWithRelations(
                    node=_node_to_response(source_node),
                    relations=[_relation_to_response(rel)],
                ))

        nodes_with_relations.append(NodeWithRelations(
            node=_node_to_response(node, similarity),
            relations=outgoing + incoming,
        ))

    logger.info(
        "PIPELINE_DECISION | project=%s | decision=%s | best_sim=%.4f",
        project_id, decision, best_match[1] if best_match else 0.0,
    )

    return SearchResponse(
        nodes=nodes_with_relations,
        decision=decision,
        decision_details=decision_details,
    )
