"""
signature_extractor.py — Extração de assinaturas de código Python usando AST.
 
Usa o módulo `ast` nativo do Python para extrair:
- Funções (def)
- Classes (class)
- Imports
- Constantes exportadas
 
NÃO usa regex — parsing real garante correção em todos os casos.
"""

import ast
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict


@dataclass
class Signature:
    """Assinatura extraída de um símbolo Python."""
    name: str
    type: str  # 'function', 'class', 'variable', 'import'
    line: int
    params: List[str]
    exported: bool
    docstring: Optional[str] = None


def extract_signatures(file_path: str, content: str) -> List[Dict[str, Any]]:
    """
    Extrai assinaturas de um arquivo Python.
    
    Args:
        file_path: Caminho do arquivo (para contexto)
        content: Conteúdo do arquivo
        
    Returns:
        Lista de assinaturas como dicts
    """
    signatures = []
    
    try:
        tree = ast.parse(content)
    except SyntaxError as err:
        print(f"[AST] Erro de sintaxe em {file_path}: {err}")
        return []
    except Exception as err:
        print(f"[AST] Erro ao parsear {file_path}: {err}")
        return []
    
    for node in ast.iter_child_nodes(tree):
        # Funções
        if isinstance(node, ast.FunctionDef) or isinstance(node, ast.AsyncFunctionDef):
            params = _extract_params(node.args)
            docstring = ast.get_docstring(node)
            signatures.append(asdict(Signature(
                name=node.name,
                type='function',
                line=node.lineno,
                params=params,
                exported=node.name.startswith('_') is False,
                docstring=docstring[:100] if docstring else None
            )))
        
        # Classes
        elif isinstance(node, ast.ClassDef):
            # Métodos da classe
            methods = []
            for item in ast.iter_child_nodes(node):
                if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    methods.append({
                        'name': item.name,
                        'params': _extract_params(item.args),
                        'line': item.lineno
                    })
            
            docstring = ast.get_docstring(node)
            signatures.append(asdict(Signature(
                name=node.name,
                type='class',
                line=node.lineno,
                params=[b.id if isinstance(b, ast.Name) else str(b) for b in node.bases],
                exported=node.name.startswith('_') is False,
                docstring=docstring[:100] if docstring else None
            )))
        
        # Atributos (constantes, variáveis globais)
        elif isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name):
                    signatures.append(asdict(Signature(
                        name=target.id,
                        type='variable',
                        line=node.lineno,
                        params=[],
                        exported=target.id.isupper()
                    )))
        
        # Imports
        elif isinstance(node, ast.Import):
            for alias in node.names:
                signatures.append(asdict(Signature(
                    name=alias.asname or alias.name,
                    type='import',
                    line=node.lineno,
                    params=[alias.name],
                    exported=False
                )))
        
        elif isinstance(node, ast.ImportFrom):
            module = node.module or ''
            for alias in node.names:
                signatures.append(asdict(Signature(
                    name=alias.asname or alias.name,
                    type='import',
                    line=node.lineno,
                    params=[f"{module}.{alias.name}"],
                    exported=False
                )))
    
    return signatures


def _extract_params(args: ast.arguments) -> List[str]:
    """Extrai nomes dos parâmetros de uma função."""
    params = []
    
    # Args normais
    for arg in args.args:
        if arg.arg != 'self' and arg.arg != 'cls':
            params.append(arg.arg)
    
    # *args
    if args.vararg:
        params.append(f"*{args.vararg.arg}")
    
    # Keyword-only args
    for arg in args.kwonlyargs:
        params.append(arg.arg)
    
    # **kwargs
    if args.kwarg:
        params.append(f"**{args.kwarg.arg}")
    
    return params


def extract_file_summary(file_path: str, content: str) -> Dict[str, Any]:
    """
    Gera resumo completo de um arquivo Python.
    
    Retorna:
    - signatures: lista de assinaturas
    - imports: lista de imports
    - classes: lista de classes com métodos
    - functions: lista de funções
    """
    signatures = extract_signatures(file_path, content)
    
    return {
        'path': file_path,
        'signatures': signatures,
        'imports': [s for s in signatures if s['type'] == 'import'],
        'classes': [s for s in signatures if s['type'] == 'class'],
        'functions': [s for s in signatures if s['type'] == 'function'],
        'total_symbols': len(signatures)
    }
