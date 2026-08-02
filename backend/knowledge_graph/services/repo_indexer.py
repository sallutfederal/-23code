"""
repo_indexer.py — Indexador principal de codebase.
 
Recebe o repo_map escaneado pelo Node.js, gera embeddings,
e salva nós no knowledge graph.
 
Endpoints:
- POST /repo/index — Indexa projeto completo
- POST /repo/reindex-file — Reindexa arquivo individual
- DELETE /repo/file — Remove arquivo do índice
- GET /repo/map/{project_id} — Retorna repo map cacheado
"""
 
import os
import json
import time
import logging
from typing import Optional
from pathlib import Path
 
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
 
from .storage import get_storage
from .embedding import generate_embedding
 
logger = logging.getLogger(__name__)
router = APIRouter()

# --- Blocklist de arquivos sensíveis (defense-in-depth, espelha repo_scanner.js) ---
import re
SENSITIVE_FILE_PATTERNS = [
    re.compile(r'^\.env$', re.IGNORECASE),
    re.compile(r'^\.env\.', re.IGNORECASE),
    re.compile(r'\.pem$', re.IGNORECASE),
    re.compile(r'\.key$', re.IGNORECASE),
    re.compile(r'\.p12$', re.IGNORECASE),
    re.compile(r'\.pfx$', re.IGNORECASE),
    re.compile(r'^id_rsa', re.IGNORECASE),
    re.compile(r'^id_ed25519', re.IGNORECASE),
    re.compile(r'^id_dsa', re.IGNORECASE),
    re.compile(r'^id_ecdsa', re.IGNORECASE),
    re.compile(r'credentials\.json$', re.IGNORECASE),
    re.compile(r'service.*account.*\.json$', re.IGNORECASE),
    re.compile(r'\.npmrc$', re.IGNORECASE),
    re.compile(r'\.pypirc$', re.IGNORECASE),
    re.compile(r'htpasswd', re.IGNORECASE),
    re.compile(r'\.secret$', re.IGNORECASE),
    re.compile(r'\.secrets$', re.IGNORECASE),
]

def _is_sensitive_file(file_path: str) -> bool:
    """Verifica se arquivo é sensível (nunca deve ter conteúdo enviado para embedding)."""
    basename = os.path.basename(file_path)
    return any(p.search(basename) for p in SENSITIVE_FILE_PATTERNS)
 
# Configurações
REPO_MAP_CACHE_DIR = Path(os.environ.get(
    'APPDATA', 
    os.path.expanduser('~/.config')
)) / '23code' / 'repo_maps'
 
# Thresholds
SMALL_FILE_MAX_SIZE = 8 * 1024  # 8KB
 
 
class FileData(BaseModel):
    """Dados de um arquivo escaneado."""
    path: str
    relativePath: Optional[str] = None
    size: int = 0
    extension: str = ''
    category: str = 'other'  # code, large_code, binary, config, lockfile, other
    content: Optional[str] = None
    signatures: list = Field(default_factory=list)
 
 
class RepoIndexRequest(BaseModel):
    """Request para indexação completa."""
    project_id: str
    project_path: str
    repo_map: dict  # Repo map completo do scanner
 
 
class FileReindexRequest(BaseModel):
    """Request para reindexação de arquivo individual."""
    project_id: str
    project_path: str
    file: FileData
 
 
class FileDeleteRequest(BaseModel):
    """Request para remoção de arquivo."""
    project_id: str
    file_path: str
 
 
def _get_cache_path(project_id: str) -> Path:
    """Retorna caminho do cache do repo map."""
    REPO_MAP_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    return REPO_MAP_CACHE_DIR / f"{project_id}.json"
 
 
def _save_repo_map_cache(project_id: str, repo_map: dict) -> None:
    """Salva repo map em cache local."""
    cache_path = _get_cache_path(project_id)
    try:
        with open(cache_path, 'w', encoding='utf-8') as f:
            json.dump(repo_map, f, ensure_ascii=False, indent=2)
        logger.info(f"Repo map cached: {cache_path}")
    except Exception as err:
        logger.error(f"Erro ao salvar cache: {err}")
 
 
