import Peer, { type DataConnection } from "peerjs";
import type { Position } from "../types";

export const MAX_ROOM_DEVICES = 5;
const HEARTBEAT_MS = 2000;
const GUEST_TIMEOUT_MS = 6500;
const HOST_TIMEOUT_MS = 6500;

export interface RoomPayload {
  name: string;
  code: string;
  layout: Record<string, Position>;
}

type RoomMessage =
  | { type: "join"; deviceId: string }
  | { type: "leave"; deviceId: string }
  | { type: "ping"; deviceId: string }
  | { type: "edit"; deviceId: string; code: string; layout: Record<string, Position> }
  | {
      type: "welcome";
      targetDeviceId?: string;
      name: string;
      code: string;
      layout: Record<string, Position>;
      devices: number;
      maxDevices: number;
    }
  | {
      type: "sync";
      name: string;
      code: string;
      layout: Record<string, Position>;
      devices: number;
    }
  | { type: "heartbeat"; devices: number }
  | { type: "room-full"; targetDeviceId?: string; maxDevices: number }
  | { type: "room-ended" };

export function createRoomId(): string {
  return `sgs-room-${crypto.randomUUID().slice(0, 8)}`;
}

export function createRoomUrl(roomId: string): string {
  const url = new URL(window.location.href);
  url.hash = `room=${encodeURIComponent(roomId)}`;
  return url.toString();
}

export function getRoomIdFromHash(hash: string): string | undefined {
  if (!hash.startsWith("#room=")) return undefined;
  const raw = decodeURIComponent(hash.slice("#room=".length)).trim();
  return raw || undefined;
}

export interface HostRoomSession {
  roomId: string;
  broadcast: (payload: RoomPayload) => void;
  close: () => void;
}

export function startHostRoom(
  roomId: string,
  getSnapshot: () => RoomPayload,
  callbacks: {
    onDevicesChange: (count: number) => void;
    onGuestEdit: (code: string, layout: Record<string, Position>) => void;
    onError?: (message: string) => void;
  },
): HostRoomSession {
  const guests = new Map<string, { conn?: DataConnection; lastSeen: number }>();
  let closed = false;

  const channel =
    "BroadcastChannel" in window ? new BroadcastChannel(`sgs-room-${roomId}`) : null;

  const notifyCount = () => {
    callbacks.onDevicesChange(1 + guests.size);
  };

  const sendToGuest = (conn: DataConnection | undefined, msg: RoomMessage) => {
    if (conn) {
      if (conn.open) {
        try {
          conn.send(msg);
        } catch {
          // ignore closed channel errors
        }
      }
      return;
    }
    channel?.postMessage(msg);
  };

  const broadcastMessage = (msg: RoomMessage) => {
    guests.forEach(({ conn }) => {
      if (conn && conn.open) {
        try {
          conn.send(msg);
        } catch {
          // ignore closed channel errors
        }
      }
    });
    channel?.postMessage(msg);
  };

  const handleIncoming = (msg: RoomMessage, conn?: DataConnection) => {
    if (closed || !msg || typeof msg !== "object") return;
    if (msg.type === "join") {
      if (!guests.has(msg.deviceId) && 1 + guests.size >= MAX_ROOM_DEVICES) {
        sendToGuest(conn, {
          type: "room-full",
          targetDeviceId: msg.deviceId,
          maxDevices: MAX_ROOM_DEVICES,
        });
        if (conn) {
          window.setTimeout(() => conn.close(), 50);
        }
        return;
      }
      guests.set(msg.deviceId, { conn, lastSeen: Date.now() });
      const snap = getSnapshot();
      sendToGuest(conn, {
        type: "welcome",
        targetDeviceId: msg.deviceId,
        name: snap.name,
        code: snap.code,
        layout: snap.layout,
        devices: 1 + guests.size,
        maxDevices: MAX_ROOM_DEVICES,
      });
      notifyCount();
      return;
    }

    if (msg.type === "ping") {
      const existing = guests.get(msg.deviceId);
      if (existing) {
        existing.lastSeen = Date.now();
        if (conn && !existing.conn) existing.conn = conn;
      }
      return;
    }

    if (msg.type === "leave") {
      if (guests.delete(msg.deviceId)) {
        notifyCount();
        const snap = getSnapshot();
        broadcastMessage({
          type: "sync",
          name: snap.name,
          code: snap.code,
          layout: snap.layout,
          devices: 1 + guests.size,
        });
      }
      return;
    }

    if (msg.type === "edit" && guests.has(msg.deviceId)) {
      const existing = guests.get(msg.deviceId);
      if (existing) existing.lastSeen = Date.now();
      callbacks.onGuestEdit(msg.code, msg.layout);
    }
  };

  if (channel) {
    channel.addEventListener("message", (event: MessageEvent<RoomMessage>) => {
      handleIncoming(event.data);
    });
  }

  let peer: Peer | null = null;
  try {
    peer = new Peer(roomId);
    peer.on("connection", (conn) => {
      let boundDeviceId = "";
      conn.on("data", (data) => {
        const msg = data as RoomMessage;
        if (msg && typeof msg === "object" && "deviceId" in msg && typeof msg.deviceId === "string") {
          boundDeviceId = msg.deviceId;
        }
        handleIncoming(msg, conn);
      });
      conn.on("close", () => {
        if (boundDeviceId && guests.delete(boundDeviceId)) {
          notifyCount();
        }
      });
    });
    peer.on("error", (err) => {
      if (!closed && err.type !== "network" && err.type !== "disconnected") {
        callbacks.onError?.(err.message);
      }
    });
  } catch {
    // BroadcastChannel remains active if WebRTC peer init is unavailable
  }

  const timer = window.setInterval(() => {
    if (closed) return;
    const now = Date.now();
    let changed = false;
    guests.forEach((entry, id) => {
      if (!entry.conn && now - entry.lastSeen > GUEST_TIMEOUT_MS) {
        guests.delete(id);
        changed = true;
      }
    });
    if (changed) notifyCount();
    broadcastMessage({ type: "heartbeat", devices: 1 + guests.size });
  }, HEARTBEAT_MS);

  const close = () => {
    if (closed) return;
    closed = true;
    window.clearInterval(timer);
    window.removeEventListener("pagehide", close);
    window.removeEventListener("beforeunload", close);
    broadcastMessage({ type: "room-ended" });
    guests.forEach(({ conn }) => {
      try {
        conn?.close();
      } catch {
        // ignore
      }
    });
    guests.clear();
    channel?.close();
    try {
      peer?.destroy();
    } catch {
      // ignore
    }
  };

  window.addEventListener("pagehide", close);
  window.addEventListener("beforeunload", close);
  notifyCount();

  return {
    roomId,
    broadcast(payload) {
      if (closed) return;
      broadcastMessage({
        type: "sync",
        name: payload.name,
        code: payload.code,
        layout: payload.layout,
        devices: 1 + guests.size,
      });
    },
    close,
  };
}

