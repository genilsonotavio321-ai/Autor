import { BroadcastChannel } from "broadcast-channel";

const CHANNEL_NAME = "autor:tab";
const HEARTBEAT_MS = 5_000;
const PEER_TIMEOUT_MS = 15_000;

type TabMessageType = "project-open" | "project-close" | "heartbeat";

interface TabMessage {
  type: TabMessageType;
  tabId: string;
  projectId?: string;
}

interface PeerState {
  projects: Set<string>;
  lastSeen: number;
}

type ProjectListener = (otherTabPresent: boolean) => void;

/**
 * Multi-tab coordinator (plan: BroadcastChannel multi-aba).
 * Tracks which projects are open in other tabs so the editor can warn
 * about concurrent edits of the same project.
 */
export class TabCoordinator {
  private readonly tabId: string;
  private readonly channel: BroadcastChannel<TabMessage>;
  private readonly openProjects = new Set<string>();
  private readonly peers = new Map<string, PeerState>();
  private readonly listeners = new Map<string, Set<ProjectListener>>();
  private heartbeatTimer: ReturnType<typeof setInterval> | undefined;

  constructor() {
    this.tabId = crypto.randomUUID();
    this.channel = new BroadcastChannel<TabMessage>(CHANNEL_NAME);
    this.channel.onmessage = (message) => this.handleMessage(message);

    this.heartbeatTimer = setInterval(() => {
      this.prunePeers();
      this.post({ type: "heartbeat" });
    }, HEARTBEAT_MS);

    this.post({ type: "heartbeat" });
  }

  /** Marks a project as open in this tab. Returns an unsubscribe function. */
  subscribeProject(projectId: string, listener: ProjectListener): () => void {
    let set = this.listeners.get(projectId);
    if (!set) {
      set = new Set();
      this.listeners.set(projectId, set);
    }
    set.add(listener);

    if (!this.openProjects.has(projectId)) {
      this.openProjects.add(projectId);
      this.post({ type: "project-open", projectId });
    }
    listener(this.hasOtherTab(projectId));

    return () => {
      set?.delete(listener);
      if (set && set.size === 0) {
        this.listeners.delete(projectId);
        this.openProjects.delete(projectId);
        this.post({ type: "project-close", projectId });
      }
    };
  }

  hasOtherTab(projectId: string): boolean {
    const now = Date.now();
    for (const peer of this.peers.values()) {
      if (now - peer.lastSeen > PEER_TIMEOUT_MS) continue;
      if (peer.projects.has(projectId)) return true;
    }
    return false;
  }

  close(): void {
    if (this.heartbeatTimer !== undefined) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = undefined;
    this.channel.close();
  }

  private post(
    message: Omit<TabMessage, "tabId"> & { projectId?: string },
  ): void {
    void this.channel.postMessage({ ...message, tabId: this.tabId });
  }

  private handleMessage(message: TabMessage): void {
    if (message.tabId === this.tabId) return;

    const peer = this.peers.get(message.tabId) ?? {
      projects: new Set<string>(),
      lastSeen: 0,
    };
    peer.lastSeen = Date.now();

    if (message.type === "project-open" && message.projectId) {
      peer.projects.add(message.projectId);
    }
    if (message.type === "project-close" && message.projectId) {
      peer.projects.delete(message.projectId);
    }
    this.peers.set(message.tabId, peer);

    this.notify(message.projectId);
  }

  private notify(projectId?: string): void {
    const targets = projectId
      ? [projectId]
      : [...this.listeners.keys()];
    for (const id of targets) {
      const present = this.hasOtherTab(id);
      this.listeners.get(id)?.forEach((listener) => listener(present));
    }
  }

  private prunePeers(): void {
    const now = Date.now();
    const stale: string[] = [];
    for (const [id, peer] of this.peers) {
      if (now - peer.lastSeen > PEER_TIMEOUT_MS) stale.push(id);
    }
    for (const id of stale) this.peers.delete(id);
  }
}

let instance: TabCoordinator | undefined;

export function getTabCoordinator(): TabCoordinator {
  instance ??= new TabCoordinator();
  return instance;
}
