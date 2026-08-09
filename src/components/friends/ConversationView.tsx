"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useDisplayName } from "@/components/profile/DisplayNameProvider";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  DIRECT_MESSAGE_ATTACHMENT_MAX_COUNT,
  validateDirectMessageAttachment,
} from "@/lib/messages/attachmentValidation";
import {
  discardDirectMessageAttachments,
  listDirectMessages,
  markDirectConversationRead,
  sendDirectMessage,
  uploadDirectMessageAttachments,
  type DirectMessage,
  type DirectMessageAttachmentInput,
} from "@/lib/client/messages";
import { TypingIndicator } from "@/components/friends/TypingIndicator";
import { createTypingController, getTypingSnapshot, type TypingSnapshot } from "@/lib/client/typing";

export type ConversationState = { messages: DirectMessage[]; typing: TypingSnapshot; loading: boolean; loadingOlder: boolean; sending: boolean; error: string; hasOlder: boolean; currentUserId: string | null };
export type ConversationTransport = {
  list: typeof listDirectMessages;
  send: typeof sendDirectMessage;
  upload: typeof uploadDirectMessageAttachments;
  discard: typeof discardDirectMessageAttachments;
  read: typeof markDirectConversationRead;
  currentUser: () => Promise<string | null>;
  typing?: typeof getTypingSnapshot;
  connect: (conversationId: string, onInvalidate: () => void, onSubscribed: () => void) => () => void;
};

type ControllerOptions = { conversationId: string; transport: ConversationTransport; onChange: (state: ConversationState) => void; onMessageReceived?: () => void; onConversationRead?: () => void };
type SelectedFile = { file: File; previewUrl: string };

export function messageBubbleClassName(sent: boolean, body: string) {
  void body;
  return `min-w-0 max-w-[75%] wrap-anywhere rounded-2xl px-3 py-2 text-sm leading-5 ${sent ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-muted text-foreground"}`;
}

function messageHasContent(message: DirectMessage) {
  return Boolean(message.body?.trim() || message.attachments?.length);
}

export function mergeDirectMessages(current: DirectMessage[], incoming: DirectMessage[]) {
  const byId = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) if (item?.id && item.senderId && item.createdAt && messageHasContent(item)) byId.set(item.id, item);
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

