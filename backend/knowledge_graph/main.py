import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from knowledge_graph.api.nodes import router as nodes_router
from knowledge_graph.services.repo_indexer import router as repo_router
from knowledge_graph.config import settings
from knowledge_graph.services import storage

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Knowledge Graph API",
    description="Grafo de conhecimento de longo prazo para agentes de IA",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(nodes_router)
app.include_router(repo_router)


@app.on_event("startup")
async def startup():
    logger.info("Starting Knowledge Graph API")
    storage.load()
    logger.info("Storage loaded")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "knowledge_graph"}
