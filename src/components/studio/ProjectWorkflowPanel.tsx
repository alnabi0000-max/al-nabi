"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Clapperboard, FolderPlus, Plus, RefreshCw, Save, Send } from "lucide-react";
import clsx from "clsx";
import { StudioAccordion } from "@/components/studio/studio-primitives";

type ProjectSummary = {
  id: string;
  title: string;
  brief: string | null;
  spendCapNc: number | null;
  spentNc: number;
  reservedNc: number;
  _count: { shots: number; renderVersions: number; assets: number };
};

type RenderVersion = {
  id: string;
  number: number;
  status: string;
  deliveryUrl: string | null;
  estimatedCredits: number;
  creditsCost: number;
  approvals: Array<{ decision: string }>;
};

type ProjectShot = {
  id: string;
  position: number;
  title: string;
  prompt: string | null;
  aspect: "16:9" | "9:16" | "1:1" | null;
  quality: string | null;
  durationSec: number | null;
  preferredEngine: string | null;
  renderVersions: RenderVersion[];
};

type ProjectDetail = ProjectSummary & {
  shots: ProjectShot[];
  assets: Array<{ id: string; label: string; kind: string }>;
  renderVersions: RenderVersion[];
};

type ProjectTimelineClip = {
  id: string;
  position: number;
  startMs: number;
  durationMs: number;
  trimStartMs: number;
  trimEndMs: number;
  muted: boolean;
  volume: number;
  sourceAsset: { id: string; label: string; kind: string } | null;
  sourceRenderVersion: {
    id: string;
    number: number;
    status: string;
    provider: string | null;
    model: string | null;
  } | null;
};

type ProjectTimeline = {
  id: string;
  revision: number;
  fps: 24 | 30 | 60;
  durationMs: number;
  audioMix: {
    masterMuted: boolean;
    masterVolume: number;
    musicVolume: number;
    voiceVolume: number;
  };
  tracks: Array<{
    id: string;
    position: number;
    kind: "VIDEO" | "AUDIO";
    name: string;
    muted: boolean;
    volume: number;
    clips: ProjectTimelineClip[];
  }>;
};

type ProjectExport = {
  id: string;
  status: string;
  timelineRevision: number;
  deliveryUrl: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  creditsCost: number;
};

type Props = {
  alnabiyKey: string | null;
  prompt: string;
  onProjectChange: (projectId: string | null) => void;
  onShotChange: (shotId: string | null) => void;
  onUseShot: (shot: ProjectShot) => void;
  latestGenerationId: string | null;
};

function headers(alnabiyKey: string | null): HeadersInit {
  return {
    "Content-Type": "application/json",
    ...(alnabiyKey ? { "x-alnabiy-key": alnabiyKey } : {}),
  };
}

async function requestJson<T>(
  url: string,
  alnabiyKey: string | null,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      ...headers(alnabiyKey),
      ...(init?.headers || {}),
    },
  });
  const data = (await res.json()) as T & { ok?: boolean; error?: string };
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || "Project request failed");
  }
  return data;
}

