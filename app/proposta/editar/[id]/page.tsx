"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

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
  lojas: number; // agora entra no cálculo dependendo do tipo
  valorFinal: number;

  // controle interno pra "sob consulta"
  valorDigitado?: number; // se valor base = 0 e usuário digitou algo
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

export default function EditarPropostaPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const propostaId = params?.id;

  const [carregando, setCarregando] = useState(true);

  const [nomeProposta, setNomeProposta] = useState("");
  const [acoesBase, setAcoesBase] = useState<Acao[]>([]);
  const [acoesProposta, setAcoesProposta] = useState<AcaoProposta[]>([]);
  const [acaoSelecionada, setAcaoSelecionada] = useState("");

  const moeda = (v: number) =>
    (Number(v) || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

  const contarMeses = (arr: number[]) => (Array.isArray(arr) ? arr.length : 0);

  const mesesTexto = (arr: number[]) =>
    (arr || [])
      .slice()
      .sort((a, b) => a - b)
      .map((i) => MESES[i])
      .join(", ");

  const normalizarNumero = (x: any) => {
    const n = Number(x);
    return Number.isFinite(n) ? n : 0;
  };

  // ✅ define quais ações usam "lojas" e quais usam "quantidade"
  // Regra: se for PDV ou Mídia Impressa - Lâmina Exclusiva => usa "Lojas"
  // Nas demais => usa "Quantidade"
  const usaLojas = (a: { area?: string; nome?: string }) => {
    const area = (a.area || "").toLowerCase();
    const nome = (a.nome || "").toLowerCase();

    const isPDV = area.includes("pdv");
    const isMidiaImpressa =
      area.includes("mídia impressa") || area.includes("midia impressa");
    const isLaminaExclusiva =
      nome.includes("lâmina exclusiva") || nome.includes("lamina exclusiva");

    return isPDV || (isMidiaImpressa && isLaminaExclusiva);
  };

  // ✅ valor unitário: se base for 0, usa valorDigitado
  const valorUnitarioDaLinha = (a: AcaoProposta) => {
    const base = normalizarNumero(a.valor);
    if (base > 0) return base;

    const digitado = normalizarNumero(a.valorDigitado);
    return digitado > 0 ? digitado : 0;
  };

  // ✅ multiplicador: lojas/quantidade (mínimo 1)
  const multiplicadorDaLinha = (a: AcaoProposta) => {
    const q = Math.max(1, Math.floor(normalizarNumero(a.lojas) || 0));
    return q;
  };

  // ✅ cálculo final: (valorUnitário * meses * (lojas/quantidade)) - desconto
  const recalcularValorFinal = (a: AcaoProposta) => {
    const valorUnit = valorUnitarioDaLinha(a);
    const meses = contarMeses(a.mesesSelecionados);
    const mult = multiplicadorDaLinha(a);

    const bruto = valorUnit * meses * mult;

    const d = Math.min(Math.max(normalizarNumero(a.desconto) || 0, 0), 100);
    const final = bruto - (bruto * d) / 100;

    return Math.max(0, final);
  };

  const total = useMemo(() => {
    return acoesProposta.reduce(
      (soma, a) => soma + (normalizarNumero(a.valorFinal) || 0),
      0
    );
  }, [acoesProposta]);

  // ✅ Carrega ações base + proposta
  useEffect(() => {
    if (!propostaId) return;

    // ações base
    try {
      const salvas = localStorage.getItem("acoes");
      const parsed = salvas ? JSON.parse(salvas) : [];
      setAcoesBase(Array.isArray(parsed) ? parsed : []);
    } catch {
      setAcoesBase([]);
    }

    // proposta
    try {
      const propostas = JSON.parse(localStorage.getItem("propostas") || "[]");
      const achou = propostas.find((p: any) => p.id === propostaId);

      if (!achou) {
        alert("Proposta não encontrada.");
        router.push("/proposta");
        return;
      }

      setNomeProposta(String(achou.nome || ""));

      const acoes: any[] = Array.isArray(achou.acoes) ? achou.acoes : [];

      const normalizadas: AcaoProposta[] = acoes.map((a) => {
        const raw: any = a;

        const meses = Array.isArray(raw.mesesSelecionados)
          ? raw.mesesSelecionados
              .map((x: any) => Number(x))
              .filter((x: any) => Number.isFinite(x))
          : [];

        const desconto = normalizarNumero(raw.desconto) || 0;

        // ✅ lê lojas de qualquer nome antigo possível
        const lojasRaw =
          raw.lojas ??
          raw.qtdLojas ??
          raw.quantidadeLojas ??
          raw.lojasQuantidade ??
          raw.lojasInfo ??
          0;

        const lojas = Math.max(0, Math.floor(normalizarNumero(lojasRaw) || 0));

        const valorBase = normalizarNumero(raw.valor) || 0;
        const valorDigitado = normalizarNumero(raw.valorDigitado) || 0;

        const item: AcaoProposta = {
          id: String(raw.id || crypto.randomUUID()),
          area: String(raw.area || "—"),
          nome: String(raw.nome || "—"),
          valor: valorBase,
          observacoes: raw.observacoes ? String(raw.observacoes) : "",
          mesesSelecionados: meses,
          desconto,
          lojas,
          valorDigitado: valorBase > 0 ? undefined : valorDigitado,
          valorFinal: 0, // recalcula abaixo
        };

        return { ...item, valorFinal: recalcularValorFinal(item) };
      });

      setAcoesProposta(normalizadas);
    } catch {
      alert("Erro ao carregar proposta.");
      router.push("/proposta");
      return;
    } finally {
      setCarregando(false);
    }
  }, [propostaId, router]);

  // ✅ adicionar ação
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
      valorDigitado: Number(acao.valor) > 0 ? undefined : 0,
      valorFinal: 0,
    };

    nova.valorFinal = recalcularValorFinal(nova);

    setAcoesProposta((prev) => [...prev, nova]);
    setAcaoSelecionada("");
  };

  const removerAcao = (index: number) => {
    setAcoesProposta((prev) => prev.filter((_, i) => i !== index));
  };

  // ✅ meses clicáveis (imutável, estável)
  const toggleMes = (index: number, mesIndex: number) => {
    setAcoesProposta((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;

        const atual = Array.isArray(item.mesesSelecionados)
          ? item.mesesSelecionados
          : [];

        const set = new Set<number>(atual.map(Number));

        if (set.has(mesIndex)) set.delete(mesIndex);
        else set.add(mesIndex);

        const meses = Array.from(set).sort((a, b) => a - b);

        const atualizado = { ...item, mesesSelecionados: meses };
        return { ...atualizado, valorFinal: recalcularValorFinal(atualizado) };
      })
    );
  };

  const alterarDesconto = (index: number, descontoPercentual: number) => {
    setAcoesProposta((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;

        const d = Math.min(
          Math.max(normalizarNumero(descontoPercentual) || 0, 0),
          100
        );
        const atualizado = { ...item, desconto: d };
        return { ...atualizado, valorFinal: recalcularValorFinal(atualizado) };
      })
    );
  };

  // ✅ lojas/quantidade (sempre salva em "lojas")
  const alterarLojas = (index: number, lojas: number) => {
    setAcoesProposta((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;

        const l = Math.max(0, Math.floor(normalizarNumero(lojas) || 0));
        const atualizado = { ...item, lojas: l };
        return { ...atualizado, valorFinal: recalcularValorFinal(atualizado) };
      })
    );
  };

  // ✅ valor digitável quando valor base é 0
  const alterarValorDigitado = (index: number, valor: number) => {
    setAcoesProposta((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;

        const v = Math.max(0, normalizarNumero(valor) || 0);
        const atualizado = { ...item, valorDigitado: v };
        return { ...atualizado, valorFinal: recalcularValorFinal(atualizado) };
      })
    );
  };

  // ✅ Exportar Excel BONITO (.xls via HTML) — igual ao da Nova Proposta
  const exportarExcelXLS = () => {
    if (!nomeProposta.trim()) {
      alert("Informe o nome da proposta antes de exportar.");
      return;
    }
    if (acoesProposta.length === 0) {
      alert("Adicione ao menos uma ação antes de exportar.");
      return;
    }

    const hoje = new Date().toLocaleDateString("pt-BR");

    const linhas = acoesProposta
      .map((a, i) => {
        const unit = valorUnitarioDaLinha(a);
        const label = usaLojas(a) ? "Lojas" : "Quantidade";
        const mult = multiplicadorDaLinha(a);

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
            <td style="text-align:center;">${contarMeses(
              a.mesesSelecionados || []
            )}</td>
            <td style="text-align:center;">${mult}</td>
            <td style="text-align:center;">${a.desconto ?? 0}%</td>
            <td style="text-align:right;font-weight:bold;color:#047857;">
              ${moeda(a.valorFinal)}
            </td>
            <td>${label}</td>
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
      <th>Lojas/Qtd</th>
      <th>Desc.</th>
      <th>Valor Final</th>
      <th>Tipo</th>
    </tr>
  </thead>
  <tbody>
    ${linhas}
    <tr class="total">
      <td colspan="7" style="text-align:right;">TOTAL</td>
      <td style="text-align:right;">${moeda(total)}</td>
      <td></td>
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

  // ✅ Exportar PDF profissional
  const exportarPDF = () => {
    if (!nomeProposta.trim()) {
      alert("Informe o nome da proposta antes de exportar.");
      return;
    }
    if (acoesProposta.length === 0) {
      alert("Adicione ao menos uma ação antes de exportar.");
      return;
    }

    const hoje = new Date().toLocaleDateString("pt-BR");
    const safe = (s: string) =>
      (s || "").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

    const linhasTabela = acoesProposta
      .map((a) => {
        const unit = valorUnitarioDaLinha(a);
        const multLabel = usaLojas(a) ? "Lojas" : "Quantidade";
        const mult = multiplicadorDaLinha(a);

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
          <td style="text-align:center;">${contarMeses(
            a.mesesSelecionados || []
          )}</td>
          <td style="text-align:center;">${mult} <span style="color:#6b7280;font-size:11px;">(${multLabel})</span></td>
          <td style="text-align:center;">${a.desconto ?? 0}%</td>
          <td style="text-align:right;font-weight:800;color:#0f766e;">${moeda(
            a.valorFinal
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
        <th style="width:12%;">Lojas/Qtd</th>
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

  // ✅ salvar alterações
  const salvarAlteracoes = () => {
    if (!nomeProposta.trim()) {
      alert("Informe o nome da proposta / indústria.");
      return;
    }

    if (acoesProposta.length === 0) {
      alert("Adicione ao menos uma ação.");
      return;
    }

    const temSemMes = acoesProposta.some(
      (a) => contarMeses(a.mesesSelecionados) === 0
    );
    if (temSemMes) {
      alert(
        "Existe ação sem meses selecionados. Selecione ao menos 1 mês por ação."
      );
      return;
    }

    // se existir ação sob consulta sem valor digitado
    const temSobConsultaSemValor = acoesProposta.some(
      (a) =>
        normalizarNumero(a.valor) <= 0 && normalizarNumero(a.valorDigitado) <= 0
    );
    if (temSobConsultaSemValor) {
      alert(
        "Existe ação 'sob consulta' sem valor informado. Digite o valor para continuar."
      );
      return;
    }

    const propostas = JSON.parse(localStorage.getItem("propostas") || "[]");
    const idx = propostas.findIndex((p: any) => p.id === propostaId);

    if (idx < 0) {
      alert("Proposta não encontrada para salvar.");
      return;
    }

    const acoesNormalizadas = acoesProposta.map((a) => {
      const lojas = Math.max(0, Math.floor(normalizarNumero(a.lojas) || 0));
      const desconto = Math.min(
        Math.max(normalizarNumero(a.desconto) || 0, 0),
        100
      );
      const meses = Array.isArray(a.mesesSelecionados)
        ? a.mesesSelecionados
        : [];

      const valorBase = normalizarNumero(a.valor) || 0;
      const valorDigitado =
        valorBase > 0
          ? undefined
          : Math.max(0, normalizarNumero(a.valorDigitado) || 0);

      const item: AcaoProposta = {
        ...a,
        lojas,
        desconto,
        mesesSelecionados: meses,
        valor: valorBase,
        valorDigitado,
        valorFinal: 0,
      };

      return { ...item, valorFinal: recalcularValorFinal(item) };
    });

    const atualizada: Proposta = {
      id: propostaId as string,
      nome: nomeProposta.trim(),
      dataCriacao: propostas[idx]?.dataCriacao || new Date().toISOString(),
      acoes: acoesNormalizadas,
      total: acoesNormalizadas.reduce(
        (s, x) => s + (normalizarNumero(x.valorFinal) || 0),
        0
      ),
    };

    propostas[idx] = atualizada;
    localStorage.setItem("propostas", JSON.stringify(propostas));

    alert("Proposta atualizada com sucesso!");
    router.push("/proposta");
  };

  if (carregando) return <div className="p-6">Carregando...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Editar Proposta</h1>
          <p className="text-sm text-gray-500">
            PDV e Mídia Impressa (Lâmina Exclusiva) usam <b>Lojas</b>. As demais
            usam <b>Quantidade</b>. Ambos entram no cálculo.
          </p>
        </div>

        <Link
          href="/proposta"
          className="text-sm font-semibold px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
        >
          Voltar
        </Link>
      </div>

      {/* Nome */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <label className="text-xs uppercase tracking-wide text-gray-400 font-semibold">
          Nome da indústria / proposta
        </label>
        <input
          value={nomeProposta}
          onChange={(e) => setNomeProposta(e.target.value)}
          placeholder="Ex: Nivea"
          className="mt-2 w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
        />
      </div>

      {/* Adicionar ação */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="flex gap-3">
          <select
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2"
            value={acaoSelecionada}
            onChange={(e) => setAcaoSelecionada(e.target.value)}
          >
            <option value="">Selecione uma ação</option>
            {acoesBase.map((a) => (
              <option key={a.id} value={a.id}>
                {a.area} — {a.nome} (
                {a.valor > 0 ? moeda(a.valor) : "Sob consulta"})
              </option>
            ))}
          </select>

          <button
            onClick={adicionarAcao}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700"
          >
            Adicionar
          </button>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
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
                Valor Unit.
              </th>
              <th className="border-b border-gray-100 p-3 text-left text-xs uppercase tracking-wide text-gray-500 font-semibold">
                Meses
              </th>
              <th className="border-b border-gray-100 p-3 text-left text-xs uppercase tracking-wide text-gray-500 font-semibold">
                Lojas / Quantidade
              </th>
              <th className="border-b border-gray-100 p-3 text-left text-xs uppercase tracking-wide text-gray-500 font-semibold">
                Desconto
              </th>
              <th className="border-b border-gray-100 p-3 text-left text-xs uppercase tracking-wide text-gray-500 font-semibold">
                Valor Final
              </th>
              <th className="border-b border-gray-100 p-3" />
            </tr>
          </thead>

          <tbody>
            {acoesProposta.map((a, i) => {
              const qtdMeses = contarMeses(a.mesesSelecionados);
              const labelMult = usaLojas(a) ? "Lojas" : "Quantidade";
              const unit = valorUnitarioDaLinha(a);
              const isSobConsulta = normalizarNumero(a.valor) <= 0;

              return (
                <tr
                  key={i}
                  className="border-t border-gray-100 hover:bg-gray-50/70 transition-colors align-top"
                >
                  <td className="border-b border-gray-100 p-3 text-gray-700">
                    {a.area}
                  </td>

                  <td className="border-b border-gray-100 p-3 font-semibold text-gray-900">
                    {a.nome}
                    {a.observacoes ? (
                      <div className="text-xs text-gray-500 mt-1">
                        {a.observacoes}
                      </div>
                    ) : null}
                  </td>

                  {/* Valor Unitário */}
                  <td className="border-b border-gray-100 p-3 text-gray-700">
                    {isSobConsulta ? (
                      <div className="space-y-1">
                        <div className="text-xs text-gray-500 font-semibold">
                          Sob consulta — informe o valor:
                        </div>
                        <input
                          type="number"
                          min={0}
                          value={a.valorDigitado ?? 0}
                          onChange={(e) =>
                            alterarValorDigitado(i, Number(e.target.value))
                          }
                          className="w-36 border border-gray-200 rounded px-2 py-1 text-gray-900"
                          placeholder="Ex: 2500"
                        />
                        <div className="text-xs text-gray-500">
                          Atual: <b>{unit > 0 ? moeda(unit) : "—"}</b>
                        </div>
                      </div>
                    ) : (
                      moeda(a.valor)
                    )}
                  </td>

                  {/* Meses */}
                  <td className="border-b border-gray-100 p-3">
                    <div className="grid grid-cols-6 gap-2">
                      {MESES.map((m, idx) => {
                        const checked = a.mesesSelecionados?.includes(idx);
                        return (
                          <label
                            key={m}
                            className={[
                              "flex items-center gap-2 rounded-lg border px-2 py-1 text-sm cursor-pointer select-none",
                              checked
                                ? "bg-blue-600 text-white border-blue-600"
                                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50",
                            ].join(" ")}
                          >
                            <input
                              type="checkbox"
                              checked={!!checked}
                              onChange={() => toggleMes(i, idx)}
                              className="hidden"
                            />
                            <span className="font-semibold">{m}</span>
                          </label>
                        );
                      })}
                    </div>

                    <div className="mt-2 text-xs text-gray-500">
                      Selecionados: <b>{qtdMeses}</b> • Base:{" "}
                      <b>
                        {moeda(
                          valorUnitarioDaLinha(a) *
                            qtdMeses *
                            Math.max(1, Math.floor(a.lojas || 0))
                        )}
                      </b>
                    </div>
                  </td>

                  {/* Lojas / Quantidade */}
                  <td className="border-b border-gray-100 p-3">
                    <div className="text-xs text-gray-500 font-semibold mb-1">
                      {labelMult}
                    </div>
                    <input
                      type="number"
                      min={1}
                      value={a.lojas ?? 1}
                      onChange={(e) => alterarLojas(i, Number(e.target.value))}
                      className="w-24 border border-gray-200 rounded px-2 py-1 text-gray-900"
                      placeholder="Ex: 120"
                    />
                  </td>

                  {/* Desconto */}
                  <td className="border-b border-gray-100 p-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={a.desconto ?? 0}
                        onChange={(e) =>
                          alterarDesconto(i, Number(e.target.value))
                        }
                        className="w-20 border border-gray-200 rounded px-2 py-1 text-gray-900"
                      />
                      <span className="text-gray-700 font-semibold">%</span>
                    </div>
                  </td>

                  {/* Valor Final */}
                  <td className="border-b border-gray-100 p-3 font-bold text-gray-900">
                    {qtdMeses === 0 ? "—" : moeda(a.valorFinal)}
                  </td>

                  <td className="border-b border-gray-100 p-3">
                    <button
                      onClick={() => removerAcao(i)}
                      className="text-red-600 font-semibold hover:underline"
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              );
            })}

            {acoesProposta.length === 0 && (
              <tr>
                <td colSpan={8} className="p-8 text-center text-gray-500">
                  Nenhuma ação adicionada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Rodapé */}
      <div className="flex items-center justify-between gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-gray-400 font-semibold">
            Resumo
          </div>
          <div className="mt-2 text-sm text-gray-600">
            <span className="font-semibold text-gray-800">Ações:</span>{" "}
            {acoesProposta.length}
          </div>
        </div>

        <div className="text-right">
          <div className="text-xl font-bold text-gray-900">
            Total: {moeda(total)}
          </div>

          <div className="flex gap-3 justify-end mt-3">
            <button
              onClick={exportarExcelXLS}
              className="px-5 py-3 rounded-xl bg-white border border-gray-200 font-semibold hover:bg-gray-50"
            >
              Exportar Excel
            </button>

            <button
              onClick={exportarPDF}
              className="px-5 py-3 rounded-xl bg-white border border-gray-200 font-semibold hover:bg-gray-50"
            >
              Exportar PDF
            </button>

            <button
              onClick={salvarAlteracoes}
              className="px-6 py-3 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700"
            >
              Salvar Alterações
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
