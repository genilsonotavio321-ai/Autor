import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useUiStore } from "@/shared/store/ui-store";

import { SprintTicker } from "./sprint-ticker";
import { SprintTimer } from "./sprint-timer";

vi.mock("../infra/writing-log-repository", () => ({
  recordSprint: vi.fn(async () => undefined),
}));

vi.mock("@/shared/lib/sound", () => ({
  playSound: vi.fn(),
}));

function clock(): string {
  return screen.getByTestId("sprint-timer").textContent ?? "";
}

function renderTimer() {
  render(
    <>
      <SprintTimer />
      <SprintTicker />
    </>,
  );
}

describe("SprintTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useUiStore.setState({
      sprintMinutes: 25,
      sprintRemaining: 25 * 60,
      sprintRunning: false,
      sprintCompleted: 0,
      sprintAnnouncement: "",
      sprintFocusEngaged: false,
      focusMode: false,
      soundEnabled: false,
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("pausar mantém o restante (não reinicia)", () => {
    renderTimer();

    fireEvent.click(screen.getByLabelText("Iniciar sprint"));
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(clock()).toBe("24:57");

    fireEvent.click(screen.getByLabelText("Pausar sprint"));
    expect(clock()).toBe("24:57");

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(clock()).toBe("24:57");
  });

  it("trocar a duração com o timer pausado reseta para a nova duração", () => {
    renderTimer();

    fireEvent.click(screen.getByLabelText("Iniciar sprint"));
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    fireEvent.click(screen.getByLabelText("Pausar sprint"));

    act(() => {
      useUiStore.setState({ sprintMinutes: 50 });
    });
    expect(clock()).toBe("50:00");
  });

  it("iniciar sprint liga o focus mode; pausar restaura", () => {
    renderTimer();

    fireEvent.click(screen.getByLabelText("Iniciar sprint"));
    expect(useUiStore.getState().focusMode).toBe(true);

    fireEvent.click(screen.getByLabelText("Pausar sprint"));
    expect(useUiStore.getState().focusMode).toBe(false);
  });

  it("iniciar sprint com focus mode manual ligado não desliga ao pausar", () => {
    useUiStore.setState({ focusMode: true });
    renderTimer();

    fireEvent.click(screen.getByLabelText("Iniciar sprint"));
    expect(useUiStore.getState().focusMode).toBe(true);

    fireEvent.click(screen.getByLabelText("Pausar sprint"));
    expect(useUiStore.getState().focusMode).toBe(true);
  });

  it("concluir o sprint zera o running e registra o foco como restaurado", () => {
    useUiStore.setState({ sprintRemaining: 3 });
    renderTimer();

    fireEvent.click(screen.getByLabelText("Iniciar sprint"));
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    const state = useUiStore.getState();
    expect(state.sprintRunning).toBe(false);
    expect(state.sprintCompleted).toBe(1);
    expect(state.focusMode).toBe(false);
    expect(state.sprintRemaining).toBe(25 * 60);
  });
});
