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
  lojas: number; // entra no cálculo
  valorDigitado?: number; // para ações "sob consulta" (valor=0)
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

  // ✅ controle de "alterações não salvas"
  const [dirty, setDirty] = useState(false);
  const markDirty = () => {
    setDirty(true);
    sessionStorage.setItem("dirty_proposta", "1");
  };
  const clearDirty = () => {
    setDirty(false);
    sessionStorage.removeItem("dirty_proposta");
  };

  // ✅ avisa ao fechar/atualizar a aba se houver mudanças não salvas
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      const isDirty = dirty || sessionStorage.getItem("dirty_proposta") === "1";
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

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
    const lojas = Math.max(1, Math.floor(Number(a.lojas) || 0)); // entra no cálculo
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
      valorDigitado: (Number(acao.valor) || 0) === 0 ? 0 : undefined,
      valorFinal: 0,
    };

    nova.valorFinal = recalcularValorFinal(nova);

    setAcoesProposta((prev) => [...prev, nova]);
    setAcaoSelecionada("");
    markDirty();
  };

  const removerAcao = (index: number) => {
    setAcoesProposta((prev) => prev.filter((_, i) => i !== index));
    markDirty();
  };

  const alterarDesconto = (index: number, descontoPercentual: number) => {
    setAcoesProposta((prev) => {
      const novas = [...prev];
      const atual = novas[index];
      if (!atual) return prev;

      const atualizado: AcaoProposta = {
        ...atual,
        desconto: clamp(Number(descontoPercentual) || 0, 0, 100),
      };
      atualizado.valorFinal = recalcularValorFinal(atualizado);

      novas[index] = atualizado;
      return novas;
    });
    markDirty();
  };

  const alterarLojas = (index: number, lojas: number) => {
    setAcoesProposta((prev) => {
      const novas = [...prev];
      const atual = novas[index];
      if (!atual) return prev;

      const atualizado: AcaoProposta = {
        ...atual,
        lojas: Math.max(0, Math.floor(Number(lojas) || 0)),
      };
      atualizado.valorFinal = recalcularValorFinal(atualizado);

      novas[index] = atualizado;
      return novas;
    });
    markDirty();
  };

  const alterarValorSobConsulta = (index: number, raw: string) => {
    setAcoesProposta((prev) => {
      const novas = [...prev];
      const atual = novas[index];
      if (!atual) return prev;

      const key = `${atual.id}-${index}`;
      const masked = formatBRLInput(raw);
      setValorMask((p) => ({ ...p, [key]: masked }));

      const digitado = parseBRLToNumber(masked);
      const atualizado: AcaoProposta = {
        ...atual,
        valorDigitado: digitado > 0 ? digitado : 0,
      };
      atualizado.valorFinal = recalcularValorFinal(atualizado);

      novas[index] = atualizado;
      return novas;
    });
    markDirty();
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

        const atualizado: AcaoProposta = {
          ...item,
          mesesSelecionados: meses,
        };

        return {
          ...atualizado,
          valorFinal: recalcularValorFinal(atualizado),
        };
      });
    });
    markDirty();
  };

  const validarAntes = () => {
    if (!nomeProposta.trim()) {
      alert("Informe o nome da proposta / indústria.");
      return false;
    }
    if (acoesProposta.length === 0) {
      alert("Adicione ao menos uma ação.");
      return false;
    }
    if (acoesProposta.some((a) => qtdMeses(a.mesesSelecionados) === 0)) {
      alert(
        "Existe ação sem meses selecionados. Selecione ao menos 1 mês por ação."
      );
      return false;
    }

    // valida sob consulta
    const faltandoValor = acoesProposta.some(
      (a) => (Number(a.valor) || 0) === 0 && !(Number(a.valorDigitado) > 0)
    );
    if (faltandoValor) {
      alert(
        "Existe ação 'Sob consulta' sem valor. Preencha o valor antes de salvar/exportar."
      );
      return false;
    }

    return true;
  };

  const salvarProposta = () => {
    if (!validarAntes()) return;

    const propostasSalvas = JSON.parse(
      localStorage.getItem("propostas") || "[]"
    );

    // garante que valorFinal está atualizado
    const acoesNormalizadas = acoesProposta.map((a) => {
      const atualizado: AcaoProposta = {
        ...a,
        desconto: clamp(Number(a.desconto) || 0, 0, 100),
        lojas: Math.max(0, Math.floor(Number(a.lojas) || 0)),
        mesesSelecionados: Array.isArray(a.mesesSelecionados)
          ? a.mesesSelecionados
          : [],
        valorDigitado:
          (Number(a.valor) || 0) === 0
            ? Number(a.valorDigitado) || 0
            : undefined,
      };
      return { ...atualizado, valorFinal: recalcularValorFinal(atualizado) };
    });

    const nova: Proposta = {
      id: crypto.randomUUID(),
      nome: nomeProposta.trim(),
      dataCriacao: new Date().toISOString(),
      acoes: acoesNormalizadas,
      total: acoesNormalizadas.reduce(
        (s, x) => s + (Number(x.valorFinal) || 0),
        0
      ),
    };

    localStorage.setItem(
      "propostas",
      JSON.stringify([...propostasSalvas, nova])
    );

    clearDirty();
    alert("Proposta salva com sucesso!");
    router.push("/proposta");
  };

  // ✅ Exportar Excel (.xls via HTML)
  const exportarExcelXLS = () => {
    if (!validarAntes()) return;

    const hoje = new Date().toLocaleDateString("pt-BR");

    const linhas = acoesProposta
      .map((a, i) => {
        const unit = valorBaseDaLinha(a);
        const meses = qtdMeses(a.mesesSelecionados);
        const lojas = Math.max(1, Math.floor(Number(a.lojas) || 0));
        const bruto = unit * meses * lojas;
        const d = clamp(Number(a.desconto) || 0, 0, 100);
        const final = Math.max(0, bruto - (bruto * d) / 100);

        return `
          <tr style="background:${i % 2 === 0 ? "#ffffff" : "#f9fafb"};">
            <td>${a.area || "—"}</td>
            <td>
              <b>${a.nome || "—"}</b><br/>
              <span style="color:#6b7280;font-size:11px;">${
                a.observacoes || ""
              }</span>
            </td>
            <td style="text-align:right;">${
              unit > 0 ? moeda(unit) : "Sob consulta"
            }</td>
            <td>${mesesTexto(a.mesesSelecionados || [])}</td>
            <td style="text-align:center;">${meses}</td>
            <td style="text-align:center;">${lojas}</td>
            <td style="text-align:center;">${d}%</td>
            <td style="text-align:right;font-weight:bold;color:#047857;">
              ${moeda(final)}
            </td>
          </tr>
        `;
      })
      .join("");

    const html = `
<html>
<head>
<meta charset="utf-8" />
<style>
  body { font-family: Arial, sans-serif; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #d1d5db; padding: 8px; font-size: 12px; vertical-align: top; }
  th {
    background: #1e40af;
    color: #ffffff;
    text-transform: uppercase;
    font-size: 11px;
  }
  .header {
    background: #1e40af;
    color: white;
    padding: 14px;
    font-size: 18px;
    font-weight: bold;
  }
  .sub {
    font-size: 11px;
    letter-spacing: 2px;
    opacity: .9;
  }
  .meta {
    background: #f3f4f6;
    padding: 10px;
    font-size: 12px;
  }
  .total {
    background: #047857;
    color: white;
    font-size: 16px;
    font-weight: bold;
  }
</style>
</head>
<body>

<div class="header">
  Farmácias São João<br/>
  <span class="sub">TRADE MARKETING</span>
</div>

<div class="meta">
  <b>Proposta:</b> ${nomeProposta}<br/>
  <b>Data:</b> ${hoje}
</div>

<table>
  <thead>
    <tr>
      <th>Área</th>
      <th>Ação</th>
      <th>Valor Unit.</th>
      <th>Meses</th>
      <th>Qtd Meses</th>
      <th>Lojas</th>
      <th>Desc.</th>
      <th>Valor Final</th>
    </tr>
  </thead>
  <tbody>
    ${linhas}
    <tr class="total">
      <td colspan="7" style="text-align:right;">TOTAL</td>
      <td style="text-align:right;">${moeda(total)}</td>
    </tr>
  </tbody>
</table>

</body>
</html>
`;

    const blob = new Blob([html], {
      type: "application/vnd.ms-excel;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `proposta-${nomeProposta
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ✅ Exportar PDF (abre print em nova guia)
  const exportarPDF = () => {
    if (!validarAntes()) return;

    const hoje = new Date().toLocaleDateString("pt-BR");
    const safe = (s: string) =>
      (s || "").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

    const linhasTabela = acoesProposta
      .map((a) => {
        const unit = valorBaseDaLinha(a);
        const meses = qtdMeses(a.mesesSelecionados);
        const lojas = Math.max(1, Math.floor(Number(a.lojas) || 0));
        const bruto = unit * meses * lojas;
        const d = clamp(Number(a.desconto) || 0, 0, 100);
        const final = Math.max(0, bruto - (bruto * d) / 100);

        return `
        <tr>
          <td>${safe(a.area || "")}</td>
          <td>
            <div style="font-weight:700;">${safe(a.nome || "")}</div>
            ${
              a.observacoes
                ? `<div style="color:#6b7280;font-size:12px;margin-top:4px;">${safe(
                    a.observacoes
                  )}</div>`
                : ""
            }
          </td>
          <td style="text-align:right;">${
            unit > 0 ? moeda(unit) : "Sob consulta"
          }</td>
          <td>${safe(mesesTexto(a.mesesSelecionados || []))}</td>
          <td style="text-align:center;">${meses}</td>
          <td style="text-align:center;">${lojas}</td>
          <td style="text-align:center;">${d}%</td>
          <td style="text-align:right;font-weight:800;color:#0f766e;">${moeda(
            final
          )}</td>
        </tr>
      `;
      })
      .join("");

    const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Proposta - ${safe(nomeProposta)}</title>
  <style>
    *{ box-sizing:border-box; font-family: Inter, Arial, sans-serif; }
    body{ margin:0; padding:28px; background:#fff; color:#111827; }
    .header{
      display:flex; align-items:center; justify-content:space-between;
      padding:18px; border:1px solid #e5e7eb; border-radius:14px;
      background:linear-gradient(90deg,#0b3a8a,#1e40af);
      color:white;
    }
    .brand{ display:flex; align-items:center; gap:14px; }
    .brand img{ height:54px; width:auto; border-radius:8px; background:white; padding:6px; }
    .brand .t1{ font-size:16px; font-weight:800; line-height:1.1; }
    .brand .t2{ font-size:11px; letter-spacing:2px; text-transform:uppercase; opacity:.9; margin-top:2px; }
    .title{ text-align:right; }
    .title .p1{ font-size:18px; font-weight:900; }
    .title .p2{ font-size:12px; opacity:.9; margin-top:3px; }

    .meta{
      margin-top:14px; display:flex; justify-content:space-between; gap:12px;
      padding:14px 16px; border:1px solid #e5e7eb; border-radius:14px;
      background:#f9fafb;
    }
    .meta b{ font-weight:800; }

    table{ width:100%; border-collapse:collapse; margin-top:16px; }
    th, td{ border:1px solid #e5e7eb; padding:10px; vertical-align:top; }
    th{ background:#f3f4f6; text-transform:uppercase; font-size:11px; letter-spacing:1px; color:#374151; text-align:left; }
    td{ font-size:13px; }

    .total{ margin-top:14px; display:flex; justify-content:flex-end; }
    .totalBox{
      min-width:320px;
      padding:14px 16px; border-radius:14px;
      background:linear-gradient(90deg,#10b981,#0f766e);
      color:white; font-weight:900; font-size:18px;
      display:flex; justify-content:space-between; gap:18px;
    }
    .footer{ margin-top:18px; text-align:center; color:#6b7280; font-size:11px; }

    @media print {
      body{ padding:0; }
      .header, .totalBox{ -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">
      <img src="/logo-sao-joao.png" alt="Logo"/>
      <div>
        <div class="t1">Farmácias São João</div>
        <div class="t2">Trade Marketing</div>
      </div>
    </div>
    <div class="title">
      <div class="p1">PROPOSTA COMERCIAL</div>
      <div class="p2">${safe(nomeProposta)} • ${safe(hoje)}</div>
    </div>
  </div>

  <div class="meta">
    <div><b>Indústria/Proposta:</b> ${safe(nomeProposta)}</div>
    <div><b>Quantidade de ações:</b> ${acoesProposta.length}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:11%;">Área</th>
        <th>Ação</th>
        <th style="width:10%;">Valor Unit.</th>
        <th style="width:12%;">Meses</th>
        <th style="width:7%;">Qtd</th>
        <th style="width:9%;">Lojas</th>
        <th style="width:9%;">Desc</th>
        <th style="width:12%;">Valor Final</th>
      </tr>
    </thead>
    <tbody>
      ${linhasTabela}
    </tbody>
  </table>

  <div class="total">
    <div class="totalBox">
      <div>TOTAL</div>
      <div>${moeda(total)}</div>
    </div>
  </div>

  <div class="footer">
    Documento gerado pela Plataforma de Propostas • Farmácias São João • Trade Marketing
  </div>

  <script>window.onload = () => window.print();</script>
</body>
</html>
`;

    const w = window.open("", "_blank");
    if (!w) {
      alert("Bloqueador de pop-up ativo. Permita pop-ups para exportar PDF.");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
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
            onChange={(e) => {
              setNomeProposta(e.target.value);
              markDirty();
            }}
            placeholder="Ex: Nivea"
            className="mt-2 w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {(dirty || sessionStorage.getItem("dirty_proposta") === "1") && (
            <div className="mt-2 text-xs text-amber-700 font-semibold">
              Você tem alterações não salvas.
            </div>
          )}
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

      {/* ✅ Rodapé com exportações */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={exportarExcelXLS}
          className="px-6 py-3 rounded-xl bg-white border border-gray-200 font-semibold hover:bg-gray-50"
        >
          Exportar Excel
        </button>

        <button
          type="button"
          onClick={exportarPDF}
          className="px-6 py-3 rounded-xl bg-white border border-gray-200 font-semibold hover:bg-gray-50"
        >
          Exportar PDF
        </button>

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
