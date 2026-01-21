"use client";

import { useEffect, useMemo, useState } from "react";

type Acao = {
  id: string;
  area: string;
  nome: string;
  valor: number;
  observacoes?: string;
};

const ADMIN_EMAIL = "matias.dutra@farmaciassaojoao.com.br";

export default function AcoesPage() {
  const [email, setEmail] = useState<string>("");
  const isAdmin = email === ADMIN_EMAIL;

  const [acoes, setAcoes] = useState<Acao[]>([]);
  const [filtro, setFiltro] = useState("");
  const [areaFiltro, setAreaFiltro] = useState<string>("todas");

  // ✅ Carrega email + ações no client (sem mounted)
  useEffect(() => {
    const e = localStorage.getItem("email") || "";
    setEmail(e);

    try {
      const salvas = JSON.parse(localStorage.getItem("acoes") || "[]");
      setAcoes(Array.isArray(salvas) ? salvas : []);
    } catch {
      setAcoes([]);
    }
  }, []);

  const moeda = (v: number) =>
    (Number(v) || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

  const areas = useMemo(() => {
    const set = new Set<string>();
    acoes.forEach((a) => {
      if (a?.area) set.add(a.area);
    });
    return ["todas", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [acoes]);

  const acoesFiltradas = useMemo(() => {
    const q = filtro.trim().toLowerCase();

    return acoes.filter((a) => {
      const passaArea = areaFiltro === "todas" ? true : a.area === areaFiltro;
      const passaBusca =
        !q ||
        (a.area || "").toLowerCase().includes(q) ||
        (a.nome || "").toLowerCase().includes(q) ||
        (a.observacoes || "").toLowerCase().includes(q);

      return passaArea && passaBusca;
    });
  }, [acoes, filtro, areaFiltro]);

  const totalAcoes = acoes.length;

  const totalAreas = useMemo(() => {
    const set = new Set(acoes.map((a) => a.area).filter(Boolean));
    return set.size;
  }, [acoes]);

  const valorMedio = useMemo(() => {
    const validas = acoes.map((a) => Number(a.valor) || 0).filter((v) => v > 0);
    if (validas.length === 0) return 0;
    const soma = validas.reduce((s, v) => s + v, 0);
    return soma / validas.length;
  }, [acoes]);

  const salvarAcoes = (novas: Acao[]) => {
    localStorage.setItem("acoes", JSON.stringify(novas));
    setAcoes(novas);
  };

  const removerAcao = (id: string) => {
    if (!isAdmin) {
      alert("Somente o admin pode excluir ações.");
      return;
    }
    const ok = confirm("Deseja excluir esta ação?");
    if (!ok) return;

    salvarAcoes(acoes.filter((a) => a.id !== id));
  };

  // ✅ Parser de valor robusto: "R$ 18.000,00" / "18000" / "18.000" / "18,000.50"
  function parseValor(input: string) {
    const s = (input || "").toString().toLowerCase().trim();
    if (!s) return 0;
    if (s.includes("sob consulta")) return 0;

    // tira R$, espaços e símbolos
    let cleaned = s.replace("r$", "").replace(/\s/g, "");

    // se vier no padrão BR (18.000,00) -> remove pontos e troca vírgula por ponto
    // se vier no padrão US (18,000.50) -> remove vírgulas
    const hasComma = cleaned.includes(",");
    const hasDot = cleaned.includes(".");

    if (hasComma && hasDot) {
      // decide pelo último separador como decimal
      const lastComma = cleaned.lastIndexOf(",");
      const lastDot = cleaned.lastIndexOf(".");
      if (lastComma > lastDot) {
        // 18.000,00
        cleaned = cleaned.replace(/\./g, "").replace(",", ".");
      } else {
        // 18,000.50
        cleaned = cleaned.replace(/,/g, "");
      }
    } else if (hasComma && !hasDot) {
      // 18000,50
      cleaned = cleaned.replace(",", ".");
    } else {
      // 18.000 ou 18000.50 -> remove separador de milhar só se fizer sentido
      // aqui, manter ponto como decimal
      // se for "18.000" (milhar), fica ambíguo; assume milhar:
      const parts = cleaned.split(".");
      if (parts.length === 2 && parts[1].length === 3) {
        cleaned = cleaned.replace(".", "");
      }
    }

    const n = Number(cleaned);
    return isNaN(n) ? 0 : n;
  }

  // ✅ Importação CSV (admin)
  // Aceita:
  // - linha de área sozinha (1 coluna) -> define areaAtual
  // - linhas de ação: Nome;Valor;Obs
  // - ou: Area;Nome;Valor;Obs
  const importarCSV = async (file: File) => {
    if (!isAdmin) {
      alert("Somente o admin pode importar ações.");
      return;
    }

    const text = await file.text();

    // detecta separador mais provável
    const firstLine =
      text.split(/\r?\n/).find((l) => l.trim().length > 0) || "";
    const sep = firstLine.includes(";")
      ? ";"
      : firstLine.includes(",")
      ? ","
      : "\t";

    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    let areaAtual = "";
    const novas: Acao[] = [];

    for (const line of lines) {
      // quebra colunas e remove aspas externas
      const cols = line
        .split(sep)
        .map((c) => c.trim().replace(/^"|"$/g, "").trim())
        .filter((c) => c !== "");

      if (cols.length === 0) continue;

      // pular cabeçalho comum
      const lower = cols.join(" ").toLowerCase();
      if (
        lower.includes("area") &&
        lower.includes("valor") &&
        (lower.includes("acao") ||
          lower.includes("ação") ||
          lower.includes("nome"))
      ) {
        continue;
      }

      // Linha de área (1 coluna)
      if (cols.length === 1) {
        areaAtual = cols[0].trim();
        continue;
      }

      // Formato: Area;Nome;Valor;Obs
      if (cols.length >= 4) {
        const area = cols[0].trim() || areaAtual || "Geral";
        const nome = cols[1].trim();
        const valor = parseValor(cols[2]);
        const obs = cols.slice(3).join(" ").trim();

        novas.push({
          id: crypto.randomUUID(),
          area,
          nome,
          valor,
          observacoes: obs || "",
        });
        continue;
      }

      // Formato: Nome;Valor;Obs  (usa areaAtual)
      if (cols.length >= 2) {
        const nome = cols[0].trim();
        const valor = parseValor(cols[1]);
        const obs = cols.slice(2).join(" ").trim();

        novas.push({
          id: crypto.randomUUID(),
          area: areaAtual || "Geral",
          nome,
          valor,
          observacoes: obs || "",
        });
      }
    }

    // Mantém somente válidas
    const filtradas = novas.filter(
      (a) => a.nome?.trim() && typeof a.valor === "number" && !isNaN(a.valor)
    );

    if (filtradas.length === 0) {
      alert("Não consegui importar ações desse CSV. Verifique o formato.");
      return;
    }

    salvarAcoes(filtradas);
    alert(`Importado com sucesso: ${filtradas.length} ações.`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ações</h1>
          <p className="text-sm text-gray-500">
            Catálogo de ações (área, nome, valor e observações) usado nas
            propostas.
          </p>
        </div>

        {isAdmin ? (
          <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700">
            Importar CSV
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importarCSV(f);
                e.currentTarget.value = "";
              }}
            />
          </label>
        ) : (
          <div className="text-sm text-gray-500 bg-white border border-gray-200 rounded-xl px-4 py-2">
            Modo somente leitura
          </div>
        )}
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="text-xs uppercase tracking-wide text-gray-400 font-semibold">
            Total de ações
          </div>
          <div className="text-4xl font-bold mt-2 text-gray-900">
            {totalAcoes}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="text-xs uppercase tracking-wide text-gray-400 font-semibold">
            Total de áreas
          </div>
          <div className="text-4xl font-bold mt-2 text-gray-900">
            {totalAreas}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="text-xs uppercase tracking-wide text-gray-400 font-semibold">
            Valor médio (aprox.)
          </div>
          <div className="text-4xl font-bold mt-2 text-gray-900">
            {moeda(valorMedio)}
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <label className="text-xs uppercase tracking-wide text-gray-400 font-semibold">
              Buscar
            </label>
            <input
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              placeholder="Buscar por área, ação ou observações..."
              className="mt-2 w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-wide text-gray-400 font-semibold">
              Filtrar por área
            </label>
            <select
              value={areaFiltro}
              onChange={(e) => setAreaFiltro(e.target.value)}
              className="mt-2 w-full border border-gray-200 rounded-lg px-3 py-2"
            >
              {areas.map((a) => (
                <option key={a} value={a}>
                  {a === "todas" ? "Todas" : a}
                </option>
              ))}
            </select>
          </div>
        </div>

        {!isAdmin && (
          <div className="mt-4 text-sm text-gray-500">
            * Importação e exclusão de ações disponíveis apenas para o admin.
          </div>
        )}
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <div className="text-lg font-bold text-gray-900">
              Lista de ações
            </div>
            <div className="text-sm text-gray-500">
              Mostrando {acoesFiltradas.length} de {acoes.length}
            </div>
          </div>

          <button
            onClick={() => {
              try {
                const salvas = JSON.parse(
                  localStorage.getItem("acoes") || "[]"
                );
                setAcoes(Array.isArray(salvas) ? salvas : []);
              } catch {
                setAcoes([]);
              }
            }}
            className="text-sm font-semibold px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
          >
            Atualizar
          </button>
        </div>

        <table className="w-full">
          <thead className="bg-gray-50/80">
            <tr>
              <th className="border-b border-gray-100 p-3 text-left text-xs uppercase tracking-wide text-gray-500 font-semibold">
                Área
              </th>
              <th className="border-b border-gray-100 p-3 text-left text-xs uppercase tracking-wide text-gray-500 font-semibold">
                Ação
              </th>
              <th className="border-b border-gray-100 p-3 text-left text-xs uppercase tracking-wide text-gray-500 font-semibold">
                Valor
              </th>
              <th className="border-b border-gray-100 p-3 text-left text-xs uppercase tracking-wide text-gray-500 font-semibold">
                Observações
              </th>
              {isAdmin && (
                <th className="border-b border-gray-100 p-3 text-center text-xs uppercase tracking-wide text-gray-500 font-semibold">
                  Ações
                </th>
              )}
            </tr>
          </thead>

          <tbody>
            {acoesFiltradas.map((acao) => (
              <tr
                key={acao.id}
                className="border-t border-gray-100 hover:bg-gray-50/70 transition-colors"
              >
                <td className="border-b border-gray-100 p-3 text-gray-700">
                  {acao.area || "—"}
                </td>

                <td className="border-b border-gray-100 p-3 font-semibold text-gray-900">
                  {acao.nome || "—"}
                </td>

                <td className="border-b border-gray-100 p-3 text-gray-700">
                  {typeof acao.valor === "number" &&
                  !isNaN(acao.valor) &&
                  acao.valor > 0
                    ? moeda(acao.valor)
                    : "—"}
                </td>

                <td className="border-b border-gray-100 p-3 text-gray-600">
                  {acao.observacoes || "—"}
                </td>

                {isAdmin && (
                  <td className="border-b border-gray-100 p-3">
                    <div className="flex justify-center">
                      <button
                        onClick={() => removerAcao(acao.id)}
                        className="text-sm font-semibold px-3 py-1.5 rounded-lg border border-red-200 hover:bg-red-50 text-red-700"
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}

            {acoesFiltradas.length === 0 && (
              <tr>
                <td
                  colSpan={isAdmin ? 5 : 4}
                  className="p-8 text-center text-gray-500"
                >
                  Nenhuma ação encontrada com esse filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Dica de formato CSV */}
      {isAdmin && (
        <div className="text-sm text-gray-500">
          <span className="font-semibold text-gray-700">Dica CSV:</span> Você
          pode usar uma linha com <b>Área</b> sozinha para definir a área, e
          abaixo listar <b>Nome;Valor;Observações</b>.
          <div className="mt-2 font-mono text-xs bg-white border border-gray-200 rounded-xl p-3">
            ENCARTE
            <br />
            Rodapé 4 itens;18000;Validade 30 dias
            <br />
            Meia página 8 itens;25000;120 mil impressões
            <br />
          </div>
        </div>
      )}
    </div>
  );
}