def _load_repo_map_cache(project_id: str) -> Optional[dict]:
    """Carrega repo map do cache."""
    cache_path = _get_cache_path(project_id)
    try:
        with open(cache_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return None
    except Exception as err:
        logger.error(f"Erro ao carregar cache: {err}")
        return None
 
 
def _delete_repo_map_cache(project_id: str) -> None:
    """Remove repo map do cache."""
    cache_path = _get_cache_path(project_id)
    try:
        cache_path.unlink(missing_ok=True)
    except Exception as err:
        logger.error(f"Erro ao remover cache: {err}")
 
 
def _truncate_repo_map(repo_map: dict, max_tokens: int = 8000) -> dict:
    """
    Trunca repo map para caber no limite de tokens.
    
    Prioridade:
    1. Arquivos na raiz primeiro
    2. Pastas mais rasas primeiro
    3. Arquivos menores primeiro (dentro da mesma profundidade)
    """
    files = repo_map.get('files', [])
    
    # Estimativa: ~4 chars por token
    max_chars = max_tokens * 4
    
    # Ordenar por profundidade (raiz primeiro) e tamanho
    def sort_key(f):
        depth = f.get('relativePath', '').count('/')
        size = f.get('size', 0)
        return (depth, size)
    
    sorted_files = sorted(files, key=sort_key)
    
    selected_files = []
    current_chars = 0
    
    for f in sorted_files:
        # Estimar tamanho da entrada
        entry_size = len(json.dumps(f, ensure_ascii=False))
        
        if current_chars + entry_size > max_chars:
            # Tentar incluir só assinaturas (sem conteúdo)
            if f.get('content'):
                f_truncated = {**f, 'content': f"[TRUNCADO - {f['size']} bytes]"}
                entry_size = len(json.dumps(f_truncated, ensure_ascii=False))
                
                if current_chars + entry_size <= max_chars:
                    selected_files.append(f_truncated)
                    current_chars += entry_size
            # Pular arquivo se não caber
            continue
        
        selected_files.append(f)
        current_chars += entry_size
    
    omitted_count = len(files) - len(selected_files)
    
    return {
        **repo_map,
        'files': selected_files,
        'truncated': omitted_count > 0,
        'omittedFiles': omitted_count,
        'estimatedTokens': current_chars // 4
    }
 
 
@router.post("/repo/index")
async def index_project(request: RepoIndexRequest):
    """
    Indexa projeto completo no knowledge graph.
    
    1. Salva repo map em cache
    2. Gera embeddings para cada arquivo
    3. Cria nós no knowledge graph
    """
    start_time = time.time()
    storage = get_storage()
    
    project_id = request.project_id
    repo_map = request.repo_map
    files = repo_map.get('files', [])
    
    nodes_created = 0
    embeddings_generated = 0
    errors = []
    
    logger.info(f"Iniciando indexação do projeto {project_id}: {len(files)} arquivos")
    
    for file_data in files:
        try:
            # Pular binários e lockfiles
            if file_data.get('category') in ('binary', 'lockfile'):
                continue
            
            file_path = file_data.get('path', '')
            relative_path = file_data.get('relativePath', file_path)

            # Blocklist: arquivo sensível → listado mas conteúdo NUNCA enviado
            if _is_sensitive_file(file_path):
                logger.info(f"SENSITIVE_FILE_SKIP | {relative_path} | conteúdo não indexado")
                continue
            
            # Determinar conteúdo para embedding
            content_for_embedding = None
            
            if file_data.get('content'):
                # Arquivo pequeno: conteúdo completo
                content_for_embedding = file_data['content']
            elif file_data.get('signatures'):
                # Arquivo grande: só assinaturas
                sig_text = "\n".join([
                    f"{s.get('type', 'unknown')} {s.get('name', 'unknown')}({', '.join(s.get('params', []))})"
                    for s in file_data['signatures']
                ])
                content_for_embedding = f"Signatures:\n{sig_text}"
            
            if not content_for_embedding:
                continue
            
            # Gerar embedding
            try:
                embedding = await generate_embedding(content_for_embedding)
                embeddings_generated += 1
            except Exception as err:
                logger.warning(f"Erro ao gerar embedding para {relative_path}: {err}")
                embedding = None
            
            # Criar nó no knowledge graph
            node_data = {
                'content': content_for_embedding[:2000],  # Limitar tamanho
                'node_type': 'estrutura_arquivo',
                'project_id': project_id,
                'metadata': {
                    'type': 'file_structure',
                    'path': file_path,
                    'relative_path': relative_path,
                    'extension': file_data.get('extension', ''),
                    'category': file_data.get('category', ''),
                    'size': file_data.get('size', 0),
                    'has_signatures': bool(file_data.get('signatures'))
                }
            }
            
            # Usar path como ID único para evitar duplicatas
            node_id = f"{project_id}:{relative_path}"
            
            # Verificar se nó já existe
            existing = storage.get_node(node_id)
            if existing:
                # Atualizar existente
                storage.update_node(node_id, node_data)
            else:
                # Criar novo
                storage.create_node(node_id, node_data)
            
            nodes_created += 1
            
        except Exception as err:
            errors.append({
                'file': file_data.get('path', 'unknown'),
                'error': str(err)
            })
            logger.error(f"Erro ao indexar arquivo: {err}")
    
    # Salvar cache
    _save_repo_map_cache(project_id, repo_map)
    
    elapsed_ms = int((time.time() - start_time) * 1000)
    
    logger.info(
        f"Indexação concluída: {nodes_created} nós, "
        f"{embeddings_generated} embeddings em {elapsed_ms}ms"
    )
    
    return {
        'success': True,
        'data': {
            'nodes_created': nodes_created,
            'embeddings_generated': embeddings_generated,
            'errors': errors,
            'time_ms': elapsed_ms
        }
    }
 
 
@router.post("/repo/reindex-file")
async def reindex_file(request: FileReindexRequest):
    """
    Reindexa um arquivo individual (após create/edit).
    
    Atualiza ou cria nó no knowledge graph.
    """
    storage = get_storage()
    
    project_id = request.project_id
    file_data = request.file
    
    relative_path = file_data.relativePath or file_data.path
    node_id = f"{project_id}:{relative_path}"
    
    logger.info(f"Reindexando arquivo: {relative_path}")

    # Blocklist: arquivo sensível → conteúdo NUNCA enviado para embedding
    actual_path = file_data.path or ''
    if _is_sensitive_file(actual_path):
        logger.info(f"SENSITIVE_FILE_SKIP | {relative_path} | reindex negado")
        return {'success': False, 'error': f'Arquivo sensível bloqueado: {os.path.basename(actual_path)}'}
    
    # Determinar conteúdo para embedding
    content_for_embedding = None
    
    if file_data.content:
        content_for_embedding = file_data.content
    elif file_data.signatures:
        sig_text = "\n".join([
            f"{s.get('type', 'unknown')} {s.get('name', 'unknown')}({', '.join(s.get('params', []))})"
            for s in file_data.signatures
        ])
        content_for_embedding = f"Signatures:\n{sig_text}"
    
    if not content_for_embedding:
        return {'success': False, 'error': 'Sem conteúdo para indexar'}
    
    # Gerar embedding
    try:
        embedding = await generate_embedding(content_for_embedding)
    except Exception as err:
        logger.warning(f"Erro ao gerar embedding: {err}")
        embedding = None
    
    # Criar ou atualizar nó
    node_data = {
        'content': content_for_embedding[:2000],
        'node_type': 'estrutura_arquivo',
        'project_id': project_id,
        'metadata': {
            'type': 'file_structure',
            'path': file_data.path,
            'relative_path': relative_path,
            'extension': file_data.extension,
            'category': file_data.category,
            'size': file_data.size,
            'has_signatures': bool(file_data.signatures)
        }
    }
    
    existing = storage.get_node(node_id)
    if existing:
        storage.update_node(node_id, node_data)
    else:
        storage.create_node(node_id, node_data)
    
    # Atualizar cache do repo map
    repo_map = _load_repo_map_cache(project_id)
    if repo_map:
        # Encontrar e atualizar arquivo no cache
        files = repo_map.get('files', [])
        file_index = next(
            (i for i, f in enumerate(files) if f.get('relativePath') == relative_path),
            None
        )
        
        if file_index is not None:
            files[file_index] = {
                'path': file_data.path,
                'relativePath': relative_path,
                'size': file_data.size,
                'extension': file_data.extension,
                'category': file_data.category,
                'content': file_data.content if file_data.size <= SMALL_FILE_MAX_SIZE else None,
                'signatures': file_data.signatures
            }
        else:
            files.append({
                'path': file_data.path,
                'relativePath': relative_path,
                'size': file_data.size,
                'extension': file_data.extension,
                'category': file_data.category,
                'content': file_data.content if file_data.size <= SMALL_FILE_MAX_SIZE else None,
                'signatures': file_data.signatures
            })
        
        repo_map['files'] = files
        _save_repo_map_cache(project_id, repo_map)
    
    logger.info(f"Arquivo reindexado: {relative_path}")
    
    return {
        'success': True,
        'data': {
            'node_id': node_id,
            'updated': existing is not None
        }
    }
 
 
@router.delete("/repo/file")
async def delete_file_index(request: FileDeleteRequest):
    """
    Remove arquivo do índice (após delete aprovado).
    """
    storage = get_storage()
    
    project_id = request.project_id
    file_path = request.file_path
    
    # Converter path absoluto para relativo (se necessário)
    # Aqui assumimos que file_path já é relativo
    node_id = f"{project_id}:{file_path}"
    
    logger.info(f"Removendo do índice: {file_path}")
    
    # Remover nó
    existing = storage.get_node(node_id)
    if existing:
        storage.delete_node(node_id)
    
    # Atualizar cache
    repo_map = _load_repo_map_cache(project_id)
    if repo_map:
        files = repo_map.get('files', [])
        repo_map['files'] = [
            f for f in files 
            if f.get('relativePath') != file_path
        ]
        _save_repo_map_cache(project_id, repo_map)
    
    return {'success': True}
 
 
@router.get("/repo/map/{project_id}")
async def get_repo_map(project_id: str):
    """
    Retorna repo map cacheado de um projeto.
    """
    repo_map = _load_repo_map_cache(project_id)
    
    if not repo_map:
        raise HTTPException(
            status_code=404,
            detail=f"Repo map não encontrado para projeto {project_id}"
        )
    
    # Truncar se necessário
    truncated_map = _truncate_repo_map(repo_map)
    
    return {
        'success': True,
        'data': truncated_map
    }
