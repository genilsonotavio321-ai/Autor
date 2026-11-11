"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

import { ensureDbReady } from "./ready";

/**
 * Roda as migrações pendentes do Dexie antes de montar a aplicação.
 *
 * As migrações abrem transações de escrita. O `liveQuery` executa o querier
 * dentro de uma transação somente-leitura e o Dexie recusa escrita ali
 * ("Readwrite transaction in liveQuery context"). Como o shell monta buscas,
 * lixeira e notificações (todos com `useLiveQuery`) assim que aparece, o banco
 * precisa estar pronto antes de qualquer consulta existir.
 */
export function DbReadyGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;
    ensureDbReady().then(
      () => {
        if (active) setStatus("ready");
      },
      (error) => {
        console.error("Falha ao preparar o banco local", error);
        if (active) setStatus("error");
      },
    );
    return () => {
      active = false;
    };
  }, []);

  if (status === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">Preparando seus dados…</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm font-medium">
          Não foi possível abrir os dados locais.
        </p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Recarregue a página para tentar de novo. Se o erro persistir, evite
          limpar os dados do site antes de exportar um backup em outro navegador.
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => window.location.reload()}
        >
          Recarregar
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
