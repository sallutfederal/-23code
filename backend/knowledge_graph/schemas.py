from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from knowledge_graph.models import NodeType, RelationType


# --- Request schemas ---

class NodeCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=50000)
    node_type: NodeType
    project_id: str = Field(..., min_length=1, max_length=255)
    metadata: dict = Field(default_factory=dict)
    # Conexões automáticas (opcional) — popula depois do retrieval
    related_node_ids: list[uuid.UUID] = Field(default_factory=list)
    relation_type: Optional[RelationType] = None


class SearchRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=50000)
    project_id: str
    top_k: int = Field(default=5, ge=1, le=50)
    threshold: float = Field(default=0.75, ge=0.0, le=1.0)


class RelationCreate(BaseModel):
    source_node_id: uuid.UUID
    target_node_id: uuid.UUID
    relation_type: RelationType


class PipelineRequest(BaseModel):
    """Entrada completa do pipeline: input do agente + contexto de arquivo."""
    text: str = Field(..., min_length=1, max_length=50000)
    project_id: str
    file_context: Optional[str] = None  # código/arquivo atual em edição
    top_k: int = Field(default=5, ge=1, le=50)
    node_type: NodeType = NodeType.CONTEXTO_PROJETO
    metadata: dict = Field(default_factory=dict)


# --- Response schemas ---

class NodeResponse(BaseModel):
    id: uuid.UUID
    content: str
    node_type: NodeType
    project_id: str
    metadata: dict
    created_at: datetime
    updated_at: datetime
    similarity: Optional[float] = None


class RelationResponse(BaseModel):
    id: uuid.UUID
    source_node_id: uuid.UUID
    target_node_id: uuid.UUID
    relation_type: RelationType
    created_at: datetime


class NodeWithRelations(BaseModel):
    node: NodeResponse
    relations: list[RelationResponse]


class GraphResponse(BaseModel):
    node: NodeResponse
    outgoing: list[NodeWithRelations]
    incoming: list[NodeWithRelations]


class SearchResponse(BaseModel):
    nodes: list[NodeWithRelations]
    decision: str  # "update_existing" | "create_connected" | "create_new"
    decision_details: str


class PipelineResponse(BaseModel):
    retrieved_context: str
    decision: str
    decision_details: str
    node_id: uuid.UUID
    similarity: Optional[float] = None
    relations_created: int = 0
