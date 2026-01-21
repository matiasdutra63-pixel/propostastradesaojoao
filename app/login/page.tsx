"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [ready, setReady] = useState(false);

  // ✅ Se já está logado, não deixa ficar no /login
  useEffect(() => {
    const l = localStorage.getItem("logado") === "true";
    if (l) {
      router.replace("/proposta");
      return;
    }
    setReady(true);
  }, [router]);

  function handleLogin() {
    const usuarioSalvo = localStorage.getItem("usuario");

    if (!usuarioSalvo) {
      alert("Usuário não encontrado. Faça o cadastro.");
      return;
    }

    const usuario = JSON.parse(usuarioSalvo);

    if (usuario.email === email && usuario.senha === senha) {
      localStorage.setItem("logado", "true");
      localStorage.setItem("email", email);
      router.replace("/proposta");
    } else {
      alert("Email ou senha incorretos");
    }
  }

  if (!ready) return <div className="min-h-screen bg-gray-50" />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-gray-50 px-4">
      <div className="w-full max-w-sm">
        {/* Card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xl p-7 animate-[fadeUp_.45s_ease-out]">
          {/* Logo + título */}
          <div className="flex flex-col items-center text-center">
            <img
              src="/logo-sao-joao.png"
              alt="Farmácias São João"
              className="h-20 w-auto"
            />
            <div className="mt-3 text-lg font-extrabold text-gray-900 leading-tight">
              Farmácias São João
            </div>
            <div className="mt-1 text-[11px] tracking-[0.25em] uppercase text-gray-500 font-semibold">
              Trade Marketing
            </div>
          </div>

          {/* Form */}
          <div className="mt-6 space-y-3">
            <div>
              <label className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
                Email
              </label>
              <input
                type="email"
                placeholder="seuemail@farmaciassaojoao.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
                Senha
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              onClick={handleLogin}
              className="w-full mt-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-2.5 rounded-xl font-semibold shadow-lg hover:shadow-xl hover:from-blue-700 hover:to-indigo-700 transition-all"
            >
              Entrar
            </button>

            <div className="text-center text-sm text-gray-600 pt-2">
              Não tem conta?{" "}
              <a
                href="/cadastro"
                className="text-blue-700 font-semibold hover:underline"
              >
                Cadastre-se
              </a>
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <div className="mt-4 text-center text-xs text-gray-400">
          Plataforma de Propostas • Farmácias São João
        </div>
      </div>

      {/* CSS da animação sem libs */}
      <style jsx global>{`
        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
