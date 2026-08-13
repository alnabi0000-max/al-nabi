"use client";

import {
  memo,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type RefObject,
} from "react";
import { useRouter } from "next/navigation";
import {
  ImagePlus,
  Loader2,
  Send,
  Sparkles,
  Clapperboard,
  Volume2,
  Link2,
  X,
} from "lucide-react";
import clsx from "clsx";
import type { QuickAction } from "@/lib/producer/chat";
import type { VisualDna } from "@/lib/producer/vision-dna";
import { useMaster } from "@/context/MasterControllerContext";
import { useLanguage } from "@/context/LanguageContext";
import { labelForQuickAction } from "@/lib/i18n/action-labels";
import { fetchWithTimeout } from "@/lib/api/fetch-timeout";
import type { Dictionary } from "@/i18n/dictionary";
import {
  CHAT_WALLPAPERS,
  readWallpaperIndex,
  writeWallpaperIndex,
} from "@/lib/producer/wallpapers";
import { getStudioTemplate } from "@/lib/templates/catalog";
import {
  buildTransferPayload,
  saveTemplateTransfer,
} from "@/lib/templates/resolve";
import { BgmPicker } from "@/components/BgmPicker";
import type { BgmMode } from "@/lib/bgm/types";
import { DEFAULT_BGM_SELECTION } from "@/lib/bgm/types";

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageUrl?: string | null;
};

function memoryKeyFrom(alnabiyKey: string | null | undefined) {
  if (alnabiyKey) return alnabiyKey.slice(0, 64);
  if (typeof window === "undefined") return "guest";
  let id = localStorage.getItem("alnabiy_producer_mem");
  if (!id) {
    id = `g_${Math.random().toString(36).slice(2, 12)}`;
    localStorage.setItem("alnabiy_producer_mem", id);
  }
  return id;
}

