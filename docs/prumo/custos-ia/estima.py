import math, os, json
BASE = os.path.dirname(os.path.abspath(__file__))
def ch(f): return len(open(os.path.join(BASE, f), encoding="utf-8").read())

# Preços oficiais (platform.claude.com/docs/en/about-claude/pricing, consultado 2026-11-09), US$/MTok
PRECOS = {
  "Opus 5.5":   {"in": 4.00, "out": 20.00},
  "Sonnet 5.5": {"in": 2.00, "out": 10.00},
  "Haiku 5.5":  {"in": 0.10, "out": 0.50},   # prompts até 100 mil tokens
}
BUSCA = 10.00 / 1000          # US$ por busca na web
PTAX = 5.5146                 # BCB, venda, 2026-11-09 13:11

# Caracteres por token (tokenizador novo, português + JSON): hipótese
CPT = {"baixo": 3.2, "central": 2.6, "alto": 2.2}

def tok(chars, cen): return chars / CPT[cen]

# ---------- Lançar por frase ----------
in_frase_chars = ch("sistema-frase.txt") + ch("esquema-frase.json") + ch("contexto-frase.txt")
out_frase_chars = ch("saida-frase.json")
PENS_FRASE = {  # tokens de raciocínio por lançamento (hipótese)
  "Opus 5.5":   {"baixo": 0,   "central": 150, "alto": 400},   # esforço low
  "Sonnet 5.5": {"baixo": 0,   "central": 100, "alto": 300},   # pode desligar com between_tools
  "Haiku 5.5":  {"baixo": 0,   "central": 0,   "alto": 200},   # pode desligar em effort <= high
}
EXTRA_IN_FRASE = 60  # envelope da requisição e do formato estruturado (hipótese)

def custo_frase(m, cen):
    i = tok(in_frase_chars, cen) + EXTRA_IN_FRASE
    o = tok(out_frase_chars, cen) + PENS_FRASE[m][cen]
    p = PRECOS[m]
    return (i*p["in"] + o*p["out"]) / 1e6, i, o

# ---------- Pesquisa de roteiro de um dia (com busca na web) ----------
base_roteiro_chars = ch("sistema-roteiro.txt") + ch("esquema-roteiro.json") + ch("contexto-roteiro.txt")
out_roteiro_chars = ch("saida-roteiro.json")
BUSCA_CEN = {   # buscas por pedido, tokens de resultado por busca, etapas do modelo
  "baixo":   {"n": 3, "r": 1500, "passos": lambda n: 2},                 # filtragem dinâmica, buscas em paralelo
  "central": {"n": 5, "r": 3500, "passos": lambda n: math.ceil(n/2)+1},
  "alto":    {"n": 8, "r": 6000, "passos": lambda n: n+1},              # busca básica, sequencial (exemplo da doc: 1 busca, ~6 mil tokens)
}
OVERHEAD_FERRAMENTA = 400   # definição da ferramenta de busca (hipótese)
PENS_ROTEIRO = {
  "Opus 5.5":   {"baixo": 500, "central": 1500, "alto": 3000},   # esforço medium
  "Sonnet 5.5": {"baixo": 500, "central": 1200, "alto": 2500},
  "Haiku 5.5":  {"baixo": 300, "central": 600,  "alto": 1500},
}

def custo_roteiro(m, cen, fator_buscas=1.0):
    c = BUSCA_CEN[cen]
    n = max(1, round(c["n"]*fator_buscas))
    s = c["passos"](n)
    base = tok(base_roteiro_chars, cen) + OVERHEAD_FERRAMENTA
    pedaco = c["r"]*n/(s-1) if s > 1 else c["r"]*n
    entrada = s*base + pedaco*s*(s-1)/2 + 100*s*(s-1)/2   # o modelo relê o contexto acumulado a cada etapa
    saida = tok(out_roteiro_chars, cen) + PENS_ROTEIRO[m][cen] + 80*n
    p = PRECOS[m]
    if m == "Haiku 5.5" and entrada/s > 100_000:
        p = {"in": 0.50, "out": 2.50}
    return (entrada*p["in"] + saida*p["out"])/1e6 + n*BUSCA, entrada, saida, n

# ---------- Cenários de uso (hipóteses) ----------
USO = {
  "pesquisas_dia_por_viagem": 10,
  "ajustes_por_viagem": 5,          # pesquisa menor: metade das buscas
  "frases_por_pessoa_por_viagem": 30,  # 3 gastos por dia em 10 dias
  "viagens_por_ano": 3,
  "pessoas_no_grupo": 4,
}

def fmt(v): return f"US$ {v:.4f}" if v < 0.01 else f"US$ {v:.2f}"
def brl(v): return f"R$ {v*PTAX:.2f}".replace(".", ",")

res = {}
print(f"Tamanho medido: frase {in_frase_chars} caracteres de entrada e {out_frase_chars} de saída; roteiro {base_roteiro_chars} de entrada e {out_roteiro_chars} de saída.\n")
for m in PRECOS:
    res[m] = {}
    for cen in ("baixo","central","alto"):
        f, fi, fo = custo_frase(m, cen)
        r, ri, ro, rn = custo_roteiro(m, cen)
        a, *_ = custo_roteiro(m, cen, 0.5)
        org = USO["pesquisas_dia_por_viagem"]*r + USO["ajustes_por_viagem"]*a + USO["frases_por_pessoa_por_viagem"]*f
        part = USO["frases_por_pessoa_por_viagem"]*f
        grupo_ano = USO["viagens_por_ano"]*(USO["pesquisas_dia_por_viagem"]*r + USO["ajustes_por_viagem"]*a + USO["pessoas_no_grupo"]*USO["frases_por_pessoa_por_viagem"]*f)
        res[m][cen] = dict(frase=f, roteiro=r, org_viagem=org, part_viagem=part, org_ano=org*USO["viagens_por_ano"], grupo_ano=grupo_ano,
                           tokens_frase=(round(fi), round(fo)), tokens_roteiro=(round(ri), round(ro), rn))
        print(f"{m:10s} {cen:7s} frase {fmt(f):>12s} [{round(fi)} in/{round(fo)} out]  roteiro-dia {fmt(r):>9s} [{round(ri)} in/{round(ro)} out, {rn} buscas]  organizador/viagem {fmt(org):>9s}  participante/viagem {fmt(part):>10s}  grupo/ano {fmt(grupo_ano):>9s} ({brl(grupo_ano)})")
    print()
json.dump(res, open(os.path.join(BASE, "resultado.json"), "w"), indent=1, ensure_ascii=False)