export function createConversationController(options: ControllerOptions) {
  let state: ConversationState = { messages: [], typing: { state: "unknown", users: [] }, loading: true, loadingOlder: false, sending: false, error: "", hasOlder: true, currentUserId: null };
  let cleanup: () => void = () => undefined;
  let pending = Promise.resolve();
  let stopped = false;
  const publish = (patch: Partial<ConversationState>) => { if (!stopped) { state = { ...state, ...patch }; options.onChange(state); } };
  const reconcile = async () => {
    try {
      const [incoming, typing] = await Promise.all([
        options.transport.list(options.conversationId),
        options.transport.typing?.(options.conversationId).catch(() => ({ state: "unknown" as const, users: [] })) ?? Promise.resolve({ state: "unknown" as const, users: [] }),
      ]);
      const previousIds = new Set(state.messages.map(({ id }) => id));
      const messages = mergeDirectMessages(state.messages, incoming);
      publish({ messages, typing, loading: false, error: "" });
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
    async send(body: string, files: File[] = []) {
      const value = body.trim();
      if ((!value && files.length === 0) || state.sending) return false;
      publish({ sending: true, error: "" });
      let uploaded: DirectMessageAttachmentInput[] = [];
      try {
        if (files.length) {
          uploaded = await options.transport.upload(options.conversationId, files);
          if (uploaded.length !== files.length) throw new Error("Attachment upload incomplete.");
        }
        const sent = await options.transport.send(options.conversationId, value, uploaded);
        publish({ messages: mergeDirectMessages(state.messages, [sent]), sending: false });
        await reconcile();
        return true;
      } catch {
        if (uploaded.length) {
          try { await options.transport.discard(options.conversationId, uploaded); } catch { /* best effort */ }
        }
        publish({ sending: false, error: "Không thể gửi tin nhắn hoặc tệp. Bạn có thể thử lại." });
        return false;
      }
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
    upload: uploadDirectMessageAttachments,
    discard: discardDirectMessageAttachments,
    read: markDirectConversationRead,
    currentUser: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
    typing: getTypingSnapshot,
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

function MessageAttachments({ attachments }: { attachments: NonNullable<DirectMessage["attachments"]> }) {
  return <div className="mt-2 grid gap-2 sm:grid-cols-2">{attachments.map((attachment) => <figure key={attachment.id} className="min-w-0 overflow-hidden rounded-lg border border-border/60 bg-background/30"><div className="overflow-hidden">{attachment.mimeType.startsWith("video/") ? <video src={attachment.url} controls playsInline preload="metadata" className="max-h-56 w-full object-cover" aria-label={attachment.name} /> : <img src={attachment.url} alt={attachment.name} loading="lazy" className="max-h-56 w-full object-cover" />}</div><figcaption className="truncate px-2 py-1 text-xs text-muted-foreground">{attachment.name}</figcaption></figure>)}</div>;
}

export function ConversationView({ conversationId, friendName, friendAvatarUrl, className = "", onMessageReceived, onConversationRead }: { conversationId: string; friendName?: string | null; friendAvatarUrl?: string | null; className?: string; onMessageReceived?: () => void; onConversationRead?: () => void }) {
  const { avatarUrl: ownAvatarUrl, displayName } = useDisplayName();
  const [state, setState] = useState<ConversationState>({ messages: [], typing: { state: "unknown", users: [] }, loading: true, loadingOlder: false, sending: false, error: "", hasOlder: true, currentUserId: null });
  const [body, setBody] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [attachmentError, setAttachmentError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlsRef = useRef(new Set<string>());
  const controllerRef = useRef<ReturnType<typeof createConversationController> | null>(null);
  const typingControllerRef = useRef<ReturnType<typeof createTypingController> | null>(null);
  const stickToBottom = useRef(true);
  const previousHeight = useRef<number | null>(null);
  const reconcile = useCallback(() => { void controllerRef.current?.reconcile(); }, []);

  useEffect(() => {
    const controller = createConversationController({ conversationId, transport: browserTransport(), onChange: setState, onMessageReceived, onConversationRead });
    controllerRef.current = controller;
    typingControllerRef.current = createTypingController(conversationId);
    void controller.start();
    const visible = () => { if (document.visibilityState === "visible") reconcile(); };
    window.addEventListener("focus", reconcile);
    document.addEventListener("visibilitychange", visible);
    return () => { window.removeEventListener("focus", reconcile); document.removeEventListener("visibilitychange", visible); typingControllerRef.current?.stop(); typingControllerRef.current = null; controller.stop(); controllerRef.current = null; };
  }, [conversationId, onConversationRead, onMessageReceived, reconcile]);

  useEffect(() => () => {
    for (const url of previewUrlsRef.current) URL.revokeObjectURL(url);
    previewUrlsRef.current.clear();
  }, []);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    if (previousHeight.current !== null) { element.scrollTop += element.scrollHeight - previousHeight.current; previousHeight.current = null; }
    else if (stickToBottom.current) element.scrollTo({ top: element.scrollHeight });
  }, [state.messages]);

  const revokePreview = (previewUrl: string) => {
    URL.revokeObjectURL(previewUrl);
    previewUrlsRef.current.delete(previewUrl);
  };
  const loadOlder = async () => { const element = scrollRef.current; previousHeight.current = element?.scrollHeight ?? null; await controllerRef.current?.loadOlder(); };
  const send = async () => {
    if (await controllerRef.current?.send(body, selectedFiles.map(({ file }) => file))) {
      setBody("");
      setSelectedFiles((files) => { files.forEach(({ previewUrl }) => revokePreview(previewUrl)); return []; });
      setAttachmentError("");
      stickToBottom.current = true;
    }
  };
  const selectFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    const remaining = DIRECT_MESSAGE_ATTACHMENT_MAX_COUNT - selectedFiles.length;
    if (remaining <= 0) { setAttachmentError(`Tối đa ${DIRECT_MESSAGE_ATTACHMENT_MAX_COUNT} tệp.`); return; }
    const accepted: File[] = [];
    let error = files.length > remaining ? `Tối đa ${DIRECT_MESSAGE_ATTACHMENT_MAX_COUNT} tệp.` : "";
    for (const file of files.slice(0, remaining)) {
      const validationError = validateDirectMessageAttachment(file);
      if (validationError) error ||= validationError;
      else accepted.push(file);
    }
    if (accepted.length) {
      setSelectedFiles((current) => [...current, ...accepted.map((file) => {
        const previewUrl = URL.createObjectURL(file);
        previewUrlsRef.current.add(previewUrl);
        return { file, previewUrl };
      })]);
    }
    setAttachmentError(error);
  };
  const removeFile = (index: number) => {
    setSelectedFiles((files) => {
      const removed = files[index];
      if (removed) revokePreview(removed.previewUrl);
      return files.filter((_, fileIndex) => fileIndex !== index);
    });
    setAttachmentError("");
  };

  return <div className={`flex min-h-0 flex-1 flex-col ${className}`}>
    <div ref={scrollRef} onScroll={(event) => { const element = event.currentTarget; stickToBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 24; if (element.scrollTop === 0) void loadOlder(); }} className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-background/60 p-4" aria-label="Lịch sử tin nhắn">
      {state.hasOlder && state.messages.length ? <div className="text-center"><Button type="button" variant="ghost" size="sm" disabled={state.loadingOlder} onClick={() => void loadOlder()}>{state.loadingOlder ? "Đang tải…" : "Tải tin nhắn cũ hơn"}</Button></div> : null}
      {state.messages.map((message) => { const sent = message.senderId === state.currentUserId; return <div key={message.id} className={`flex items-end gap-2 ${sent ? "justify-end" : "justify-start"}`}>{!sent ? <ChatAvatar url={friendAvatarUrl} name={friendName} /> : null}<div className={messageBubbleClassName(sent, message.body ?? "")}>{message.body ? <p>{message.body}</p> : null}{message.attachments?.length ? <MessageAttachments attachments={message.attachments} /> : null}</div>{sent ? <ChatAvatar url={ownAvatarUrl} name={displayName} /> : null}</div>; })}
      {!state.messages.length ? <p className="pt-12 text-center text-sm text-muted-foreground">{state.loading ? "Đang tải tin nhắn…" : state.error || "Chưa có tin nhắn."}</p> : null}
    </div>
    <div className="shrink-0 border-t border-border bg-card p-3 pb-[max(.75rem,env(safe-area-inset-bottom))]">
      <TypingIndicator snapshot={state.typing} currentUserId={state.currentUserId} />
      <label className="sr-only" htmlFor={`direct-message-${conversationId}`}>Tin nhắn</label>
      <Textarea autoFocus id={`direct-message-${conversationId}`} value={body} maxLength={2000} disabled={state.sending || state.loading} onChange={(event) => { setBody(event.target.value); typingControllerRef.current?.input(event.target.value); }} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); typingControllerRef.current?.stop(); void send(); } }} placeholder="Viết tin nhắn…" className="min-h-16 resize-none" />
      {selectedFiles.length ? <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label="Tệp đính kèm đã chọn">{selectedFiles.map(({ file, previewUrl }, index) => <figure key={`${file.name}-${index}`} className="relative min-w-0 overflow-hidden rounded-lg border border-border bg-muted"><div className="aspect-video overflow-hidden">{file.type.startsWith("video/") ? <video src={previewUrl} muted playsInline className="size-full object-cover" aria-label={file.name} /> : <img src={previewUrl} alt={file.name} className="size-full object-cover" />}</div><figcaption className="truncate px-2 py-1 text-xs">{file.name}</figcaption><Button type="button" variant="destructive" size="icon-xs" className="absolute right-1 top-1" onClick={() => removeFile(index)} aria-label={`Xóa ${file.name}`}>×</Button></figure>)}</div> : null}
      <div className="mt-2 flex items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-2"><Button type="button" variant="outline" size="sm" disabled={state.sending || state.loading || selectedFiles.length >= DIRECT_MESSAGE_ATTACHMENT_MAX_COUNT} onClick={() => fileInputRef.current?.click()}>Ảnh/video</Button><input ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="sr-only" aria-label="Chọn ảnh hoặc video" disabled={state.sending || state.loading} onChange={selectFiles} /><p className="text-xs text-destructive" aria-live="polite">{attachmentError || state.error}</p></div><Button type="button" size="sm" disabled={state.sending || state.loading || (!body.trim() && selectedFiles.length === 0)} onClick={() => void send()}>{state.sending ? "Đang gửi…" : "Gửi"}</Button></div>
    </div>
  </div>;
}
