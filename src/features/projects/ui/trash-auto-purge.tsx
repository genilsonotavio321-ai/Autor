"use client";

import { useEffect, useRef } from "react";

import {
  TRASH_PURGE_CHECK_INTERVAL_MS,
  useUiStore,
} from "@/shared/store/ui-store";

import { autoPurgeExpiredTrash } from "../application/trash-service";

/**
 * Montar uma vez no AppShell: apaga da lixeira (de verdade) tudo que já
 * passou do tempo de retenção configurado. Roda com atraso curto após abrir
 * (para não disputar o arranque com a IndexedDB) e depois de hora em hora.
 */
export function TrashAutoPurge() {
  const retention = useUiStore((state) => state.trashRetentionMs);
  const intervalRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    const run = () => {
      void autoPurgeExpiredTrash(retention).catch(() => undefined);
    };
    const start = window.setTimeout(() => {
      if (!alive) return;
      run();
      intervalRef.current = window.setInterval(
        run,
        TRASH_PURGE_CHECK_INTERVAL_MS,
      );
    }, 15_000);
    return () => {
      alive = false;
      window.clearTimeout(start);
      if (intervalRef.current !== undefined) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
    };
  }, [retention]);

  return null;
}