function msgId() {
  return `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

const YT_RE =
  /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)[\w-]{6,}/i;

const ChatBubble = memo(function ChatBubble({ message }: { message: Msg }) {
  const isUser = message.role === "user";
  const { t } = useLanguage();
  return (
    <div
      className={clsx(
        "pc-bubble flex w-full bg-transparent",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={clsx(
          "text-sm leading-relaxed shadow-md",
          /* Telegram-style: no white ovals / white borders */
          isUser
            ? "max-w-[80%] self-end rounded-2xl rounded-tr-sm border-0 bg-gradient-to-br from-[var(--accent-from)] to-[var(--accent-to)] px-4 py-2.5 text-nabi-on"
            : "max-w-[85%] self-start rounded-2xl rounded-tl-sm border border-nabi-border bg-nabi-elevated px-4 py-2.5 text-nabi-ink backdrop-blur-md"
        )}
      >
        {message.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={message.imageUrl}
            alt={t.chat.imageAttached}
            className="mb-2 max-h-36 rounded-lg object-cover"
            loading="lazy"
          />
        )}
        {message.content}
      </div>
    </div>
  );
});

const MessageList = memo(function MessageList({
  messages,
  wallpaperClass,
}: {
  messages: Msg[];
  wallpaperClass: string;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  return (
    <div
      className={clsx(
        "pc-chat-scroll flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4",
        wallpaperClass
      )}
    >
      {messages.map((m) => (
        <ChatBubble key={m.id} message={m} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
});

const QuickActionBar = memo(function QuickActionBar({
  actions,
  busy,
  t,
  onQuick,
}: {
  actions: QuickAction[];
  busy: boolean;
  t: Dictionary;
  onQuick: (a: QuickAction) => void;
}) {
  if (!actions.length) return null;
  return (
    <div className="pc-quick-bar shrink-0 border-t border-nabi-border bg-nabi-surface/85 px-3 py-2 backdrop-blur-md sm:px-4">
      <div className="flex max-h-[4.75rem] flex-wrap gap-2 overflow-y-auto overscroll-contain pr-0.5">
      {actions.map((a) => {
        const label = labelForQuickAction(a, t);
        return (
          <button
            key={
              a.id === "select_template"
                ? `select_template:${a.templateId}`
                : "href" in a && a.href
                  ? `${a.id}:${a.href}`
                  : a.id
            }
            type="button"
            disabled={busy}
            onClick={() => onQuick(a)}
            className={clsx(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs transition",
              a.id === "produce"
                ? "border-nabi-neon/50 bg-nabi-ink text-nabi-bg"
                : a.id === "select_template"
                  ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-50 hover:border-emerald-300/70"
                  : a.id === "voice_preview"
                    ? "border-nabi-gold/40 text-nabi-gold"
                    : "border-nabi-border text-nabi-ink hover:border-nabi-neon/40"
            )}
          >
            {a.id === "produce" ? (
              <span className="inline-flex items-center gap-1">
                <Sparkles size={12} /> {label}
              </span>
            ) : a.id === "select_template" ? (
              <span className="inline-flex items-center gap-1">
                <Clapperboard size={12} /> {label}
              </span>
            ) : a.id === "voice_preview" ? (
              <span className="inline-flex items-center gap-1">
                <Volume2 size={12} /> {label}
              </span>
            ) : (
              label
            )}
          </button>
        );
      })}
      </div>
    </div>
  );
});

/** Owns local draft state so typing never re-renders the message list */
const ChatComposer = memo(function ChatComposer({
  t,
  busy,
  imageUrl,
  linkNote,
  onRemoveImage,
  onRemoveLink,
  onPickFile,
  onAttachLink,
  onSend,
}: {
  t: Dictionary;
  busy: boolean;
  imageUrl: string | null;
  linkNote: string | null;
  onRemoveImage: () => void;
  onRemoveLink: () => void;
  onPickFile: () => void;
  onAttachLink: (draft: string) => string;
  onSend: (text: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const onChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(e.target.value);
  }, []);

  const submit = useCallback(() => {
    const text = draft;
    setDraft("");
    onSend(text);
  }, [draft, onSend]);

  return (
    <div className="pc-composer shrink-0 border-t border-nabi-border bg-nabi-surface px-3 pt-3 backdrop-blur-md">
      {(imageUrl || linkNote) && (
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-nabi-muted">
          {imageUrl && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt={t.chat.imageAttached}
                className="h-9 w-9 rounded object-cover"
              />
              {t.chat.imageAttached}
              <button type="button" className="underline" onClick={onRemoveImage}>
                {t.chat.remove}
              </button>
            </>
          )}
          {linkNote && (
            <span className="inline-flex items-center gap-1 rounded-full border border-nabi-border px-2 py-0.5">
              <Link2 size={11} />
              {linkNote.slice(0, 42)}
              <button
                type="button"
                aria-label={t.chat.remove}
                onClick={onRemoveLink}
              >
                <span aria-hidden="true">×</span>
              </button>
            </span>
          )}
        </div>
      )}
      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={onPickFile}
          className="shrink-0 rounded-xl border border-nabi-border p-2.5 text-nabi-muted hover:text-nabi-ink"
          aria-label={t.chat.uploadImage}
        >
          <ImagePlus size={18} />
        </button>
        <button
          type="button"
          onClick={() => setDraft(onAttachLink(draft))}
          className="shrink-0 rounded-xl border border-nabi-border p-2.5 text-nabi-muted hover:text-nabi-ink"
          aria-label={t.chat.attachLink}
          title={t.chat.attachLink}
        >
          <Link2 size={18} />
        </button>
        <textarea
          value={draft}
          onChange={onChange}
          rows={2}
          placeholder={t.chat.placeholder}
          className="min-h-[44px] min-w-0 flex-1 resize-none rounded-xl border border-nabi-border bg-nabi-input px-3 py-2 text-sm text-nabi-ink outline-none placeholder:text-nabi-muted focus:border-nabi-neon/40"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button
          type="button"
          disabled={busy}
          onClick={submit}
          aria-label={t.chat.send}
          className="shrink-0 rounded-xl bg-nabi-ink p-2.5 text-nabi-bg disabled:opacity-50"
        >
          {busy ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Send size={18} />
          )}
        </button>
      </div>
    </div>
  );
});

const SessionPanel = memo(function SessionPanel({
  t,
  aspect,
  narration,
  dna,
  busy,
  previewUrl,
  resultUrl,
  audioRef,
  onPreview,
  bgmMode,
  bgmTrackId,
  onBgmModeChange,
  onBgmTrackChange,
}: {
  t: Dictionary;
  aspect: string;
  narration: string;
  dna: VisualDna | null;
  busy: string | null;
  previewUrl: string | null;
  resultUrl: string | null;
  audioRef: RefObject<HTMLAudioElement | null>;
  onPreview: () => void;
  bgmMode: BgmMode;
  bgmTrackId: string | null;
  onBgmModeChange: (mode: BgmMode) => void;
  onBgmTrackChange: (trackId: string | null) => void;
}) {
  return (
    <>
      <div className="rounded-2xl border border-nabi-border bg-nabi-card p-4">
        <p className="text-[10px] uppercase tracking-wider text-nabi-muted">
          {t.chat.session}
        </p>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-nabi-muted">{t.chat.aspect}</dt>
            <dd className="text-nabi-ink">{aspect}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-nabi-muted">{t.chat.narration}</dt>
            <dd className="capitalize text-nabi-ink">{narration}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-nabi-muted">Audio</dt>
            <dd className="text-nabi-ink">{t.chat.audio}</dd>
          </div>
        </dl>
        <div className="mt-4 border-t border-nabi-border pt-4">
          <BgmPicker
            mode={bgmMode}
            trackId={bgmTrackId}
            onModeChange={onBgmModeChange}
            onTrackChange={onBgmTrackChange}
            disabled={busy === "render"}
            labels={{
              title: t.chat.bgmTitle,
              ai: t.chat.bgmAi,
              manual: t.chat.bgmManual,
              off: t.chat.bgmOff,
              aiHint: t.chat.bgmAiHint,
              empty: t.chat.bgmEmpty,
              loading: t.chat.bgmLoading,
            }}
          />
        </div>
        {dna && (
          <p className="mt-3 text-xs text-nabi-muted">
            {dna.artStyle} · {dna.lighting}
          </p>
        )}
        <button
          type="button"
          disabled={busy === "preview"}
          onClick={onPreview}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-nabi-gold/30 bg-nabi-gold/10 px-3 py-2 text-xs text-nabi-gold"
        >
          <Volume2 size={14} />
          {t.chat.voicePreviewFree}
        </button>
        {previewUrl && (
          <audio ref={audioRef} src={previewUrl} controls className="mt-3 w-full" />
        )}
      </div>
      <div className="rounded-2xl border border-nabi-border bg-nabi-card p-4">
        <p className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-nabi-muted">
          <Clapperboard size={12} />
          {t.chat.output}
        </p>
        {busy === "render" && (
          <p className="flex items-center gap-2 text-sm text-nabi-muted">
            <Loader2 size={14} className="animate-spin" />
            {t.chat.rendering}
          </p>
        )}
        {resultUrl && (
          <video
            src={resultUrl}
            controls
            playsInline
            className="mt-2 w-full rounded-xl border border-nabi-border"
          />
        )}
        {!resultUrl && busy !== "render" && (
          <p className="text-xs text-nabi-muted">{t.chat.vaultHint}</p>
        )}
      </div>
    </>
  );
});

export function ProducerChat({
  compact = false,
  onClose,
}: {
  compact?: boolean;
  onClose?: () => void;
}) {
  const router = useRouter();
  const { alnabiyKey } = useMaster();
  const { t, locale } = useLanguage();
  const memoryKey = useMemo(() => memoryKeyFrom(alnabiyKey), [alnabiyKey]);
  /* locale code for server dictionary fallbacks */
  const [messages, setMessages] = useState<Msg[]>(() => [
    { id: msgId(), role: "assistant", content: t.chat.welcome },
  ]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [linkNote, setLinkNote] = useState<string | null>(null);
  const [dna, setDna] = useState<VisualDna | null>(null);
  const [actions, setActions] = useState<QuickAction[]>([]);
  const [aspect, setAspect] = useState<"16:9" | "9:16" | "1:1">("16:9");
  const [narration, setNarration] = useState<
    "epic" | "calm" | "drama" | "joy" | "neutral"
  >("epic");
  const [bgmMode, setBgmMode] = useState<BgmMode>(DEFAULT_BGM_SELECTION.mode);
  const [bgmTrackId, setBgmTrackId] = useState<string | null>(
    DEFAULT_BGM_SELECTION.trackId
  );
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState<"chat" | "render" | "preview" | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState<"beginner" | "advanced">("beginner");
  const [wallIdx, setWallIdx] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  /* Keep latest values for stable callbacks without re-creating on every keystroke */
  const stateRef = useRef({
    messages,
    imageUrl,
    linkNote,
    dna,
    level,
    aspect,
    narration,
    bgmMode,
    bgmTrackId,
    brief,
    memoryKey,
    alnabiyKey,
    t,
    locale,
  });
  stateRef.current = {
    messages,
    imageUrl,
    linkNote,
    dna,
    level,
    aspect,
    narration,
    bgmMode,
    bgmTrackId,
    brief,
    memoryKey,
    alnabiyKey,
    t,
    locale,
  };

  useEffect(() => {
    setWallIdx(readWallpaperIndex());
  }, []);

  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 1 && prev[0]?.role === "assistant") {
        return [{ id: prev[0].id, role: "assistant", content: t.chat.welcome }];
      }
      return prev;
    });
  }, [locale, t.chat.welcome]);

  const wallpaper = CHAT_WALLPAPERS[wallIdx] || CHAT_WALLPAPERS[0]!;
  const wallpaperClass = wallpaper.className;

  const cycleWallpaper = useCallback(() => {
    setWallIdx((prev) => {
      const next = (prev + 1) % CHAT_WALLPAPERS.length;
      writeWallpaperIndex(next);
      return next;
    });
  }, []);

  const onFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => setImageUrl(String(reader.result || ""));
    reader.readAsDataURL(file);
  }, []);

  const attachLinkFromDraft = useCallback((draft: string) => {
    const m = draft.match(YT_RE) || draft.match(/https?:\/\/\S+/i);
    if (m) {
      setLinkNote(m[0]);
      return draft.replace(m[0], "").trim();
    }
    return draft;
  }, []);

  const sendChat = useCallback(async (userText: string) => {
    const s = stateRef.current;
    const text = userText.trim();
    if (!text && !s.imageUrl && !s.linkNote) return;
    setBusy("chat");
    setError(null);
    const content = [
      text || (s.imageUrl ? s.t.chat.imageAttached : ""),
      s.linkNote ? `Reference link: ${s.linkNote}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    const nextUser: Msg = {
      id: msgId(),
      role: "user",
      content,
      imageUrl: s.imageUrl,
    };
    const nextMessages = [...s.messages, nextUser];
    startTransition(() => setMessages(nextMessages));

    try {
      const res = await fetchWithTimeout(
        "/api/producer/chat",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(s.alnabiyKey ? { "x-alnabiy-key": s.alnabiyKey } : {}),
          },
          body: JSON.stringify({
            /* Full thread stays in UI; only a recent window is posted (silent). */
            messages: nextMessages.slice(-20).map((m) => ({
              role: m.role,
              content: m.content,
              imageUrl: m.imageUrl,
            })),
            imageUrl: s.imageUrl,
            visualDna: s.dna,
            userLevel: s.level,
            memoryKey: s.memoryKey,
            preferredAspect: s.aspect,
            preferredNarration: s.narration,
            locale: s.locale,
          }),
        },
        45_000
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Chat failed");

      startTransition(() => {
        if (data.visualDna) setDna(data.visualDna);
        if (data.suggestedAspect) setAspect(data.suggestedAspect);
        if (data.suggestedNarration) setNarration(data.suggestedNarration);
        if (data.productionBrief) setBrief(data.productionBrief);
        setActions(
          Array.isArray(data.quickActions) ? data.quickActions : []
        );
        setMessages((m) => [
          ...m,
          {
            id: msgId(),
            role: "assistant",
            content: data.reply || s.t.chat.fallbackContinue,
          },
        ]);
      });
      setImageUrl(null);
      setLinkNote(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chat failed");
    } finally {
      setBusy(null);
    }
  }, []);

  const voicePreview = useCallback(async () => {
    const s = stateRef.current;
    const text =
      s.brief ||
      [...s.messages].reverse().find((m) => m.role === "user")?.content ||
      s.t.chat.voicePreview;
    setBusy("preview");
    setError(null);
    try {
      const res = await fetchWithTimeout(
        "/api/producer/voice-preview",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(s.alnabiyKey ? { "x-alnabiy-key": s.alnabiyKey } : {}),
          },
          body: JSON.stringify({ text, narration: s.narration }),
        },
        30_000
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Preview failed");
      setPreviewUrl(data.audioUrl as string);
      startTransition(() => {
        setMessages((m) => [
          ...m,
          {
            id: msgId(),
            role: "assistant",
            content: s.t.chat.previewReady,
          },
        ]);
      });
      requestAnimationFrame(() => {
        void audioRef.current?.play().catch(() => undefined);
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setBusy(null);
    }
  }, []);

  const produce = useCallback(async () => {
    const s = stateRef.current;
    const productionBrief =
      s.brief ||
      s.messages
        .filter((m) => m.role === "user")
        .map((m) => m.content)
        .join("\n") ||
      "Cinematic scene";

    setBusy("render");
    setError(null);
    setResultUrl(null);
    try {
      const res = await fetchWithTimeout(
        "/api/producer/render",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(s.alnabiyKey ? { "x-alnabiy-key": s.alnabiyKey } : {}),
          },
          body: JSON.stringify({
            brief: productionBrief,
            aspect: s.aspect,
            narration: s.narration,
            visualDna: s.dna,
            durationSec: 8,
            bgmMode: s.bgmMode,
            bgmTrackId: s.bgmTrackId,
          }),
        },
        /* Full render: video + VO + Foley + mux — matches server maxDuration=300s */
        320_000
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Produce failed");
      setResultUrl(data.videoUrl || null);
      startTransition(() => {
        setMessages((m) => [
          ...m,
          {
            id: msgId(),
            role: "assistant",
            content: `${s.t.chat.produceReady} (${data.foleyCount ?? 0})`,
          },
        ]);
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Produce failed");
    } finally {
      setBusy(null);
    }
  }, []);

  const onQuick = useCallback(
    (action: QuickAction) => {
      const label = labelForQuickAction(action, stateRef.current.t);
      if (action.id === "select_template" && "templateId" in action) {
        const tpl = getStudioTemplate(action.templateId);
        if (!tpl) return;
        const payload = buildTransferPayload(tpl, tpl.subject_placeholder);
        saveTemplateTransfer(payload);
        onClose?.();
        router.push(
          `/?template=${tpl.id}&from=producer&subject=${encodeURIComponent(payload.subject)}`
        );
        return;
      }
      if ("href" in action && action.href) {
        onClose?.();
        router.push(action.href);
        return;
      }
      if ("voicePreview" in action && action.voicePreview) {
        void voicePreview();
        return;
      }
      if ("aspect" in action && action.aspect) {
        setAspect(action.aspect);
        void sendChat(`Use ${label}`);
        return;
      }
      if ("narration" in action && action.narration) {
        setNarration(action.narration);
        void sendChat(`Narration style: ${label}`);
        return;
      }
      if ("produce" in action && action.produce) {
        void produce();
      }
    },
    [onClose, router, produce, sendChat, voicePreview]
  );

  const removeImage = useCallback(() => setImageUrl(null), []);
  const removeLink = useCallback(() => setLinkNote(null), []);
  const pickFile = useCallback(() => fileRef.current?.click(), []);
  const busyChat = busy === "chat";

  return (
    <div
      className={clsx(
        "flex flex-col",
        compact
          ? "h-full min-h-0"
          : "grid gap-6 lg:grid-cols-[1fr_320px]"
      )}
    >
      <section
        className={clsx(
          "flex min-h-0 flex-col overflow-hidden",
          compact
            ? "flex-1"
            : "min-h-[min(70vh,720px)] max-h-[calc(100dvh-10rem)] rounded-2xl border border-nabi-border bg-nabi-surface/40"
        )}
      >
        <header className="flex items-center justify-between gap-3 border-b border-nabi-border bg-nabi-surface/90 px-4 py-3 backdrop-blur-md">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.2em] text-nabi-muted">
              {t.chat.engine}
            </p>
            <h1 className="truncate text-lg font-semibold text-nabi-ink">
              ✨ {t.chat.title}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={cycleWallpaper}
              title={`${t.chat.wallpaper}: ${wallpaper.label}`}
              aria-label={`${t.chat.wallpaper}: ${wallpaper.label}`}
              className="inline-flex items-center justify-center rounded-lg border border-nabi-border px-2 py-1.5 text-base leading-none transition hover:border-nabi-neon/40 hover:bg-nabi-elevated"
            >
              <span aria-hidden>🎨</span>
            </button>
            <div className="flex gap-1 rounded-full border border-nabi-border p-0.5 text-xs">
              {(["beginner", "advanced"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLevel(l)}
                  className={clsx(
                    "rounded-full px-2.5 py-1 capitalize",
                    level === l ? "bg-nabi-ink text-nabi-bg" : "text-nabi-muted"
                  )}
                >
                  {l === "beginner" ? t.chat.beginner : t.chat.advanced}
                </button>
              ))}
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-nabi-muted hover:bg-nabi-elevated hover:text-nabi-ink"
                aria-label={t.chat.close}
              >
                <X size={16} />
              </button>
            )}
          </div>
        </header>

        <MessageList messages={messages} wallpaperClass={wallpaperClass} />

        <QuickActionBar
          actions={actions}
          busy={Boolean(busy)}
          t={t}
          onQuick={onQuick}
        />

        {compact && (
          <div className="shrink-0 border-t border-nabi-border px-3 py-2">
            <BgmPicker
              mode={bgmMode}
              trackId={bgmTrackId}
              onModeChange={setBgmMode}
              onTrackChange={setBgmTrackId}
              disabled={busy === "render"}
              labels={{
                title: t.chat.bgmTitle,
                ai: t.chat.bgmAi,
                manual: t.chat.bgmManual,
                off: t.chat.bgmOff,
                aiHint: t.chat.bgmAiHint,
                empty: t.chat.bgmEmpty,
                loading: t.chat.bgmLoading,
              }}
            />
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />

        <ChatComposer
          t={t}
          busy={busyChat}
          imageUrl={imageUrl}
          linkNote={linkNote}
          onRemoveImage={removeImage}
          onRemoveLink={removeLink}
          onPickFile={pickFile}
          onAttachLink={attachLinkFromDraft}
          onSend={sendChat}
        />
        {error && (
          <p className="px-3 pb-2 text-xs text-rose-400">{error}</p>
        )}
      </section>

      {!compact && (
        <aside className="space-y-4 lg:sticky lg:top-20 lg:h-fit">
          <SessionPanel
            t={t}
            aspect={aspect}
            narration={narration}
            dna={dna}
            busy={busy}
            previewUrl={previewUrl}
            resultUrl={resultUrl}
            audioRef={audioRef}
            onPreview={voicePreview}
            bgmMode={bgmMode}
            bgmTrackId={bgmTrackId}
            onBgmModeChange={setBgmMode}
            onBgmTrackChange={setBgmTrackId}
          />
        </aside>
      )}

      {compact && (previewUrl || resultUrl || busy === "render") && (
        <div className="shrink-0 border-t border-nabi-border px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between gap-2 text-[11px] text-nabi-muted">
            <span className="truncate">
              {aspect} · {narration}
            </span>
            <button
              type="button"
              disabled={busy === "preview"}
              onClick={() => void voicePreview()}
              className="inline-flex shrink-0 items-center gap-1 text-nabi-gold"
            >
              {busy === "preview" ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Volume2 size={12} />
              )}
              {t.chat.voicePreviewFree}
            </button>
          </div>
          {previewUrl && (
            <audio
              ref={audioRef}
              src={previewUrl}
              controls
              className="mt-2 w-full"
            />
          )}
          {busy === "render" && (
            <p className="mt-2 flex items-center gap-2 text-xs text-nabi-muted">
              <Loader2 size={12} className="animate-spin" />
              {t.chat.rendering}
            </p>
          )}
          {resultUrl && (
            <video
              src={resultUrl}
              controls
              playsInline
              className="mt-2 max-h-40 w-full rounded-lg border border-nabi-border"
            />
          )}
        </div>
      )}
    </div>
  );
}
