import logging
import uuid as uuid_mod

from fastapi import APIRouter, HTTPException

from knowledge_graph.schemas import (
    NodeCreate, NodeResponse, RelationCreate, RelationResponse,
    SearchRequest, SearchResponse, GraphResponse, PipelineRequest,
    PipelineResponse, NodeWithRelations,
)
from knowledge_graph.services.graph import (
    create_node, search_similar, get_full_graph,
    create_relation, retrieval_pipeline, update_node,
)
from knowledge_graph.services import storage
from knowledge_graph.models import RelationType

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/nodes", response_model=NodeResponse, status_code=201)
async def create_node_endpoint(payload: NodeCreate):
    """Cria um nó novo no grafo de conhecimento."""
    try:
        node = await create_node(payload)
        return NodeResponse(
            id=uuid_mod.UUID(node["id"]),
            content=node["content"],
            node_type=node["node_type"],
            project_id=node["project_id"],
            metadata=node.get("metadata", {}),
            created_at=node["created_at"],
            updated_at=node["updated_at"],
        )
    except Exception as e:
        logger.error("CREATE_NODE_FAILED | error=%s", str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/nodes/search", response_model=SearchResponse)
async def search_nodes_endpoint(payload: SearchRequest):
    """Busca por similaridade + relações de 1 hop."""
    try:
        response = await retrieval_pipeline(
            text_input=payload.text,
            project_id=payload.project_id,
            top_k=payload.top_k,
            threshold=payload.threshold,
        )
        return response
    except Exception as e:
        logger.error("SEARCH_NODES_FAILED | error=%s", str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/relations", response_model=RelationResponse, status_code=201)
async def create_relation_endpoint(payload: RelationCreate):
    """Cria uma conexão entre dois nós existentes."""
    try:
        rel = await create_relation(
            source_id=str(payload.source_node_id),
            target_id=str(payload.target_node_id),
            relation_type=payload.relation_type.value,
        )
        if not rel:
            raise HTTPException(status_code=400, detail="Relação já existe")

        return RelationResponse(
            id=uuid_mod.UUID(rel["id"]),
            source_node_id=uuid_mod.UUID(rel["source_node_id"]),
            target_node_id=uuid_mod.UUID(rel["target_node_id"]),
            relation_type=rel["relation_type"],
            created_at=rel["created_at"],
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("CREATE_RELATION_FAILED | error=%s", str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/nodes/{node_id}/graph", response_model=GraphResponse)
async def get_node_graph_endpoint(node_id: str):
    """Retorna nó + toda sua vizinhança de conexões (1 hop)."""
    try:
        nid = uuid_mod.UUID(node_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="UUID inválido")

    graph = await get_full_graph(str(nid))
    if not graph:
        raise HTTPException(status_code=404, detail="Nó não encontrado")
    return graph


@router.get("/nodes")
async def list_nodes_endpoint(project_id: str | None = None):
    """Lista todos os nós (opcionalmente filtrado por projeto)."""
    nodes = storage.list_nodes(project_id)
    return {"nodes": nodes, "total": len(nodes)}


@router.get("/stats")
async def stats_endpoint():
    """Estatísticas do knowledge graph."""
    return storage.get_stats()


@router.post("/pipeline", response_model=PipelineResponse)
async def pipeline_endpoint(payload: PipelineRequest):
    """
    Pipeline completo: retrieval → decisão → escrita.

    1. Busca nós similares
    2. Decide: atualizar, conectar, ou criar novo
    3. Escreve no grafo (write-through)
    4. Retorna contexto montado pro prompt
    """
    try:
        # 1. Retrieval
        search_result = await retrieval_pipeline(
            text_input=payload.text,
            project_id=payload.project_id,
            top_k=payload.top_k,
        )

        node_id = None
        similarity = None
        relations_created = 0

        # 2. Decisão + 3. Write-through
        if search_result.decision == "update_existing" and search_result.nodes:
            existing_node = search_result.nodes[0].node
            updated = await update_node(str(existing_node.id), payload.text)
            node_id = uuid_mod.UUID(updated["id"])
            similarity = existing_node.similarity

        elif search_result.decision == "create_connected" and search_result.nodes:
            best_related = search_result.nodes[0].node
            rel_type = "relacionado_a"
            if best_related.similarity and best_related.similarity > 0.85:
                rel_type = "implementa"

            new_node = await create_node(NodeCreate(
                content=payload.text,
                node_type=payload.node_type,
                project_id=payload.project_id,
                metadata=payload.metadata,
                related_node_ids=[best_related.id],
                relation_type=rel_type,
            ))
            node_id = uuid_mod.UUID(new_node["id"])
            similarity = best_related.similarity
            relations_created = 1

        else:
            new_node = await create_node(NodeCreate(
                content=payload.text,
                node_type=payload.node_type,
                project_id=payload.project_id,
                metadata=payload.metadata,
            ))
            node_id = uuid_mod.UUID(new_node["id"])

        # 4. Montagem do contexto pro prompt
        context_parts = []
        for nr in search_result.nodes:
            sim_str = f" (sim: {nr.node.similarity:.2f})" if nr.node.similarity else ""
            context_parts.append(f"[Nó {nr.node.id}]{sim_str} {nr.node.content}")
            for rel in nr.relations:
                context_parts.append(f"  → {rel.relation_type.value}: {rel.target_node_id}")

        if payload.file_context:
            context_parts.append(f"\n[Arquivo atual]\n{payload.file_context}")

        retrieved_context = "\n\n".join(context_parts) if context_parts else "Nenhum contexto recuperado."

        return PipelineResponse(
            retrieved_context=retrieved_context,
            decision=search_result.decision,
            decision_details=search_result.decision_details,
            node_id=node_id,
            similarity=similarity,
            relations_created=relations_created,
        )

    except Exception as e:
        logger.error("PIPELINE_FAILED | error=%s", str(e))
        raise HTTPException(status_code=500, detail=str(e))