export interface GuestRoomSession {
  roomId: string;
  sendEdit: (code: string, layout: Record<string, Position>) => void;
  leave: () => void;
}

export function joinHostRoom(
  roomId: string,
  callbacks: {
    onSync: (payload: RoomPayload, devices: number) => void;
    onEnded: (reason: string) => void;
    onError: (message: string) => void;
  },
): GuestRoomSession {
  const deviceId = crypto.randomUUID();
  let closed = false;
  let joined = false;
  let lastHostSeen = Date.now();

  const channel =
    "BroadcastChannel" in window ? new BroadcastChannel(`sgs-room-${roomId}`) : null;

  let conn: DataConnection | null = null;
  let peer: Peer | null = null;

  const sendToHost = (msg: RoomMessage) => {
    if (conn && conn.open) {
      try {
        conn.send(msg);
      } catch {
        // ignore
      }
    }
    channel?.postMessage(msg);
  };

  const endSession = (reason: string, isFull = false) => {
    if (closed) return;
    closed = true;
    window.clearInterval(pingTimer);
    window.removeEventListener("pagehide", onUnload);
    try {
      conn?.close();
    } catch {
      // ignore
    }
    try {
      peer?.destroy();
    } catch {
      // ignore
    }
    channel?.close();
    if (isFull) callbacks.onError(reason);
    else callbacks.onEnded(reason);
  };

  const handleHostMsg = (msg: RoomMessage) => {
    if (closed || !msg || typeof msg !== "object") return;
    if (msg.type === "welcome") {
      if (msg.targetDeviceId && msg.targetDeviceId !== deviceId) return;
      joined = true;
      lastHostSeen = Date.now();
      callbacks.onSync({ name: msg.name, code: msg.code, layout: msg.layout }, msg.devices);
    } else if (msg.type === "sync") {
      joined = true;
      lastHostSeen = Date.now();
      callbacks.onSync({ name: msg.name, code: msg.code, layout: msg.layout }, msg.devices);
    } else if (msg.type === "heartbeat") {
      joined = true;
      lastHostSeen = Date.now();
    } else if (msg.type === "room-full") {
      if (!msg.targetDeviceId || msg.targetDeviceId === deviceId) {
        endSession(`Room is full (maximum ${msg.maxDevices} devices).`, true);
      }
    } else if (msg.type === "room-ended") {
      endSession("Host closed the browser or ended the room.");
    }
  };

  if (channel) {
    channel.addEventListener("message", (event: MessageEvent<RoomMessage>) => {
      handleHostMsg(event.data);
    });
    channel.postMessage({ type: "join", deviceId } satisfies RoomMessage);
  }

  try {
    peer = new Peer();
    peer.on("open", () => {
      if (closed || !peer) return;
      conn = peer.connect(roomId, { reliable: true });
      conn.on("open", () => {
        sendToHost({ type: "join", deviceId });
      });
      conn.on("data", (data) => {
        handleHostMsg(data as RoomMessage);
      });
      conn.on("close", () => {
        if (joined && !closed) {
          endSession("Host closed the browser or ended the room.");
        }
      });
    });
    peer.on("error", () => {
      // BroadcastChannel still handles same-browser/local testing
    });
  } catch {
    // ignore WebRTC unavailable
  }

  const pingTimer = window.setInterval(() => {
    if (closed) return;
    sendToHost({ type: "ping", deviceId });
    if (joined && Date.now() - lastHostSeen > HOST_TIMEOUT_MS) {
      endSession("Host disconnected or closed their browser.");
    }
  }, HEARTBEAT_MS);

  const onUnload = () => {
    if (!closed) {
      sendToHost({ type: "leave", deviceId });
    }
  };
  window.addEventListener("pagehide", onUnload);

  return {
    roomId,
    sendEdit(code, layout) {
      if (!closed && joined) {
        sendToHost({ type: "edit", deviceId, code, layout });
      }
    },
    leave() {
      onUnload();
      endSession("You left the live room.");
    },
  };
}
