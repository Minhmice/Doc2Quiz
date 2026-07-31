"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useDisplayName } from "@/components/profile/DisplayNameProvider";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { listDirectMessages, markDirectConversationRead, sendDirectMessage, type DirectMessage } from "@/lib/client/messages";

export type ConversationState = { messages: DirectMessage[]; loading: boolean; loadingOlder: boolean; sending: boolean; error: string; hasOlder: boolean; currentUserId: string | null };
export type ConversationTransport = {
  list: typeof listDirectMessages;
  send: typeof sendDirectMessage;
  read: typeof markDirectConversationRead;
  currentUser: () => Promise<string | null>;
  connect: (conversationId: string, onInvalidate: () => void, onSubscribed: () => void) => () => void;
};

type ControllerOptions = { conversationId: string; transport: ConversationTransport; onChange: (state: ConversationState) => void; onMessageReceived?: () => void; onConversationRead?: () => void };

export function mergeDirectMessages(current: DirectMessage[], incoming: DirectMessage[]) {
  const byId = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) if (item?.id && item.body && item.senderId && item.createdAt) byId.set(item.id, item);
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

export function createConversationController(options: ControllerOptions) {
  let state: ConversationState = { messages: [], loading: true, loadingOlder: false, sending: false, error: "", hasOlder: true, currentUserId: null };
  let cleanup: () => void = () => undefined;
  let pending = Promise.resolve();
  let stopped = false;
  const publish = (patch: Partial<ConversationState>) => { if (!stopped) { state = { ...state, ...patch }; options.onChange(state); } };
  const reconcile = async () => {
    try {
      const incoming = await options.transport.list(options.conversationId);
      const previousIds = new Set(state.messages.map(({ id }) => id));
      const messages = mergeDirectMessages(state.messages, incoming);
      publish({ messages, loading: false, error: "" });
      if (messages.some((item) => !previousIds.has(item.id) && item.senderId !== state.currentUserId)) options.onMessageReceived?.();
      await options.transport.read(options.conversationId);
      options.onConversationRead?.();
    } catch { publish({ loading: false, error: "Không thể tải cuộc trò chuyện." }); }
  };
  const queueReconcile = () => { pending = pending.then(reconcile); };
  return {
    async start() {
      state.currentUserId = await options.transport.currentUser();
      await reconcile();
      cleanup = options.transport.connect(options.conversationId, queueReconcile, queueReconcile);
    },
    async reconcile() { await reconcile(); },
    async loadOlder() {
      const before = state.messages[0]?.createdAt;
      if (!before || state.loadingOlder || !state.hasOlder) return;
      publish({ loadingOlder: true, error: "" });
      try {
        const older = await options.transport.list(options.conversationId, before);
        publish({ messages: mergeDirectMessages(state.messages, older), loadingOlder: false, hasOlder: older.length > 0 });
      } catch { publish({ loadingOlder: false, error: "Không thể tải tin nhắn cũ hơn." }); }
    },
    async send(body: string) {
      const value = body.trim();
      if (!value || state.sending) return false;
      publish({ sending: true, error: "" });
      try {
        const sent = await options.transport.send(options.conversationId, value);
        publish({ messages: mergeDirectMessages(state.messages, [sent]), sending: false });
        await reconcile();
        return true;
      } catch { publish({ sending: false, error: "Không thể gửi tin nhắn." }); return false; }
    },
    settled: () => pending,
    snapshot: () => state,
    stop() { stopped = true; cleanup(); },
  };
}

function browserTransport(): ConversationTransport {
  const supabase = createSupabaseBrowserClient();
  return {
    list: listDirectMessages,
    send: sendDirectMessage,
    read: markDirectConversationRead,
    currentUser: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
    connect: (conversationId, onInvalidate, onSubscribed) => {
      const channel = supabase.channel(`social-messages:${conversationId}`, { config: { private: true } })
        .on("broadcast", { event: "message" }, onInvalidate)
        .subscribe((status) => { if (status === "SUBSCRIBED") onSubscribed(); });
      return () => { void supabase.removeChannel(channel); };
    },
  };
}