export function ProjectWorkflowPanel({
  alnabiyKey,
  prompt,
  onProjectChange,
  onShotChange,
  onUseShot,
  latestGenerationId,
}: Props) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [activeShotId, setActiveShotId] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<ProjectTimeline | null>(null);
  const [sourceChoice, setSourceChoice] = useState("");
  const [projectExport, setProjectExport] = useState<ProjectExport | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    const data = await requestJson<{ projects: ProjectSummary[] }>(
      "/api/projects",
      alnabiyKey
    );
    setProjects(data.projects);
    return data.projects;
  }, [alnabiyKey]);

  const loadProject = useCallback(
    async (id: string) => {
      const data = await requestJson<{ project: ProjectDetail }>(
        `/api/projects/${encodeURIComponent(id)}`,
        alnabiyKey
      );
      setProject(data.project);
      setBrief(data.project.brief || "");
      return data.project;
    },
    [alnabiyKey]
  );

  const loadTimeline = useCallback(
    async (id: string) => {
      const data = await requestJson<{ timeline: ProjectTimeline }>(
        `/api/projects/${encodeURIComponent(id)}/timeline`,
        alnabiyKey
      );
      setTimeline(data.timeline);
      return data.timeline;
    },
    [alnabiyKey]
  );

  useEffect(() => {
    loadProjects().catch((error) =>
      setMessage(error instanceof Error ? error.message : "Projects unavailable")
    );
  }, [loadProjects]);

  const activeShot = useMemo(
    () => project?.shots.find((shot) => shot.id === activeShotId) || null,
    [activeShotId, project?.shots]
  );

  const latestVersion = useMemo(() => {
    if (!project) return null;
    return [...project.renderVersions, ...project.shots.flatMap((shot) => shot.renderVersions)]
      .sort((a, b) => b.number - a.number)[0] || null;
  }, [project]);

  async function selectProject(id: string) {
    setSaving(true);
    setMessage(null);
    try {
      const [selected] = await Promise.all([loadProject(id), loadTimeline(id)]);
      onProjectChange(selected.id);
      setActiveShotId(null);
      onShotChange(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Project unavailable");
    } finally {
      setSaving(false);
    }
  }

  const timelineSources = useMemo(() => {
    if (!project) return [];
    return [
      ...project.assets
        .filter((asset) => asset.kind === "VIDEO" || asset.kind === "AUDIO")
        .map((asset) => ({
          value: `asset:${asset.id}`,
          label: `${asset.kind === "AUDIO" ? "Audio" : "Asset"} · ${asset.label}`,
          kind: asset.kind === "AUDIO" ? ("AUDIO" as const) : ("VIDEO" as const),
        })),
      ...[...project.renderVersions, ...project.shots.flatMap((shot) => shot.renderVersions)]
        .filter((version) => version.status === "COMPLETED" || version.status === "APPROVED")
        .map((version) => ({
          value: `version:${version.id}`,
          label: `Render v${version.number} · ${version.status.toLowerCase()}`,
          kind: "VIDEO" as const,
        })),
    ];
  }, [project]);

  function timelineUpdateFrom(current: ProjectTimeline) {
    return {
      revision: current.revision,
      fps: current.fps,
      audioMix: current.audioMix,
      tracks: current.tracks.map((track) => ({
        position: track.position,
        kind: track.kind,
        name: track.name,
        muted: track.muted,
        volume: track.volume,
        clips: track.clips.map((clip) => ({
          position: clip.position,
          startMs: clip.startMs,
          durationMs: clip.durationMs,
          trimStartMs: clip.trimStartMs,
          trimEndMs: clip.trimEndMs,
          muted: clip.muted,
          volume: clip.volume,
          sourceAssetId: clip.sourceAsset?.id || null,
          sourceRenderVersionId: clip.sourceRenderVersion?.id || null,
        })),
      })),
    };
  }

  async function saveTimeline(next: ProjectTimeline) {
    if (!project) return;
    const data = await requestJson<{ timeline: ProjectTimeline }>(
      `/api/projects/${encodeURIComponent(project.id)}/timeline`,
      alnabiyKey,
      {
        method: "PATCH",
        body: JSON.stringify(timelineUpdateFrom(next)),
      }
    );
    setTimeline(data.timeline);
  }

  async function addTimelineClip() {
    if (!timeline || !sourceChoice) return;
    const source = timelineSources.find((item) => item.value === sourceChoice);
    if (!source) return;
    const track = timeline.tracks.find((item) => item.kind === source.kind);
    if (!track) {
      setMessage(`No ${source.kind.toLowerCase()} track is available.`);
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const startMs = track.clips.reduce(
        (end, clip) => Math.max(end, clip.startMs + clip.durationMs),
        0
      );
      const next: ProjectTimeline = {
        ...timeline,
        tracks: timeline.tracks.map((item) =>
          item.id === track.id
            ? {
                ...item,
                clips: [
                  ...item.clips,
                  {
                    id: `draft-${Date.now()}`,
                    position: item.clips.length,
                    startMs,
                    durationMs: source.kind === "AUDIO" ? 5_000 : 5_000,
                    trimStartMs: 0,
                    trimEndMs: 0,
                    muted: false,
                    volume: 1,
                    sourceAsset:
                      source.value.startsWith("asset:")
                        ? {
                            id: source.value.slice("asset:".length),
                            label: source.label,
                            kind: source.kind,
                          }
                        : null,
                    sourceRenderVersion:
                      source.value.startsWith("version:")
                        ? {
                            id: source.value.slice("version:".length),
                            number: 0,
                            status: "COMPLETED",
                            provider: null,
                            model: null,
                          }
                        : null,
                  },
                ],
              }
            : item
        ),
      };
      await saveTimeline(next);
      setSourceChoice("");
      setMessage("Clip added to the persisted project timeline.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save timeline");
    } finally {
      setSaving(false);
    }
  }

  async function updateTimelineClip(
    trackId: string,
    clipId: string,
    patch: Partial<Pick<ProjectTimelineClip, "startMs" | "durationMs" | "muted" | "volume">>
  ) {
    if (!timeline) return;
    setSaving(true);
    setMessage(null);
    try {
      const next: ProjectTimeline = {
        ...timeline,
        tracks: timeline.tracks.map((track) =>
          track.id === trackId
            ? {
                ...track,
                clips: track.clips.map((clip) =>
                  clip.id === clipId ? { ...clip, ...patch } : clip
                ),
              }
            : track
        ),
      };
      await saveTimeline(next);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update clip");
    } finally {
      setSaving(false);
    }
  }

  async function removeTimelineClip(trackId: string, clipId: string) {
    if (!timeline) return;
    setSaving(true);
    setMessage(null);
    try {
      const next: ProjectTimeline = {
        ...timeline,
        tracks: timeline.tracks.map((track) =>
          track.id === trackId
            ? {
                ...track,
                clips: track.clips
                  .filter((clip) => clip.id !== clipId)
                  .map((clip, position) => ({ ...clip, position })),
              }
            : track
        ),
      };
      await saveTimeline(next);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update timeline");
    } finally {
      setSaving(false);
    }
  }

  async function requestExport() {
    if (!project || !timeline) return;
    setSaving(true);
    setMessage(null);
    try {
      const idempotencyKey =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `export-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const data = await requestJson<{
        projectExport: ProjectExport;
        configurationRequired: string | null;
      }>(`/api/projects/${encodeURIComponent(project.id)}/exports`, alnabiyKey, {
        method: "POST",
        body: JSON.stringify({
          timelineRevision: timeline.revision,
          idempotencyKey,
          format: "mp4",
          quality: "1080p",
          frameRate: timeline.fps,
          audioMix: timeline.audioMix,
        }),
      });
      setProjectExport(data.projectExport);
      setMessage(
        data.configurationRequired ||
          (data.projectExport.status === "QUEUED"
            ? "Export queued. It will appear here when ready."
            : `Export status: ${data.projectExport.status.toLowerCase()}.`)
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not request export");
    } finally {
      setSaving(false);
    }
  }

  async function refreshExport() {
    if (!project || !projectExport) return;
    setSaving(true);
    try {
      const data = await requestJson<{ projectExport: ProjectExport }>(
        `/api/projects/${encodeURIComponent(project.id)}/exports/${encodeURIComponent(projectExport.id)}`,
        alnabiyKey
      );
      setProjectExport(data.projectExport);
      setMessage(`Export status: ${data.projectExport.status.toLowerCase()}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not refresh export");
    } finally {
      setSaving(false);
    }
  }

  async function createProject() {
    const title = newTitle.trim() || prompt.trim().slice(0, 60) || "Untitled project";
    setSaving(true);
    setMessage(null);
    try {
      const data = await requestJson<{ project: ProjectSummary }>(
        "/api/projects",
        alnabiyKey,
        {
          method: "POST",
          body: JSON.stringify({ title, brief: prompt.trim() || null }),
        }
      );
      setNewTitle("");
      await loadProjects();
      await selectProject(data.project.id);
      setMessage("Project created. Add a shot, then render into this project.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create project");
    } finally {
      setSaving(false);
    }
  }

  async function saveBrief() {
    if (!project) return;
    setSaving(true);
    setMessage(null);
    try {
      await requestJson(`/api/projects/${encodeURIComponent(project.id)}`, alnabiyKey, {
        method: "PATCH",
        body: JSON.stringify({ brief: brief.trim() || null }),
      });
      await Promise.all([loadProjects(), loadProject(project.id)]);
      setMessage("Brief saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save brief");
    } finally {
      setSaving(false);
    }
  }

  async function addShot() {
    if (!project) return;
    setSaving(true);
    setMessage(null);
    try {
      const data = await requestJson<{ shot: ProjectShot }>(
        `/api/projects/${encodeURIComponent(project.id)}/shots`,
        alnabiyKey,
        {
          method: "POST",
          body: JSON.stringify({
            title: `Shot ${project.shots.length + 1}`,
            prompt: prompt.trim() || null,
          }),
        }
      );
      await Promise.all([loadProjects(), loadProject(project.id)]);
      setActiveShotId(data.shot.id);
      onShotChange(data.shot.id);
      onUseShot(data.shot);
      setMessage("Shot added. Its render versions will stay together.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add shot");
    } finally {
      setSaving(false);
    }
  }

  async function attachLatestGeneration() {
    if (!project || !latestGenerationId) return;
    setSaving(true);
    setMessage(null);
    try {
      await requestJson(
        `/api/projects/${encodeURIComponent(project.id)}/assets`,
        alnabiyKey,
        {
          method: "POST",
          body: JSON.stringify({ sourceGenerationId: latestGenerationId }),
        }
      );
      await loadProject(project.id);
      setMessage("Private generated asset attached to this project.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Only completed private generations can be attached"
      );
    } finally {
      setSaving(false);
    }
  }

  async function approveLatestVersion() {
    if (!project || !latestVersion) return;
    setSaving(true);
    setMessage(null);
    try {
      await requestJson(
        `/api/projects/${encodeURIComponent(project.id)}/approvals`,
        alnabiyKey,
        {
          method: "POST",
          body: JSON.stringify({
            renderVersionId: latestVersion.id,
            decision: "APPROVED",
          }),
        }
      );
      await loadProject(project.id);
      setMessage("Render approved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not approve render");
    } finally {
      setSaving(false);
    }
  }

  return (
    <StudioAccordion title="Project workflow">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <select
            className="nabi-input min-w-0 flex-1 rounded-lg px-2 py-1.5 text-xs"
            value={project?.id || ""}
            onChange={(event) => {
              if (event.target.value) void selectProject(event.target.value);
            }}
            disabled={saving}
            aria-label="Select project"
          >
            <option value="">Select a project</option>
            {projects.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title} · {item._count.shots} shots
              </option>
            ))}
          </select>
          <button
            type="button"
            className="nabi-select px-2.5 py-1.5 text-xs"
            onClick={() => void createProject()}
            disabled={saving}
          >
            <FolderPlus size={13} />
            New
          </button>
        </div>

        {!project && (
          <input
            className="nabi-input w-full rounded-lg px-2 py-1.5 text-xs"
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            placeholder="New project title (uses your prompt if blank)"
            maxLength={120}
          />
        )}

        {project && (
          <>
            <textarea
              className="nabi-input min-h-20 w-full resize-y rounded-lg px-2 py-2 text-xs"
              value={brief}
              onChange={(event) => setBrief(event.target.value)}
              placeholder="Creative brief: audience, style, outcome, constraints"
              maxLength={8000}
              aria-label="Project brief"
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="nabi-select px-2.5 py-1.5 text-xs"
                onClick={() => void saveBrief()}
                disabled={saving}
              >
                <Save size={13} />
                Save brief
              </button>
              <span className="text-[11px] text-white/45">
                {project.spentNc + project.reservedNc}
                {project.spendCapNc ? ` / ${project.spendCapNc}` : ""} NC committed
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <select
                className="nabi-input min-w-0 flex-1 rounded-lg px-2 py-1.5 text-xs"
                value={activeShotId || ""}
                onChange={(event) => {
                  const nextId = event.target.value || null;
                  setActiveShotId(nextId);
                  onShotChange(nextId);
                  const shot = project.shots.find((item) => item.id === nextId);
                  if (shot) onUseShot(shot);
                }}
                disabled={saving}
                aria-label="Select shot"
              >
                <option value="">Project-level render</option>
                {project.shots.map((shot) => (
                  <option key={shot.id} value={shot.id}>
                    {shot.position}. {shot.title} · {shot.renderVersions.length} versions
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="nabi-select px-2.5 py-1.5 text-xs"
                onClick={() => void addShot()}
                disabled={saving}
              >
                <Plus size={13} />
                Shot
              </button>
            </div>

            {activeShot && (
              <p className="text-[11px] text-white/45">
                {activeShot.prompt || "No shot prompt yet"} ·{" "}
                {activeShot.durationSec ? `${activeShot.durationSec}s` : "route duration"}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/45">
              <span>
                {project.assets.length} private assets ·{" "}
                {project.shots.reduce(
                  (total, shot) => total + shot.renderVersions.length,
                  project.renderVersions.length
                )} render versions
              </span>
              {latestGenerationId && (
                <button
                  type="button"
                  className="nabi-select px-2 py-1 text-[11px]"
                  onClick={() => void attachLatestGeneration()}
                  disabled={saving}
                >
                  Attach current render
                </button>
              )}
              {latestVersion &&
                latestVersion.status === "COMPLETED" &&
                latestVersion.approvals[0]?.decision !== "APPROVED" && (
                  <button
                    type="button"
                    className={clsx("nabi-select px-2 py-1 text-[11px]", "nabi-select-on")}
                    onClick={() => void approveLatestVersion()}
                    disabled={saving}
                  >
                    <Check size={12} />
                    Approve latest
                  </button>
                )}
            </div>

            <div className="space-y-2 rounded-lg border border-white/10 bg-black/15 p-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-1 text-[11px] font-medium text-white/70">
                  <Clapperboard size={13} />
                  Project timeline
                  {timeline ? ` · rev ${timeline.revision}` : ""}
                </p>
                {timeline && (
                  <span className="font-mono text-[10px] text-white/40">
                    {(timeline.durationMs / 1000).toFixed(1)}s · {timeline.fps}fps
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <select
                  className="nabi-input min-w-0 flex-1 rounded-lg px-2 py-1.5 text-xs"
                  value={sourceChoice}
                  onChange={(event) => setSourceChoice(event.target.value)}
                  disabled={saving || !timeline}
                  aria-label="Select project media for timeline"
                >
                  <option value="">Add project media to timeline</option>
                  {timelineSources.map((source) => (
                    <option key={source.value} value={source.value}>
                      {source.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="nabi-select px-2.5 py-1.5 text-xs"
                  onClick={() => void addTimelineClip()}
                  disabled={saving || !timeline || !sourceChoice}
                >
                  <Plus size={13} />
                  Clip
                </button>
              </div>

              {timeline?.tracks.map((track) => (
                <div key={track.id} className="space-y-1">
                  <p className="text-[10px] uppercase tracking-wide text-white/40">
                    {track.name} · {track.kind.toLowerCase()}
                  </p>
                  {track.clips.length === 0 ? (
                    <p className="text-[11px] text-white/35">No clips yet.</p>
                  ) : (
                    track.clips.map((clip) => (
                      <div
                        key={clip.id}
                        className="grid grid-cols-[minmax(0,1fr)_3.3rem_3.3rem_auto] items-center gap-1.5 text-[10px]"
                      >
                        <span className="truncate text-white/60">
                          {clip.sourceAsset?.label ||
                            (clip.sourceRenderVersion
                              ? `Render v${clip.sourceRenderVersion.number}`
                              : "Private media")}
                        </span>
                        <input
                          type="number"
                          min={0}
                          step={0.1}
                          value={(clip.startMs / 1000).toFixed(1)}
                          onChange={(event) => {
                            const sec = Math.max(0, Number(event.target.value) || 0);
                            setTimeline((current) =>
                              current
                                ? {
                                    ...current,
                                    tracks: current.tracks.map((item) =>
                                      item.id === track.id
                                        ? {
                                            ...item,
                                            clips: item.clips.map((itemClip) =>
                                              itemClip.id === clip.id
                                                ? { ...itemClip, startMs: Math.round(sec * 1000) }
                                                : itemClip
                                            ),
                                          }
                                        : item
                                    ),
                                  }
                                : current
                            );
                          }}
                          onBlur={(event) =>
                            void updateTimelineClip(track.id, clip.id, {
                              startMs: Math.round(
                                Math.max(0, Number(event.currentTarget.value) || 0) * 1000
                              ),
                            })
                          }
                          className="nabi-input w-full rounded px-1 py-1 text-[10px]"
                          aria-label="Clip start seconds"
                        />
                        <input
                          type="number"
                          min={0.1}
                          step={0.1}
                          value={(clip.durationMs / 1000).toFixed(1)}
                          onChange={(event) => {
                            const sec = Math.max(0.1, Number(event.target.value) || 0.1);
                            setTimeline((current) =>
                              current
                                ? {
                                    ...current,
                                    tracks: current.tracks.map((item) =>
                                      item.id === track.id
                                        ? {
                                            ...item,
                                            clips: item.clips.map((itemClip) =>
                                              itemClip.id === clip.id
                                                ? { ...itemClip, durationMs: Math.round(sec * 1000) }
                                                : itemClip
                                            ),
                                          }
                                        : item
                                    ),
                                  }
                                : current
                            );
                          }}
                          onBlur={(event) =>
                            void updateTimelineClip(track.id, clip.id, {
                              durationMs: Math.round(
                                Math.max(0.1, Number(event.currentTarget.value) || 0.1) * 1000
                              ),
                            })
                          }
                          className="nabi-input w-full rounded px-1 py-1 text-[10px]"
                          aria-label="Clip duration seconds"
                        />
                        <button
                          type="button"
                          className="text-white/35 transition hover:text-rose-300"
                          onClick={() => void removeTimelineClip(track.id, clip.id)}
                          disabled={saving}
                          aria-label="Remove clip"
                        >
                          ×
                        </button>
                      </div>
                    ))
                  )}
                </div>
              ))}

              <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-2">
                <button
                  type="button"
                  className="nabi-select nabi-select-on px-2.5 py-1.5 text-xs"
                  onClick={() => void requestExport()}
                  disabled={saving || !timeline || timeline.durationMs <= 0}
                >
                  <Send size={13} />
                  Export MP4
                </button>
                {projectExport && (
                  <>
                    <span className="text-[11px] text-white/50">
                      Export {projectExport.status.toLowerCase()}
                      {projectExport.creditsCost > 0
                        ? ` · ${projectExport.creditsCost} NC`
                        : ""}
                    </span>
                    <button
                      type="button"
                      className="nabi-select px-2 py-1 text-[11px]"
                      onClick={() => void refreshExport()}
                      disabled={saving}
                    >
                      <RefreshCw size={11} />
                      Refresh
                    </button>
                    {projectExport.deliveryUrl && (
                      <a
                        href={projectExport.deliveryUrl}
                        className="text-[11px] text-nabi-gold hover:underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Download
                      </a>
                    )}
                  </>
                )}
              </div>
              {projectExport?.errorMessage && (
                <p className="text-[11px] text-amber-300">{projectExport.errorMessage}</p>
              )}
              {!timeline && (
                <p className="text-[11px] text-white/40">Loading persisted project timeline…</p>
              )}
            </div>
          </>
        )}

        {message && <p className="text-[11px] text-white/55">{message}</p>}
      </div>
    </StudioAccordion>
  );
}
