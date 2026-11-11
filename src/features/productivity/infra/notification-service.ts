import { toast } from "sonner";

import { getWritingLog } from "./writing-log-repository";
import { getDatabase } from "@/infra/db";
import { useUiStore } from "@/shared/store/ui-store";

import {
  decideGoalNotification,
  decideStaleNotifications,
  latestCreatedAt,
  type NotificationDecision,
  type StaleFlags,
} from "../domain/notifications";
import { toDayKey } from "../domain/writing-log";

/** Estado de dedup por tipo (um aviso por tipo por dia). */
const STATE_KEY = "autor.notifications.state";

type StaleKind = "character" | "scene" | "chapter";
type SentToday = Partial<Record<NotificationDecision["kind"], string>>;

function readSentToday(): SentToday {
  try {
    const raw = window.localStorage.getItem(STATE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as SentToday) : {};
  } catch {
    return {};
  }
}

function writeSentToday(state: SentToday) {
  try {
    window.localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    // Sem storage: dedup fica só na memória da sessão (aceitável).
  }
}

function deliver(message: string) {
  if (
    typeof Notification !== "undefined" &&
    Notification.permission === "granted"
  ) {
    try {
      new Notification("Autor", { body: message });
      return;
    } catch {
      // Alguns browsers exigem service worker; cai no toast.
    }
  }
  toast.info(message);
}

/** Pede permissão do sistema quando o usuário liga a opção nas configurações. */
export async function requestNotificationPermission(): Promise<
  "granted" | "denied" | "unavailable"
> {
  if (typeof Notification === "undefined") return "unavailable";
  try {
    const result = await Notification.requestPermission();
    return result === "granted" ? "granted" : "denied";
  } catch {
    return "denied";
  }
}

/** Última criação viva de cada tipo (personagens, cenas, capítulos). */
async function latestCreations(): Promise<
  Record<StaleKind, string | undefined>
> {
  const db = getDatabase();
  const [characters, scenes, chapters] = await Promise.all([
    db.characters.filter((row) => !row.deletedAt).toArray(),
    db.scenes.filter((row) => !row.deletedAt).toArray(),
    db.chapters.filter((row) => !row.deletedAt).toArray(),
  ]);
  return {
    character: latestCreatedAt(characters.map((row) => row.createdAt)),
    scene: latestCreatedAt(scenes.map((row) => row.createdAt)),
    chapter: latestCreatedAt(chapters.map((row) => row.createdAt)),
  };
}

/**
 * Decide e entrega os avisos do momento (respeitando 1 aviso por tipo por
 * dia); devolve as mensagens exibidas (útil para testes e debug).
 */
export async function checkWritingNotifications(): Promise<string[]> {
  const state = useUiStore.getState();
  if (!state.notificationsEnabled) return [];

  const todayKey = toDayKey(new Date());
  const log = await getWritingLog();
  const wordsToday = log[todayKey]?.words ?? 0;

  const decisions: NotificationDecision[] = [];
  if (state.notifyGoalNotMet) {
    const goal = decideGoalNotification(
      wordsToday,
      state.dailyWordGoal,
      new Date(),
    );
    if (goal) decisions.push(goal);
  }
  const flags: StaleFlags = {
    character: state.notifyNoNewCharacters,
    scene: state.notifyNoNewScenes,
    chapter: state.notifyNoNewChapters,
  };
  if (flags.character || flags.scene || flags.chapter) {
    const latest = await latestCreations();
    decisions.push(
      ...decideStaleNotifications(
        latest,
        state.notificationsStaleDays,
        new Date(),
        flags,
      ),
    );
  }

  const sent = readSentToday();
  const day = todayKey;
  const messages: string[] = [];
  for (const decision of decisions) {
    if (sent[decision.kind] === day) continue;
    sent[decision.kind] = day;
    messages.push(decision.body);
  }
  if (messages.length > 0) {
    writeSentToday(sent);
    for (const message of messages) deliver(message);
  }
  return messages;
}

/** Roda a checagem uma vez, engolindo falhas (Idb indisponível etc.). */
export async function runNotificationCheck(): Promise<void> {
  try {
    await checkWritingNotifications();
  } catch {
    // Tenta de novo no próximo ciclo do monitor.
  }
}
