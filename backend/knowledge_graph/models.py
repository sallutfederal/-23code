import enum


class NodeType(str, enum.Enum):
    DECISAO_ARQUITETURA = "decisao_arquitetura"
    TRECHO_CODIGO = "trecho_codigo"
    EXPLICACAO = "explicacao"
    CORRECAO_ERRO = "correcao_erro"
    CONTEXTO_PROJETO = "contexto_projeto"


class RelationType(str, enum.Enum):
    DEPENDE_DE = "depende_de"
    CONTRADIZ = "contradiz"
    EVOLUI_DE = "evolui_de"
    IMPLEMENTA = "implementa"
    RELACIONADO_A = "relacionado_a"
