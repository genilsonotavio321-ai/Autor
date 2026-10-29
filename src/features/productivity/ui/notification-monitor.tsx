"use client";

import { useEffect } from "react";

import {
  NOTIFICATIONS_CHECK_INTERVAL_MS,
  useUiStore,
} from "@/shared/store/ui-store";

import { runNotificationCheck } from "../infra/notification-service";

/**
 * Montar uma vez no AppShell: roda a checagem de notificações ao abrir o
 * app (com atraso para a IndexedDB respirar) e a cada 15 minutos enquanto
 * o app estiver aberto. Sem a opção ligada nas configurações, não agenda
 * nada. Renderiza nada.
 */
export function NotificationMonitor() {
  const enabled = useUiStore((state) => state.notificationsEnabled);
  const notifyGoalNotMet = useUiStore((state) => state.notifyGoalNotMet);
  const notifyNoNewCharacters = useUiStore(
    (state) => state.notifyNoNewCharacters,
  );
  const notifyNoNewScenes = useUiStore((state) => state.notifyNoNewScenes);
  const notifyNoNewChapters = useUiStore((state) => state.notifyNoNewChapters);
  const staleDays = useUiStore((state) => state.notificationsStaleDays);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const start = window.setTimeout(() => {
      if (alive) void runNotificationCheck();
    }, 20_000);
    const interval = window.setInterval(() => {
      if (alive) void runNotificationCheck();
    }, NOTIFICATIONS_CHECK_INTERVAL_MS);
    return () => {
      alive = false;
      window.clearTimeout(start);
      window.clearInterval(interval);
    };
    // Re-agenda quando a configuração muda (novas flags valem no mesmo dia).
  }, [
    enabled,
    notifyGoalNotMet,
    notifyNoNewCharacters,
    notifyNoNewScenes,
    notifyNoNewChapters,
    staleDays,
  ]);

  return null;
}
