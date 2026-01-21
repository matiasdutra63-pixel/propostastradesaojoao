"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";

const ADMIN_EMAIL = "matias.dutra@farmaciassaojoao.com.br";

export default function ClientShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  // ✅ Estado inicial neutro (server == client)
  const [ready, setReady] = useState(false);
  const [logado, setLogado] = useState(false);
  const [email, setEmail] = useState("");

  const isAuthPage = useMemo(() => {
    return pathname === "/login" || pathname === "/cadastro";
  }, [pathname]);

  useEffect(() => {
    const l = localStorage.getItem("logado") === "true";
    const e = localStorage.getItem("email") || "";

    setLogado(l);
    setEmail(e);
    setReady(true);

    // ✅ Bloqueia acesso ao app sem login (redirect no client)
    if (!l && !isAuthPage) {
      router.replace("/login");
    }
  }, [isAuthPage, router]);

  // ✅ Em /login e /cadastro, não mostra nada de dashboard
  if (isAuthPage) return <>{children}</>;

  // ✅ Antes de estar pronto, renderiza SÓ o conteúdo (mesmo no server e client)
  // Isso evita mismatch.
  if (!ready) return <>{children}</>;

  // ✅ Se não logado e não é auth page: deixa “vazio” (redirect já foi disparado)
  if (!logado) return <div className="min-h-screen bg-gray-50" />;

  const nomeUsuario = email.includes("@") ? email.split("@")[0] : email;
  const isAdmin = email === ADMIN_EMAIL;

  const NavItem = ({ href, label }: { href: string; label: string }) => {
    const active = pathname === href || pathname?.startsWith(href + "/");
    return (
      <Link
        href={href}
        className={[
          "block rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
          active ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-100",
        ].join(" ")}
      >
        {label}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-72 border-r border-gray-200 bg-white min-h-screen p-4">
          {/* Brand */}
          <div className="flex items-center gap-4 mb-6">
            <img
              src="/logo-sao-joao.png"
              alt="Farmácias São João"
              className="h-16 w-auto"
            />
            <div className="leading-tight">
              <div className="text-base font-semibold text-gray-800">
                Farmácias São João
              </div>
              <div className="text-[11px] tracking-wide text-gray-500 uppercase">
                Trade Marketing
              </div>
            </div>
          </div>

          {/* User chip */}
          <div className="mb-5 rounded-2xl border border-gray-200 bg-gray-50 p-3">
            <div className="text-xs uppercase tracking-wide text-gray-400 font-semibold">
              Usuário
            </div>
            <div className="mt-1 text-sm font-semibold text-gray-800">
              {nomeUsuario} {isAdmin ? "(admin)" : ""}
            </div>
            <div className="mt-1 text-xs text-gray-500">{email}</div>
          </div>

          {/* Menu */}
          <div className="space-y-2">
            <NavItem href="/proposta" label="Minhas Propostas" />
            <NavItem href="/propostas/nova" label="Nova Proposta" />
            <NavItem href="/acoes" label="Ações" />
          </div>

          {/* Sair */}
          <button
            onClick={() => {
              localStorage.removeItem("logado");
              localStorage.removeItem("email");
              router.replace("/login");
            }}
            className="mt-6 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
          >
            Sair
          </button>
        </aside>

        {/* Conteúdo */}
        <main className="flex-1">
          {/* Topbar */}
          <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6">
            <div className="text-sm font-semibold text-gray-700">
              {nomeUsuario}
              {isAdmin ? " (admin)" : ""}
            </div>

            <div className="text-xs text-gray-500">
              Plataforma de Propostas • Trade Marketing
            </div>
          </div>

          <div className="p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
