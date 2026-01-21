"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Proposta = {
  id: string;
  nome: string;
  dataCriacao?: string;
  total?: number;
  acoes?: any[];
};

export default function PropostaDashboardPage() {
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [acoesCount, setAcoesCount] = useState(0);

  const carregar = () => {
    const salvas = JSON.parse(localStorage.getItem("propostas") || "[]");
    setPropostas(Array.isArray(salvas) ? salvas : []);

    const acoesSalvas = JSON.parse(localStorage.getItem("acoes") || "[]");
    setAcoesCount(Array.isArray(acoesSalvas) ? acoesSalvas.length : 0);
  };

  useEffect(() => {
    carregar();
  }, []);

  const excluirProposta = (id: string) => {
    const confirmar = confirm("Deseja excluir esta proposta?");
    if (!confirmar) return;

    const atualizadas = propostas.filter((p) => p.id !== id);
    localStorage.setItem("propostas", JSON.stringify(atualizadas));
    setPropostas(atualizadas);
  };

  // 🔹 Métricas
  const totalPropostas = propostas.length;

  const valorTotal = useMemo(() => {
    return propostas.reduce((acc, p) => acc + (Number(p.total) || 0), 0);
  }, [propostas]);
  const { propostasNoMes, valorNoMes } = useMemo(() => {
    const agora = new Date();
    const mes = agora.getMonth();
    const ano = agora.getFullYear();
  
    const doMes = propostas.filter((p) => {
      if (!p.dataCriacao) return false;
      const d = new Date(p.dataCriacao);
      return d.getMonth() === mes && d.getFullYear() === ano;
    });
  
    const soma = doMes.reduce((acc, p) => acc + (Number(p.total) || 0), 0);
  
    return { propostasNoMes: doMes.length, valorNoMes: soma };
  }, [propostas]);

  const ultimaProposta = useMemo(() => {
    const ordenadas = [...propostas].sort((a, b) => {
      const da = a.dataCriacao ? new Date(a.dataCriacao).getTime() : 0;
      const db = b.dataCriacao ? new Date(b.dataCriacao).getTime() : 0;
      return db - da;
    });
    return ordenadas[0] || null;
  }, [propostas]);

  const formatarMoeda = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-gray-500 text-sm">
            Resumo das propostas e acesso rápido
          </p>
        </div>

        <Link
          href="/propostas/nova"
          className="bg-blue-600 text-white px-4 py-2 rounded font-semibold"
        >
          + Nova Proposta
        </Link>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Propostas no mês</div>
      <div className="text-4xl font-bold mt-2 text-gray-900">{propostasNoMes}</div>
  <div className="text-sm text-gray-500 mt-1">
    {formatarMoeda(valorNoMes)}
  </div>
</div>

<div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
<div className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Valor Total (somado)</div>
<div className="text-4xl font-bold mt-2 text-gray-900">
            {formatarMoeda(valorTotal)}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
        <div className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Última Proposta</div>
          <div className="mt-1">
            {ultimaProposta ? (
              <>
                <div className="text-lg font-bold">{ultimaProposta.nome}</div>
                <div className="text-xs uppercase tracking-wide text-gray-400 font-semibold">
                  {ultimaProposta.dataCriacao
                    ? new Date(ultimaProposta.dataCriacao).toLocaleDateString(
                        "pt-BR"
                      )
                    : "—"}
                  {" • "}
                  {formatarMoeda(Number(ultimaProposta.total) || 0)}
                </div>
                <div className="mt-2">
                  <Link
                    href={`/proposta/editar/${ultimaProposta.id}`}
                    className="text-blue-600 font-semibold hover:underline underline-offset-4"
                  >
                    Abrir
                  </Link>
                </div>
              </>
            ) : (
                <div className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Nenhuma proposta cadastrada.</div>
            )}
          </div>
        </div>

        {/* Card Ações */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
        <div className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Ações cadastradas</div>
        <div className="text-4xl font-bold mt-2 text-gray-900">{acoesCount}</div>

          <div className="mt-2">
            <Link
              href="/acoes"
              className="text-blue-600 font-semibold hover:underline underline-offset-4"
            >
              Gerenciar
            </Link>
          </div>
        </div>
      </div>

      {/* Lista/Tabela */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
          <div className="text-lg font-bold text-gray-900">Minhas Propostas</div>
            <div className="text-sm text-gray-500">
              {propostas.length === 0
                ? "Nenhuma proposta cadastrada."
                : `Você tem ${propostas.length} proposta(s).`}
            </div>
          </div>

          <button
            onClick={carregar}
            className="text-sm font-semibold px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
          >
            Atualizar
          </button>
        </div>

        {propostas.length === 0 ? (
          <div className="p-4 text-gray-500">Sem propostas ainda.</div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
            <tr className="bg-gray-50/80">
            <th className="border-b border-gray-100 p-3 text-left text-xs uppercase tracking-wide text-gray-500 font-semibold">Proposta</th>
            <th className="border-b border-gray-100 p-3 text-left text-xs uppercase tracking-wide text-gray-500 font-semibold">Data</th>
            <th className="border-b border-gray-100 p-3 text-left text-xs uppercase tracking-wide text-gray-500 font-semibold">Total</th>
            <th className="border-b border-gray-100 p-3 text-left text-xs uppercase tracking-wide text-gray-500 font-semibold">Ações</th>
              </tr>
            </thead>

            <tbody>
              {propostas.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50/70 transition-colors">
                  <td className="border-b border-gray-100 p-3 font-semibold text-gray-900">{p.nome}</td>

                  <td className="border-b border-gray-100 p-3 text-gray-600">
                    {p.dataCriacao
                      ? new Date(p.dataCriacao).toLocaleDateString("pt-BR")
                      : "—"}
                  </td>

                  <td className="border-b border-gray-100 p-3 text-gray-600">
                    {typeof p.total === "number" && !isNaN(p.total)
                      ? formatarMoeda(p.total)
                      : formatarMoeda(Number(p.total) || 0)}
                  </td>

                  <td className="border-b border-gray-100 p-3 font-semibold text-gray-900">
                  <div className="flex justify-center gap-2">
  <Link
    href={`/proposta/editar/${p.id}`}
    className="text-sm font-semibold px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-blue-700"
  >
    Editar
  </Link>

  <button
    onClick={() => excluirProposta(p.id)}
    className="text-sm font-semibold px-3 py-1.5 rounded-lg border border-red-200 hover:bg-red-50 text-red-700"
  >
    Excluir
  </button>
</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
