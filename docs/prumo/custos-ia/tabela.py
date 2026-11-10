import json, os
B = os.path.dirname(os.path.abspath(__file__))
r = json.load(open(os.path.join(B, "resultado.json"), encoding="utf-8"))
PTAX = 5.5146
def us(v):
    s = f"{v:.4f}" if v < 0.01 else f"{v:.2f}"
    return s.replace(".", ",")
def rs(v):
    s = f"{v*PTAX:.4f}" if v*PTAX < 0.01 else f"{v*PTAX:.2f}"
    return s.replace(".", ",")
def cel(m, k):
    c, b, a = r[m]["central"][k], r[m]["baixo"][k], r[m]["alto"][k]
    return f"US$ {us(c)} (R$ {rs(c)}); faixa US$ {us(b)} a {us(a)}"
linhas = [("Lançar um gasto por frase", "frase"), ("Pesquisar um dia de roteiro, com busca na web", "roteiro"),
          ("Organizador, por viagem", "org_viagem"), ("Participante, por viagem", "part_viagem"),
          ("Organizador, por ano", "org_ano"), ("Grupo de 4, por ano, todos usando IA", "grupo_ano")]
print("| Uso | Claude Opus 5.5 | Claude Sonnet 5.5 | Claude Haiku 5.5 |")
print("|---|---|---|---|")
for nome, k in linhas:
    print(f"| {nome} | " + " | ".join(cel(m, k) for m in ("Opus 5.5","Sonnet 5.5","Haiku 5.5")) + " |")
# teste real sugerido: 10 frases + 5 roteiros no Opus
for cen in ("central","alto"):
    t = 10*r["Opus 5.5"][cen]["frase"] + 5*r["Opus 5.5"][cen]["roteiro"]
    print(f"teste 10 frases + 5 roteiros, Opus, {cen}: US$ {us(t)}")
