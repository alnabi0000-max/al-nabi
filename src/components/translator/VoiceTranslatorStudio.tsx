"use client";

import { useEffect, useMemo, useState } from "react";
import { Languages } from "lucide-react";
import clsx from "clsx";
import { useMaster } from "@/context/MasterControllerContext";
import { GlassCard } from "@/components/studio/studio-primitives";
import { MediaFileDrop } from "@/components/translator/MediaFileDrop";
import {
  TRANSLATOR_AUDIO_MAX_BYTES,
  TRANSLATOR_LANGUAGES,
  TRANSLATOR_VIDEO_MAX_BYTES,
  formatFileSize,
  languageLabel,
  type TranslatorJobDraft,
  type TranslatorLanguageId,
} from "@/lib/translator/workflow";

export function VoiceTranslatorStudio() {
  const { tr } = useMaster();
  const [videoName, setVideoName] = useState<string | null>(null);
  const [videoSize, setVideoSize] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [voiceName, setVoiceName] = useState<string | null>(null);
  const [voiceUrl, setVoiceUrl] = useState<string | null>(null);
  const [sourceLanguage, setSourceLanguage] =
    useState<TranslatorLanguageId>("uz");
  const [targetLanguage, setTargetLanguage] =
    useState<TranslatorLanguageId>("en");
  const [lipSync, setLipSync] = useState(true);
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      if (voiceUrl) URL.revokeObjectURL(voiceUrl);
    };
  }, [videoUrl, voiceUrl]);

  const draft: TranslatorJobDraft = useMemo(
    () => ({
      sourceVideoName: videoName,
      sourceVideoSize: videoSize,
      voiceSampleName: voiceName,
      sourceLanguage,
      targetLanguage,
      lipSync,
      consent,
      providerReady: false,
    }),
    [
      videoName,
      videoSize,
      voiceName,
      sourceLanguage,
      targetLanguage,
      lipSync,
      consent,
    ]
  );

  const readyForProvider =
    Boolean(draft.sourceVideoName) &&
    draft.consent &&
    draft.sourceLanguage !== draft.targetLanguage;

  return (
    <div className="mx-auto max-w-5xl space-y-5 rounded-3xl bg-[#09090B] p-3 md:p-5">
      <header className="space-y-2">
        <p className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-white/45">
          <Languages size={14} />
          {tr("mode_translator")}
        </p>
        <h1 className="text-2xl font-semibold text-white">
          {tr("translator_title")}
        </h1>
        <p className="max-w-2xl text-sm text-white/55">
          {tr("translator_subtitle")}
        </p>
      </header>

      <div className="rounded-2xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
        {tr("translator_status")}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <GlassCard className="space-y-4">
          <MediaFileDrop
            kind="video"
            accept="video/mp4,video/webm,video/quicktime,video/*"
            maxBytes={TRANSLATOR_VIDEO_MAX_BYTES}
            fileName={videoName}
            previewUrl={videoUrl}
            title={tr("translator_source_video")}
            hint={tr("translator_source_hint")}
            tooLarge={tr("translator_too_large")}
            onFile={(file, url) => {
              if (videoUrl) URL.revokeObjectURL(videoUrl);
              setVideoName(file.name);
              setVideoSize(file.size);
              setVideoUrl(url);
            }}
            onClear={() => {
              if (videoUrl) URL.revokeObjectURL(videoUrl);
              setVideoName(null);
              setVideoSize(0);
              setVideoUrl(null);
            }}
          />
          <MediaFileDrop
            kind="audio"
            accept="audio/wav,audio/mpeg,audio/mp4,audio/*"
            maxBytes={TRANSLATOR_AUDIO_MAX_BYTES}
            fileName={voiceName}
            previewUrl={voiceUrl}
            title={tr("translator_voice_ref")}
            hint={tr("translator_voice_hint")}
            tooLarge={tr("translator_audio_too_large")}
            onFile={(file, url) => {
              if (voiceUrl) URL.revokeObjectURL(voiceUrl);
              setVoiceName(file.name);
              setVoiceUrl(url);
            }}
            onClear={() => {
              if (voiceUrl) URL.revokeObjectURL(voiceUrl);
              setVoiceName(null);
              setVoiceUrl(null);
            }}
          />
        </GlassCard>

        <GlassCard className="space-y-4">
          <LanguageSelect
            label={tr("translator_source_lang")}
            value={sourceLanguage}
            onChange={setSourceLanguage}
          />
          <LanguageSelect
            label={tr("translator_target_lang")}
            value={targetLanguage}
            onChange={setTargetLanguage}
          />
          <button
            type="button"
            role="switch"
            aria-checked={lipSync}
            onClick={() => setLipSync((v) => !v)}
            className={clsx(
              "flex w-full items-start justify-between gap-3 rounded-xl border px-3 py-3 text-left",
              lipSync
                ? "border-cyan-400/50 bg-cyan-400/10"
                : "border-white/10 bg-white/[0.02]"
            )}
          >
            <span>
              <span className="block text-sm text-white">
                {tr("translator_lipsync")}
              </span>
              <span className="mt-1 block text-[11px] text-white/40">
                {tr("translator_lipsync_hint")}
              </span>
            </span>
            <span
              className={clsx(
                "mt-0.5 h-5 w-9 shrink-0 rounded-full",
                lipSync ? "bg-cyan-400" : "bg-white/15"
              )}
            />
          </button>
          <label className="flex items-start gap-3 text-sm text-white/70">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1 accent-cyan-400"
            />
            {tr("translator_consent")}
          </label>
        </GlassCard>
      </div>

      <GlassCard className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-white/70">
          {tr("translator_summary")}
        </h2>
        <dl className="grid gap-2 text-sm text-white/70 sm:grid-cols-2">
          <SummaryRow
            label={tr("translator_source_video")}
            value={
              videoName
                ? `${videoName} · ${formatFileSize(videoSize)}`
                : tr("translator_no_video")
            }
          />
          <SummaryRow
            label={tr("translator_voice_ref")}
            value={voiceName || tr("translator_no_voice")}
          />
          <SummaryRow
            label={tr("translator_source_lang")}
            value={languageLabel(sourceLanguage)}
          />
          <SummaryRow
            label={tr("translator_target_lang")}
            value={languageLabel(targetLanguage)}
          />
          <SummaryRow
            label={tr("translator_lipsync")}
            value={lipSync ? "On" : "Off"}
          />
        </dl>
        <button
          type="button"
          disabled
          title={tr("translator_unavailable")}
          className="flex w-full cursor-not-allowed items-center justify-center rounded-2xl bg-white/10 px-5 py-3.5 text-sm font-semibold text-white/40"
        >
          {tr("translator_start")}
        </button>
        <p className="text-[11px] text-white/35">
          {readyForProvider
            ? tr("translator_unavailable")
            : tr("translator_status")}
        </p>
      </GlassCard>
    </div>
  );
}

function LanguageSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: TranslatorLanguageId;
  onChange: (value: TranslatorLanguageId) => void;
}) {
  return (
    <label className="block space-y-1.5 text-xs uppercase tracking-wider text-white/50">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as TranslatorLanguageId)}
        className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm normal-case text-white focus:border-cyan-400/50 focus:outline-none"
      >
        {TRANSLATOR_LANGUAGES.map((lang) => (
          <option key={lang.id} value={lang.id}>
            {lang.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
      <dt className="text-[11px] uppercase tracking-wider text-white/40">
        {label}
      </dt>
      <dd className="mt-1 truncate text-white">{value}</dd>
    </div>
  );
}
