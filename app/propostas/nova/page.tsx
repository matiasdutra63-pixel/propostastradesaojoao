"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Acao = {
  id: string;
  area: string;
  nome: string;
  valor: number;
  observacoes?: string;
};

type AcaoProposta = Acao & {
  desconto: number; // %
  mesesSelecionados: number[]; // 0..11
  lojas: number; // entra no cálculo (você pediu)
  valorDigitado?: number; // ✅ para ações "sob consulta" (valor=0)
  valorFinal: number;
};

type Proposta = {
  id: string;
  nome: string;
  dataCriacao: string;
  acoes: AcaoProposta[];
  total: number;
};

const MESES = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

const moeda = (v: number) =>
  (Number(v) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const clamp = (n: number, min: number, max: number) =>
  Math.min(Math.max(n, min), max);

function formatBRLInput(value: string) {
  const digits = (value || "").replace(/\D/g, "");
  const n = Number(digits || "0") / 100;
  if (!digits) return "";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function parseBRLToNumber(value: string) {
  const s = (value || "").trim();
  if (!s) return 0;
  const normalized = s
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = Number(normalized);
  return isNaN(n) ? 0 : n;
}

export default function NovaPropostaPage() {
  const router = useRouter();

  const [nomeProposta, setNomeProposta] = useState("");
  const [acoesBase, setAcoesBase] = useState<Acao[]>([]);
  const [acoesProposta, setAcoesProposta] = useState<AcaoProposta[]>([]);
  const [acaoSelecionada, setAcaoSelecionada] = useState("");

  // máscara para valor digitado (sob consulta) por linha
  const [valorMask, setValorMask] = useState<Record<string, string>>({});

  useEffect(() => {
    const logado = localStorage.getItem("logado") === "true";
    if (!logado) {
      router.replace("/login");
      return;
    }

    const carregarAcoes = async () => {
      // 1) localStorage
      try {
        const salvas = localStorage.getItem("acoes");
        const parsed = salvas ? JSON.parse(salvas) : [];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setAcoesBase(parsed);
          return;
        }
      } catch {}

      // 2) fallback /public/acoes.json
      try {
        const resp = await fetch("/acoes.json", { cache: "no-store" });
        const data = await resp.json();
        const arr = Array.isArray(data) ? data : [];
        setAcoesBase(arr);

        // cache
        if (arr.length > 0) {
          localStorage.setItem("acoes", JSON.stringify(arr));
        }
      } catch {
        setAcoesBase([]);
      }
    };

    carregarAcoes();
  }, [router]);

  const qtdMeses = (arr: number[]) => (Array.isArray(arr) ? arr.length : 0);

  const valorBaseDaLinha = (a: AcaoProposta) => {
    if ((Number(a.valor) || 0) > 0) return Number(a.valor) || 0;
    return Number(a.valorDigitado) || 0; // sob consulta
  };

  const recalcularValorFinal = (a: AcaoProposta) => {
    const base = valorBaseDaLinha(a);
    const meses = qtdMeses(a.mesesSelecionados);
    const lojas = Math.max(1, Math.floor(Number(a.lojas) || 0)); // ✅ entra no cálculo (você pediu)
    const bruto = base * meses * lojas;
    const d = clamp(Number(a.desconto) || 0, 0, 100);
    return Math.max(0, bruto - (bruto * d) / 100);
  };

  const total = useMemo(() => {
    return acoesProposta.reduce(
      (soma, a) => soma + (Number(a.valorFinal) || 0),
      0
    );
  }, [acoesProposta]);

  const mesesTexto = (mesesSelecionados: number[]) =>
    (mesesSelecionados || [])
      .slice()
      .sort((a, b) => a - b)
      .map((i) => MESES[i])
      .join(", ");

  const adicionarAcao = () => {
    const acao = acoesBase.find((a) => a.id === acaoSelecionada);
    if (!acao) {
      alert("Selecione uma ação.");
      return;
    }

    const mesAtual = new Date().getMonth();
    const mesesPadrao = [mesAtual];

    const nova: AcaoProposta = {
      ...acao,
      desconto: 0,
      mesesSelecionados: mesesPadrao,
      lojas: 1,
      valorDigitado: acao.valor === 0 ? undefined : undefined,
      valorFinal: 0,
    };

    nova.valorFinal = recalcularValorFinal(nova);

    setAcoesProposta((prev) => [...prev, nova]);
    setAcaoSelecionada("");
  };

  const removerAcao = (index: number) => {
    setAcoesProposta((prev) => prev.filter((_, i) => i !== index));
  };

  const alterarDesconto = (index: number, descontoPercentual: number) => {
    setAcoesProposta((prev) => {
      const novas = [...prev];
      const atual = novas[index];
      if (!atual) return prev;

      atual.desconto = clamp(Number(descontoPercentual) || 0, 0, 100);
      atual.valorFinal = recalcularValorFinal(atual);

      novas[index] = { ...atual };
      return novas;
    });
  };

  const alterarLojas = (index: number, lojas: number) => {
    setAcoesProposta((prev) => {
      const novas = [...prev];
      const atual = novas[index];
      if (!atual) return prev;

      atual.lojas = Math.max(0, Math.floor(Number(lojas) || 0));
      atual.valorFinal = recalcularValorFinal(atual);

      novas[index] = { ...atual };
      return novas;
    });
  };

  const alterarValorSobConsulta = (index: number, raw: string) => {
    setAcoesProposta((prev) => {
      const novas = [...prev];
      const atual = novas[index];
      if (!atual) return prev;

      const key = `${atual.id}-${index}`;
      const masked = formatBRLInput(raw);
      setValorMask((p) => ({ ...p, [key]: masked }));

      atual.valorDigitado = parseBRLToNumber(masked) || undefined;
      atual.valorFinal = recalcularValorFinal(atual);

      novas[index] = { ...atual };
      return novas;
    });
  };

  const toggleMes = (index: number, mesIndex: number) => {
    setAcoesProposta((prev) => {
      return prev.map((item, i) => {
        if (i !== index) return item;

        const atual = item.mesesSelecionados || [];
        const set = new Set<number>(atual.map(Number));

        if (set.has(mesIndex)) set.delete(mesIndex);
        else set.add(mesIndex);

        const meses = Array.from(set).sort((a, b) => a - b);

        const atualizado = {
          ...item,
          mesesSelecionados: meses,
        };

        return {
          ...atualizado,
          valorFinal: recalcularValorFinal(atualizado),
        };
      });
    });
  };
  const salvarProposta = () => {
    if (!nomeProposta.trim())
      return alert("Informe o nome da proposta / indústria.");
    if (acoesProposta.length === 0) return alert("Adicione ao menos uma ação.");
    if (acoesProposta.some((a) => qtdMeses(a.mesesSelecionados) === 0))
      return alert(
        "Existe ação sem meses selecionados. Selecione ao menos 1 mês por ação."
      );

    // ✅ valida sob consulta
    const faltandoValor = acoesProposta.some(
      (a) => (Number(a.valor) || 0) === 0 && !(Number(a.valorDigitado) > 0)
    );
    if (faltandoValor)
      return alert(
        "Existe ação 'Sob consulta' sem valor. Preencha o valor antes de salvar/exportar."
      );

    const propostasSalvas = JSON.parse(
      localStorage.getItem("propostas") || "[]"
    );

    const nova: Proposta = {
      id: crypto.randomUUID(),
      nome: nomeProposta.trim(),
      dataCriacao: new Date().toISOString(),
      acoes: acoesProposta,
      total,
    };

    localStorage.setItem(
      "propostas",
      JSON.stringify([...propostasSalvas, nova])
    );
    alert("Proposta salva com sucesso!");
    router.push("/proposta");
  };

  return (
    <div className="space-y-6">
      {/* Header (igual ao seu) */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-400 font-semibold">
              Nova Proposta
            </div>
            <div className="text-xl font-bold text-gray-900 mt-1">
              Proposta com meses e lojas por ação
            </div>
            <div className="text-sm text-gray-500 mt-1">
              Meses multiplicam o valor. Lojas entra no cálculo (como você
              pediu).
            </div>
          </div>
        </div>

        <div className="mt-5">
          <label className="text-xs uppercase tracking-wide text-gray-400 font-semibold">
            Nome da indústria / proposta
          </label>
          <input
            value={nomeProposta}
            onChange={(e) => setNomeProposta(e.target.value)}
            placeholder="Ex: Nivea"
            className="mt-2 w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Adicionar ação (igual ao seu) */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <div className="flex gap-3">
          <select
            className="flex-1 border border-gray-200 rounded-xl px-4 py-3"
            value={acaoSelecionada}
            onChange={(e) => setAcaoSelecionada(e.target.value)}
          >
            <option value="">Selecione uma ação</option>
            {acoesBase.map((a) => (
              <option key={a.id} value={a.id}>
                {a.area} — {a.nome} (
                {(Number(a.valor) || 0) === 0 ? "Sob consulta" : moeda(a.valor)}
                )
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={adicionarAcao}
            className="px-5 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700"
          >
            Adicionar
          </button>
        </div>
      </div>

      {/* Lista (igual ao seu) */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="font-semibold text-gray-900">
            Ações na proposta ({acoesProposta.length})
          </div>
          <div className="text-sm text-gray-600 font-semibold">
            Total: <span className="text-emerald-700">{moeda(total)}</span>
          </div>
        </div>

        {acoesProposta.length === 0 ? (
          <div className="p-6 text-sm text-gray-500">
            Nenhuma ação adicionada ainda.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {acoesProposta.map((a, index) => {
              const key = `${a.id}-${index}`;
              const isSobConsulta = (Number(a.valor) || 0) === 0;

              return (
                <div key={key} className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-gray-400 font-semibold">
                        {a.area}
                      </div>
                      <div className="text-lg font-bold text-gray-900">
                        {a.nome}
                      </div>
                      {a.observacoes ? (
                        <div className="text-sm text-gray-600 mt-1">
                          {a.observacoes}
                        </div>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      onClick={() => removerAcao(index)}
                      className="text-red-600 font-semibold hover:underline"
                    >
                      Excluir
                    </button>
                  </div>

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-4">
                    {/* Valor/mês */}
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                      <div className="text-xs text-gray-500 font-semibold uppercase">
                        Valor/mês
                      </div>

                      {isSobConsulta ? (
                        <div className="mt-2">
                          <input
                            type="text"
                            placeholder="Digite o valor"
                            value={
                              valorMask[key] ??
                              (a.valorDigitado ? moeda(a.valorDigitado) : "")
                            }
                            onChange={(e) =>
                              alterarValorSobConsulta(index, e.target.value)
                            }
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-white"
                          />
                          <div className="text-xs text-gray-500 mt-1">
                            Sob consulta → preencha para exportar
                          </div>
                        </div>
                      ) : (
                        <div className="text-lg font-bold text-gray-900">
                          {moeda(a.valor)}
                        </div>
                      )}
                    </div>

                    {/* Desconto */}
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                      <div className="text-xs text-gray-500 font-semibold uppercase">
                        Desconto
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          className="w-24 border border-gray-200 rounded-lg px-3 py-2 bg-white"
                          value={a.desconto ?? 0}
                          onChange={(e) =>
                            alterarDesconto(index, Number(e.target.value))
                          }
                        />
                        <span className="text-sm font-semibold text-gray-600">
                          %
                        </span>
                      </div>
                    </div>

                    {/* Lojas */}
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                      <div className="text-xs text-gray-500 font-semibold uppercase">
                        Lojas
                      </div>
                      <div className="mt-2">
                        <input
                          type="number"
                          min={0}
                          className="w-28 border border-gray-200 rounded-lg px-3 py-2 bg-white"
                          value={a.lojas ?? 0}
                          onChange={(e) =>
                            alterarLojas(index, Number(e.target.value))
                          }
                        />
                      </div>
                    </div>

                    {/* Meses */}
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 md:col-span-2">
                      <div className="text-xs text-gray-500 font-semibold uppercase">
                        Vigência (meses)
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {MESES.map((m, mi) => {
                          const ativo = (a.mesesSelecionados || []).includes(
                            mi
                          );
                          return (
                            <button
                              key={m}
                              type="button"
                              onClick={() => toggleMes(index, mi)}
                              className={[
                                "px-3 py-1.5 rounded-full text-xs font-semibold border transition",
                                ativo
                                  ? "bg-blue-600 text-white border-blue-600"
                                  : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50",
                              ].join(" ")}
                            >
                              {m}
                            </button>
                          );
                        })}
                      </div>
                      <div className="mt-2 text-xs text-gray-600">
                        Selecionados:{" "}
                        <span className="font-semibold">
                          {mesesTexto(a.mesesSelecionados) || "—"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-end">
                    <div className="text-sm text-gray-600 font-semibold mr-3">
                      Valor final:
                    </div>
                    <div className="text-xl font-extrabold text-emerald-700">
                      {moeda(a.valorFinal)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={salvarProposta}
          className="px-6 py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700"
        >
          Salvar Proposta
        </button>
      </div>
    </div>
  );
}