function ChatAvatar({ url, name }: { url?: string | null; name?: string | null }) {
  return <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-bold text-muted-foreground">{url ? <img src={url} alt="" className="size-full object-cover" /> : (name?.trim()[0]?.toUpperCase() ?? "?")}</span>;
}

export function ConversationView({ conversationId, friendName, friendAvatarUrl, className = "", onMessageReceived, onConversationRead }: { conversationId: string; friendName?: string | null; friendAvatarUrl?: string | null; className?: string; onMessageReceived?: () => void; onConversationRead?: () => void }) {
  const { avatarUrl: ownAvatarUrl, displayName } = useDisplayName();
  const [state, setState] = useState<ConversationState>({ messages: [], loading: true, loadingOlder: false, sending: false, error: "", hasOlder: true, currentUserId: null });
  const [body, setBody] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<ReturnType<typeof createConversationController> | null>(null);
  const stickToBottom = useRef(true);
  const previousHeight = useRef<number | null>(null);
  const reconcile = useCallback(() => { void controllerRef.current?.reconcile(); }, []);

  useEffect(() => {
    const controller = createConversationController({ conversationId, transport: browserTransport(), onChange: setState, onMessageReceived, onConversationRead });
    controllerRef.current = controller;
    void controller.start();
    const visible = () => { if (document.visibilityState === "visible") reconcile(); };
    window.addEventListener("focus", reconcile);
    document.addEventListener("visibilitychange", visible);
    return () => { window.removeEventListener("focus", reconcile); document.removeEventListener("visibilitychange", visible); controller.stop(); controllerRef.current = null; };
  }, [conversationId, onConversationRead, onMessageReceived, reconcile]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    if (previousHeight.current !== null) { element.scrollTop += element.scrollHeight - previousHeight.current; previousHeight.current = null; }
    else if (stickToBottom.current) element.scrollTo({ top: element.scrollHeight });
  }, [state.messages]);

  const loadOlder = async () => { const element = scrollRef.current; previousHeight.current = element?.scrollHeight ?? null; await controllerRef.current?.loadOlder(); };
  const send = async () => { if (await controllerRef.current?.send(body)) { setBody(""); stickToBottom.current = true; } };

  return <div className={`flex min-h-0 flex-1 flex-col ${className}`}>
    <div ref={scrollRef} onScroll={(event) => { const element = event.currentTarget; stickToBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 24; if (element.scrollTop === 0) void loadOlder(); }} className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-background/60 p-4" aria-label="Lịch sử tin nhắn">
      {state.hasOlder && state.messages.length ? <div className="text-center"><Button type="button" variant="ghost" size="sm" disabled={state.loadingOlder} onClick={() => void loadOlder()}>{state.loadingOlder ? "Đang tải…" : "Tải tin nhắn cũ hơn"}</Button></div> : null}
      {state.messages.map((message) => { const sent = message.senderId === state.currentUserId; return <div key={message.id} className={`flex items-end gap-2 ${sent ? "justify-end" : "justify-start"}`}>{!sent ? <ChatAvatar url={friendAvatarUrl} name={friendName} /> : null}<p className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm leading-5 ${sent ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-muted text-foreground"}`}>{message.body}</p>{sent ? <ChatAvatar url={ownAvatarUrl} name={displayName} /> : null}</div>; })}
      {!state.messages.length ? <p className="pt-12 text-center text-sm text-muted-foreground">{state.loading ? "Đang tải tin nhắn…" : state.error || "Chưa có tin nhắn."}</p> : null}
    </div>
    <div className="shrink-0 border-t border-border bg-card p-3 pb-[max(.75rem,env(safe-area-inset-bottom))]"><label className="sr-only" htmlFor={`direct-message-${conversationId}`}>Tin nhắn</label><Textarea autoFocus id={`direct-message-${conversationId}`} value={body} maxLength={2000} disabled={state.sending || state.loading} onChange={(event) => setBody(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder="Viết tin nhắn…" className="min-h-16 resize-none" /><div className="mt-2 flex items-center justify-between gap-2"><p className="text-xs text-destructive" aria-live="polite">{state.error}</p><Button type="button" size="sm" disabled={state.sending || !body.trim() || state.loading} onClick={() => void send()}>{state.sending ? "Đang gửi…" : "Gửi"}</Button></div></div>
  </div>;
}
