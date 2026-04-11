"use client";

import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai/react";
import {
  configJsonAtom,
  selectedVideoConfigAtom,
  parsedConfigAtom,
  selectedVideoAtom,
  pickModeAtom,
  pickedSelectorAtom,
  renderStatusAtom,
  renderLogsAtom,
  lastRenderOutputAtom,
  videoNamesAtom,
  selectedStepIndexAtom,
  simulationStatusAtom,
  simulationSpeedAtom,
  simulationStepAtom,
  highlightFoundAtom,
  replayStateAtom,
  replayedThroughStepAtom,
} from "@/store/config";
import type { ThemeConfig, Step, WindowConfig, BackgroundConfig } from "@/store/config";
import {
  Globe,
  RefreshCw,
  ExternalLink,
  Crosshair,
  Copy,
  X,
  Play,
  Pause,
  Square,
  Film,
  Download,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { SimulationControls } from "@/components/simulation-controls";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

const CURSOR_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87c.45 0 .67-.54.35-.85L5.85 2.35a.5.5 0 0 0-.35.86z" fill="#fff" stroke="#000" stroke-width="1.5" stroke-linejoin="round"/></svg>';

function buildCursorStyle(size: number, hotspot: "top-left" | "center"): string {
  const scaledSvg = CURSOR_SVG.replace(
    /width="24" height="24"/,
    `width="${size}" height="${size}"`,
  );
  const encoded = encodeURIComponent(scaledSvg)
    .replace(/%20/g, " ")
    .replace(/%22/g, "'")
    .replace(/%3D/g, "=")
    .replace(/%3A/g, ":")
    .replace(/%2F/g, "/");

  const hx = hotspot === "center" ? Math.round(size / 2) : Math.round(size * 0.2);
  const hy = hotspot === "center" ? Math.round(size / 2) : Math.round(size * 0.1);

  return `url("data:image/svg+xml,${encoded}") ${hx} ${hy}, auto`;
}

function useContainerSize(ref: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}

function resolveUrl(url: string, baseUrl?: string, configBaseUrl?: string) {
  const base = baseUrl || configBaseUrl;
  if (!base) return url;
  try {
    return new URL(url, base).href;
  } catch {
    return url;
  }
}

function buildThemePayload(videoTheme?: ThemeConfig, configTheme?: ThemeConfig) {
  return {
    cursor: {
      size: videoTheme?.cursor?.size ?? configTheme?.cursor?.size ?? 24,
      hotspot: videoTheme?.cursor?.hotspot ?? configTheme?.cursor?.hotspot ?? "top-left",
    },
    hud: {
      background:
        videoTheme?.hud?.background ?? configTheme?.hud?.background ?? "rgba(0,0,0,0.5)",
      color:
        videoTheme?.hud?.color ?? configTheme?.hud?.color ?? "rgba(255,255,255,0.85)",
      fontSize: videoTheme?.hud?.fontSize ?? configTheme?.hud?.fontSize ?? 56,
      fontFamily:
        videoTheme?.hud?.fontFamily ??
        configTheme?.hud?.fontFamily ??
        '"Geist", -apple-system, BlinkMacSystemFont, sans-serif',
      borderRadius: videoTheme?.hud?.borderRadius ?? configTheme?.hud?.borderRadius ?? 18,
      position: videoTheme?.hud?.position ?? configTheme?.hud?.position ?? "bottom",
    },
  };
}

function RenderConsole() {
  const [renderStatus, setRenderStatus] = useAtom(renderStatusAtom);
  const [renderLogs, setRenderLogs] = useAtom(renderLogsAtom);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [renderLogs]);

  if (renderStatus === "idle" && renderLogs.length === 0) return null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 px-3 py-1.5">
        <span
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            renderStatus === "running" && "animate-pulse bg-warning",
            renderStatus === "done" && "bg-success",
            renderStatus === "error" && "bg-destructive",
            renderStatus === "idle" && "bg-muted-foreground/30",
          )}
        />
        <span className="text-[11px] text-muted-foreground">
          {renderStatus === "running"
            ? "Recording..."
            : renderStatus === "done"
              ? "Recording complete"
              : renderStatus === "error"
                ? "Recording failed"
                : "Output"}
        </span>
        <div className="ml-auto flex items-center gap-1">
          {renderLogs.length > 0 && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => {
                setRenderLogs([]);
                setRenderStatus("idle");
              }}
              title="Clear"
            >
              <X className="size-3" />
            </Button>
          )}
        </div>
      </div>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto bg-card/80 px-3 py-2">
        {renderLogs.map((line, i) => (
          <div
            key={i}
            className={cn(
              "font-mono text-[10px] leading-relaxed",
              line.startsWith("[err]") ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {line.startsWith("[err]") ? line.slice(5) : line}
          </div>
        ))}
        {renderLogs.length === 0 && (
          <p className="text-[10px] text-muted-foreground/40">No output yet</p>
        )}
      </div>
    </div>
  );
}

function sendToIframe(
  iframeRef: React.RefObject<HTMLIFrameElement | null>,
  type: string,
  payload?: Record<string, unknown>,
) {
  iframeRef.current?.contentWindow?.postMessage({ type, payload }, "*");
}

function buildBackgroundStyle(bg?: BackgroundConfig): React.CSSProperties {
  if (!bg) return { background: "#e0e0e0" };
  switch (bg.type) {
    case "gradient": {
      const { from = "#667eea", to = "#764ba2", angle = 180 } = bg.gradient ?? {};
      return { background: `linear-gradient(${angle}deg, ${from}, ${to})` };
    }
    case "image":
      return {
        backgroundImage: bg.image ? `url(${bg.image})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundColor: "#e0e0e0",
      };
    case "solid":
    default:
      return { background: bg.color ?? "#e0e0e0" };
  }
}

function buildShadowStyle(shadow?: WindowConfig["shadow"]): string | undefined {
  if (!shadow) return undefined;
  const blur = typeof shadow === "object" ? (shadow.blur ?? 40) : 40;
  const color =
    typeof shadow === "object"
      ? (shadow.color ?? "rgba(0,0,0,0.35)")
      : "rgba(0,0,0,0.35)";
  const offsetY = typeof shadow === "object" ? (shadow.offsetY ?? 10) : 10;
  return `0 ${offsetY}px ${blur}px ${color}`;
}

function formatElapsed(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function PreviewWithChrome({
  canvasW,
  canvasH,
  vpWidth,
  vpHeight,
  scale,
  titlebarH,
  titlebarVisible,
  borderRadius,
  windowCfg,
  backgroundCfg,
  iframeKey,
  iframeRef,
  iframeSrc,
  selectedVideo,
  pickMode,
  previewCursor,
}: {
  canvasW: number;
  canvasH: number;
  vpWidth: number;
  vpHeight: number;
  scale: number;
  titlebarH: number;
  titlebarVisible: boolean;
  borderRadius: number;
  windowCfg?: WindowConfig;
  backgroundCfg?: BackgroundConfig;
  iframeKey: number;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  iframeSrc: string;
  selectedVideo: string | null;
  pickMode: boolean;
  previewCursor: string;
}) {
  const windowTotalH = vpHeight + titlebarH;
  let winX: number;
  let winY: number;
  if (
    windowCfg?.position &&
    typeof windowCfg.position === "object" &&
    "x" in windowCfg.position
  ) {
    winX = windowCfg.position.x;
    winY = windowCfg.position.y;
  } else {
    winX = Math.round((canvasW - vpWidth) / 2);
    winY = Math.round((canvasH - windowTotalH) / 2);
  }

  const shadow = buildShadowStyle(windowCfg?.shadow);
  const tbBg = windowCfg?.titlebar?.background ?? "#e8e8e8";
  const tbStoplight = windowCfg?.titlebar?.stoplight !== false;
  const tbTitle = windowCfg?.titlebar?.title ?? "";

  return (
    <div
      className={cn("relative overflow-hidden", pickMode && "ring-2 ring-blue-500/50")}
      style={{
        width: canvasW * scale,
        height: canvasH * scale,
        cursor: previewCursor,
      }}
    >
      <div
        style={{
          width: canvasW,
          height: canvasH,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          position: "relative",
          ...buildBackgroundStyle(backgroundCfg),
        }}
      >
        <div
          style={{
            position: "absolute",
            left: winX,
            top: winY,
            width: vpWidth,
            borderRadius,
            boxShadow: shadow,
            overflow: "hidden",
          }}
        >
          {titlebarVisible && titlebarH > 0 && (
            <div
              style={{
                height: titlebarH,
                background: tbBg,
                display: "flex",
                alignItems: "center",
                paddingLeft: 16,
                paddingRight: 16,
                position: "relative",
                userSelect: "none",
              }}
            >
              {tbStoplight && (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      background: "#FF5F57",
                      display: "inline-block",
                    }}
                  />
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      background: "#FEBC2E",
                      display: "inline-block",
                    }}
                  />
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      background: "#28C840",
                      display: "inline-block",
                    }}
                  />
                </div>
              )}
              {tbTitle && (
                <span
                  style={{
                    position: "absolute",
                    left: "50%",
                    transform: "translateX(-50%)",
                    fontSize: 12,
                    color: "#4d4d4d",
                    fontFamily: "system-ui, -apple-system, sans-serif",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: "60%",
                  }}
                >
                  {tbTitle}
                </span>
              )}
            </div>
          )}
          <iframe
            key={iframeKey}
            ref={iframeRef}
            src={iframeSrc}
            title={`Preview: ${selectedVideo}`}
            style={{
              width: vpWidth,
              height: vpHeight,
              border: "none",
              display: "block",
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function Preview() {
  const videoConfig = useAtomValue(selectedVideoConfigAtom);
  const { config } = useAtomValue(parsedConfigAtom);
  const configJson = useAtomValue(configJsonAtom);
  const selectedVideo = useAtomValue(selectedVideoAtom);
  const videoNames = useAtomValue(videoNamesAtom);
  const selectedStep = useAtomValue(selectedStepIndexAtom);
  const { resolvedTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerSize = useContainerSize(containerRef);
  const [iframeKey, setIframeKey] = useState(0);
  const [pickMode, setPickMode] = useAtom(pickModeAtom);
  const [pickedSelector, setPickedSelector] = useAtom(pickedSelectorAtom);
  const [copied, setCopied] = useState(false);
  const [renderStatus, setRenderStatus] = useAtom(renderStatusAtom);
  const [renderLogs, setRenderLogs] = useAtom(renderLogsAtom);
  const [lastRenderOutput, setLastRenderOutput] = useAtom(lastRenderOutputAtom);
  const abortRef = useRef<AbortController | null>(null);
  const [canvasMode, setCanvasMode] = useState<"preview" | "playback">("preview");
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const recordingStartRef = useRef(0);
  const [recordingElapsed, setRecordingElapsed] = useState(0);
  const [simulationStatus, setSimulationStatus] = useAtom(simulationStatusAtom);
  const simulationSpeed = useAtomValue(simulationSpeedAtom);
  const setSimulationStep = useSetAtom(simulationStepAtom);
  const setHighlightFound = useSetAtom(highlightFoundAtom);
  const [iframeReady, setIframeReady] = useState(false);
  const [replayState, setReplayState] = useAtom(replayStateAtom);
  const [replayedThrough, setReplayedThrough] = useAtom(replayedThroughStepAtom);
  const replayAbortRef = useRef(false);
  const readyResolverRef = useRef<(() => void) | null>(null);
  const executeResolverRef = useRef<(() => void) | null>(null);
  const showConsole =
    canvasMode !== "playback" && (renderStatus !== "idle" || renderLogs.length > 0);

  const cursorSize =
    videoConfig?.theme?.cursor?.size ?? config?.theme?.cursor?.size ?? 24;
  const cursorHotspot =
    videoConfig?.theme?.cursor?.hotspot ?? config?.theme?.cursor?.hotspot ?? "top-left";
  const previewCursor = useMemo(
    () => buildCursorStyle(cursorSize, cursorHotspot),
    [cursorSize, cursorHotspot],
  );

  const vpWidth =
    typeof videoConfig?.viewport === "object"
      ? (videoConfig.viewport?.width ?? 1920)
      : 1920;
  const vpHeight =
    typeof videoConfig?.viewport === "object"
      ? (videoConfig.viewport?.height ?? 1080)
      : 1080;

  const screenCfg = videoConfig?.screen;
  const windowCfg = videoConfig?.window;
  const backgroundCfg = videoConfig?.background;
  const hasChrome = !!screenCfg;

  const titlebarVisible = windowCfg?.titlebar?.visible ?? false;
  const titlebarH = titlebarVisible ? (windowCfg?.titlebar?.height ?? 36) : 0;
  const borderRadius = windowCfg?.borderRadius ?? (titlebarVisible ? 10 : 0);

  const canvasW = hasChrome ? screenCfg.width : vpWidth;
  const canvasH = hasChrome ? screenCfg.height : vpHeight;

  const padding = 32;
  const availW = Math.max(containerSize.width - padding * 2, 1);
  const availH = Math.max(containerSize.height - padding * 2, 1);
  const scale = Math.min(availW / canvasW, availH / canvasH, 1);

  const resolvedUrl = videoConfig
    ? resolveUrl(videoConfig.url, videoConfig.baseUrl, config?.baseUrl)
    : null;

  const isLoadable =
    resolvedUrl &&
    (resolvedUrl.startsWith("http://") || resolvedUrl.startsWith("https://"));

  const iframeSrc = isLoadable
    ? `/api/proxy?url=${encodeURIComponent(resolvedUrl)}&mode=preview`
    : null;

  const reload = useCallback(() => {
    setIframeReady(false);
    setIframeKey((k) => k + 1);
  }, []);

  const togglePickMode = useCallback(() => {
    setPickMode((prev) => {
      const next = !prev;
      sendToIframe(iframeRef, next ? "webreel:pick:enable" : "webreel:pick:disable");
      return next;
    });
    setPickedSelector(null);
    setCopied(false);
  }, [setPickMode, setPickedSelector]);

  // Listen for messages from iframe
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (!e.data || typeof e.data.type !== "string") return;

      switch (e.data.type) {
        case "webreel:pick":
          if (e.data.payload && typeof e.data.payload.selector === "string") {
            setPickedSelector(e.data.payload.selector);
            setPickMode(false);
          }
          break;
        case "webreel:ready":
          setIframeReady(true);
          if (readyResolverRef.current) {
            readyResolverRef.current();
            readyResolverRef.current = null;
          }
          if (executeResolverRef.current) {
            executeResolverRef.current();
            executeResolverRef.current = null;
          }
          break;
        case "webreel:execute:done":
          if (executeResolverRef.current) {
            executeResolverRef.current();
            executeResolverRef.current = null;
          }
          break;
        case "webreel:highlight:result":
          setHighlightFound(e.data.payload?.found ?? null);
          break;
        case "webreel:simulate:progress":
          if (typeof e.data.payload?.index === "number") {
            setSimulationStep(e.data.payload.index);
          }
          break;
        case "webreel:simulate:complete":
          setSimulationStatus("idle");
          setSimulationStep(-1);
          break;
        case "webreel:step:done":
          break;
        case "webreel:navigate":
          if (e.data.payload?.url && resolvedUrl) {
            const newUrl = new URL(e.data.payload.url as string, resolvedUrl).href;
            if (iframeRef.current) {
              setIframeReady(false);
              iframeRef.current.src = `/api/proxy?url=${encodeURIComponent(newUrl)}&mode=preview`;
            }
          }
          break;
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [
    setPickedSelector,
    setPickMode,
    setHighlightFound,
    setSimulationStep,
    setSimulationStatus,
    resolvedUrl,
  ]);

  const effectiveColorScheme =
    videoConfig?.colorScheme ?? (resolvedTheme === "dark" ? "dark" : "light");

  // Send webreel:init when iframe is ready or theme changes
  useEffect(() => {
    if (!iframeReady || pickMode) return;
    const themePayload = buildThemePayload(videoConfig?.theme, config?.theme);
    sendToIframe(iframeRef, "webreel:init", {
      ...themePayload,
      viewport: { width: vpWidth, height: vpHeight },
      colorScheme: effectiveColorScheme,
    });
  }, [
    iframeReady,
    pickMode,
    videoConfig?.theme,
    config?.theme,
    vpWidth,
    vpHeight,
    effectiveColorScheme,
  ]);

  // Update preview iframe when color scheme changes
  useEffect(() => {
    if (!iframeReady) return;
    sendToIframe(iframeRef, "webreel:colorScheme", { value: effectiveColorScheme });
  }, [iframeReady, effectiveColorScheme]);

  // ─── Replay to step (fast-forward with real DOM interactions) ─────────

  const waitForReady = useCallback(() => {
    return new Promise<void>((resolve) => {
      readyResolverRef.current = resolve;
    });
  }, []);

  const waitForExecute = useCallback(() => {
    return new Promise<void>((resolve) => {
      executeResolverRef.current = resolve;
    });
  }, []);

  const replayToStep = useCallback(
    async (targetIndex: number) => {
      if (!videoConfig || !iframeSrc || pickMode) return;
      const steps = videoConfig.steps;
      if (targetIndex < 0 || targetIndex >= steps.length) {
        if (targetIndex < 0) {
          setReplayState({ status: "idle", targetStep: -1, currentStep: -1 });
          setReplayedThrough(-1);
          sendToIframe(iframeRef, "webreel:highlight:clear");
          setHighlightFound(null);
        }
        return;
      }

      const canFastForward = replayedThrough >= 0 && targetIndex > replayedThrough;
      const startFrom = canFastForward ? replayedThrough + 1 : 0;

      replayAbortRef.current = false;
      setReplayState({
        status: "replaying",
        targetStep: targetIndex,
        currentStep: startFrom,
      });

      if (!canFastForward) {
        setIframeReady(false);
        const readyPromise = waitForReady();
        if (iframeRef.current) {
          iframeRef.current.src = iframeSrc;
        }
        await readyPromise;
        if (replayAbortRef.current) return;
      }

      sendToIframe(iframeRef, "webreel:safeguards:enable");

      for (let i = startFrom; i < targetIndex; i++) {
        if (replayAbortRef.current) break;
        setReplayState((prev) => ({ ...prev, currentStep: i }));

        const step = steps[i] as Step;
        const isNav = step.action === "navigate";

        if (isNav) {
          const execPromise = waitForReady();
          sendToIframe(iframeRef, "webreel:execute", { step, index: i });
          await execPromise;
          if (replayAbortRef.current) break;
          sendToIframe(iframeRef, "webreel:safeguards:enable");
        } else {
          const execPromise = waitForExecute();
          sendToIframe(iframeRef, "webreel:execute", { step, index: i });
          await execPromise;
          if (replayAbortRef.current) break;
        }
      }

      sendToIframe(iframeRef, "webreel:safeguards:disable");

      if (!replayAbortRef.current) {
        setReplayedThrough(targetIndex - 1);

        const targetStep = steps[targetIndex];
        const selector = targetStep.selector as string | undefined;
        const text = targetStep.text as string | undefined;
        const within = targetStep.within as string | undefined;
        if (selector || text) {
          sendToIframe(iframeRef, "webreel:highlight", { selector, text, within });
        } else {
          sendToIframe(iframeRef, "webreel:highlight:clear");
          setHighlightFound(null);
        }
      }

      setReplayState({
        status: "idle",
        targetStep: targetIndex,
        currentStep: targetIndex,
      });
    },
    [
      videoConfig,
      iframeSrc,
      pickMode,
      replayedThrough,
      waitForReady,
      waitForExecute,
      setReplayState,
      setReplayedThrough,
      setHighlightFound,
    ],
  );

  // Replay when selected step changes
  useEffect(() => {
    if (!iframeReady || pickMode) return;
    if (simulationStatus === "playing") return;
    if (replayState.status === "replaying") return;

    if (selectedStep < 0) {
      sendToIframe(iframeRef, "webreel:highlight:clear");
      setHighlightFound(null);
      return;
    }

    const steps = videoConfig?.steps ?? [];
    if (selectedStep >= steps.length) return;

    if (selectedStep === 0) {
      if (replayedThrough !== -1) {
        setIframeReady(false);
        setReplayedThrough(-1);
        const readyPromise = waitForReady();
        if (iframeRef.current && iframeSrc) {
          iframeRef.current.src = iframeSrc;
        }
        readyPromise.then(() => {
          const step = steps[0];
          const selector = step.selector as string | undefined;
          const text = step.text as string | undefined;
          const within = step.within as string | undefined;
          if (selector || text) {
            sendToIframe(iframeRef, "webreel:highlight", { selector, text, within });
          }
        });
      } else {
        const step = steps[0];
        const selector = step.selector as string | undefined;
        const text = step.text as string | undefined;
        const within = step.within as string | undefined;
        if (selector || text) {
          sendToIframe(iframeRef, "webreel:highlight", { selector, text, within });
        } else {
          sendToIframe(iframeRef, "webreel:highlight:clear");
          setHighlightFound(null);
        }
      }
      return;
    }

    replayToStep(selectedStep);
  }, [selectedStep]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset replay state when video changes or iframe reloads from user action
  useEffect(() => {
    setReplayedThrough(-1);
    replayAbortRef.current = true;
    setReplayState({ status: "idle", targetStep: -1, currentStep: -1 });
  }, [iframeSrc, setReplayedThrough, setReplayState]);

  const copySelector = useCallback(() => {
    if (!pickedSelector) return;
    navigator.clipboard.writeText(pickedSelector).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [pickedSelector]);

  const dismissSelector = useCallback(() => {
    setPickedSelector(null);
    setCopied(false);
  }, [setPickedSelector]);

  // ─── Recording timer ───────────────────────────────────────────────────────

  useEffect(() => {
    if (renderStatus === "running") {
      recordingStartRef.current = Date.now();
      setRecordingElapsed(0);
      const interval = setInterval(() => {
        setRecordingElapsed(Math.floor((Date.now() - recordingStartRef.current) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [renderStatus]);

  // ─── Auto-transition to playback on recording completion ───────────────────

  useEffect(() => {
    if (renderStatus === "done" && lastRenderOutput) {
      setCanvasMode("playback");
    }
  }, [renderStatus, lastRenderOutput]);

  useEffect(() => {
    if (canvasMode === "playback" && videoRef.current && lastRenderOutput) {
      videoRef.current.play().catch(() => {});
    }
  }, [canvasMode, lastRenderOutput]);

  // ─── Video playback controls ───────────────────────────────────────────────

  const toggleVideoPlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play();
    else v.pause();
  }, []);

  const videoSeekTo = useCallback((t: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = t;
      setVideoCurrentTime(t);
    }
  }, []);

  const videoFrameStep = useCallback((frames: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    v.currentTime = Math.max(0, Math.min(v.currentTime + frames / 60, v.duration || 0));
  }, []);

  // ─── Simulation controls ─────────────────────────────────────────────────

  const startSimulation = useCallback(
    (fromStep?: number) => {
      if (!iframeReady || !videoConfig) return;
      const steps = videoConfig.steps;
      if (steps.length === 0) return;
      setSimulationStatus("playing");
      setSimulationStep(fromStep ?? 0);
      sendToIframe(iframeRef, "webreel:reset");
      setTimeout(() => {
        sendToIframe(iframeRef, "webreel:simulate:run", {
          steps,
          speed: simulationSpeed,
          startIndex: fromStep ?? 0,
        });
      }, 100);
    },
    [iframeReady, videoConfig, simulationSpeed, setSimulationStatus, setSimulationStep],
  );

  const stopSimulation = useCallback(() => {
    sendToIframe(iframeRef, "webreel:simulate:stop");
    setSimulationStatus("idle");
    setSimulationStep(-1);
    sendToIframe(iframeRef, "webreel:reset");
  }, [setSimulationStatus, setSimulationStep]);

  const simulateOneStep = useCallback(
    (stepIndex: number) => {
      if (!iframeReady || !videoConfig) return;
      const steps = videoConfig.steps;
      if (stepIndex < 0 || stepIndex >= steps.length) return;
      sendToIframe(iframeRef, "webreel:simulate:step", {
        step: steps[stepIndex],
        index: stepIndex,
        total: steps.length,
        speed: simulationSpeed,
      });
    },
    [iframeReady, videoConfig, simulationSpeed],
  );

  // ─── Recording ────────────────────────────────────────────────────────────

  const startRender = useCallback(
    async (videos?: string[]) => {
      if (renderStatus === "running" || !config) return;
      const videosToRecord = videos ?? (selectedVideo ? [selectedVideo] : []);
      if (videosToRecord.length === 0) return;

      setRenderStatus("running");
      setRenderLogs([]);
      setLastRenderOutput(null);
      setCanvasMode("preview");

      const abort = new AbortController();
      abortRef.current = abort;

      try {
        const parsedConfig = JSON.parse(configJson);
        if (parsedConfig.colorScheme === undefined) {
          parsedConfig.colorScheme = resolvedTheme === "dark" ? "dark" : "light";
        }
        const response = await fetch("/api/render", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            config: parsedConfig,
            videos: videosToRecord.length > 1 ? videosToRecord : undefined,
            video: videosToRecord.length === 1 ? videosToRecord[0] : undefined,
          }),
          signal: abort.signal,
        });

        if (!response.ok || !response.body) {
          setRenderStatus("error");
          setRenderLogs((prev) => [
            ...prev,
            `[err]HTTP ${response.status}: ${response.statusText}`,
          ]);
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const event = JSON.parse(line.slice(6)) as { type: string; data: string };
              if (event.type === "stdout") {
                setRenderLogs((prev) => [...prev, event.data]);
                const outputMatch = event.data.match(/Done:\s*(.+\.(mp4|webm|gif))/i);
                if (outputMatch) setLastRenderOutput(outputMatch[1]);
              } else if (event.type === "stderr") {
                setRenderLogs((prev) => [...prev, `[err]${event.data}`]);
              } else if (event.type === "exit") {
                const code = parseInt(event.data, 10);
                setRenderStatus(code === 0 ? "done" : "error");
              } else if (event.type === "error") {
                setRenderLogs((prev) => [...prev, `[err]${event.data}`]);
                setRenderStatus("error");
              }
            } catch {}
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setRenderStatus("error");
          setRenderLogs((prev) => [
            ...prev,
            `[err]${err instanceof Error ? err.message : "Unknown error"}`,
          ]);
        }
      } finally {
        abortRef.current = null;
      }
    },
    [
      renderStatus,
      config,
      configJson,
      selectedVideo,
      resolvedTheme,
      setRenderStatus,
      setRenderLogs,
      setLastRenderOutput,
    ],
  );

  const stopRender = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      setRenderStatus("idle");
      setRenderLogs((prev) => [...prev, "Cancelled by user"]);
    }
  }, [setRenderStatus, setRenderLogs]);

  const videoSrc = lastRenderOutput
    ? `/api/video?path=${encodeURIComponent(lastRenderOutput)}`
    : null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 px-3 py-2">
        <span className="text-xs text-muted-foreground">
          {canvasMode === "playback" ? "Playback" : "Canvas"}
        </span>
        {videoConfig && resolvedUrl && (
          <div className="ml-auto flex items-center gap-1.5">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
              <Globe className="size-3" />
              <span className="max-w-[200px] truncate">{resolvedUrl}</span>
              <span>
                {vpWidth}x{vpHeight}
                {hasChrome && ` @ ${canvasW}x${canvasH}`}
              </span>
            </div>

            {canvasMode === "playback" ? (
              <>
                {videoSrc && (
                  <Button variant="ghost" size="icon-xs" asChild>
                    <a href={videoSrc} download title="Download">
                      <Download className="size-3" />
                    </a>
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setCanvasMode("preview")}
                  className="gap-1"
                >
                  <X className="size-3" />
                  Close
                </Button>
              </>
            ) : (
              <>
                {isLoadable && (
                  <Button
                    variant={pickMode ? "default" : "ghost"}
                    size="icon-xs"
                    onClick={togglePickMode}
                    title={pickMode ? "Cancel picker" : "Pick element"}
                    className={cn(pickMode && "bg-blue-600 text-white hover:bg-blue-700")}
                  >
                    <Crosshair className="size-3" />
                  </Button>
                )}
                {renderStatus === "running" ? (
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={stopRender}
                    className="gap-1 text-destructive"
                  >
                    <Square className="size-3" />
                    Stop
                  </Button>
                ) : (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="xs" className="gap-1">
                        <Play className="size-3" />
                        Record
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onSelect={() => startRender()}>
                        <Play className="size-3.5" />
                        Record current
                        {selectedVideo && (
                          <span className="ml-auto text-[10px] text-muted-foreground">
                            {selectedVideo}
                          </span>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => startRender(videoNames)}
                        disabled={videoNames.length <= 1}
                      >
                        <Film className="size-3.5" />
                        Record all ({videoNames.length})
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                {renderStatus === "done" && lastRenderOutput && (
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => setCanvasMode("playback")}
                    className="gap-1"
                  >
                    <Film className="size-3" />
                    Play
                  </Button>
                )}
                {isLoadable && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={reload}
                      title="Reload"
                    >
                      <RefreshCw className="size-3" />
                    </Button>
                    <Button variant="ghost" size="icon-xs" asChild>
                      <a
                        href={resolvedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open in new tab"
                      >
                        <ExternalLink className="size-3" />
                      </a>
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {canvasMode === "preview" && pickedSelector && (
        <div className="flex shrink-0 items-center gap-2 border-b bg-card px-3 py-1.5">
          <code className="min-w-0 flex-1 truncate text-[11px] text-foreground">
            {pickedSelector}
          </code>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={copySelector}
            title="Copy selector"
          >
            <Copy className="size-3" />
          </Button>
          {copied && <span className="text-[10px] text-success">Copied</span>}
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={dismissSelector}
            title="Dismiss"
          >
            <X className="size-3" />
          </Button>
        </div>
      )}

      {canvasMode === "preview" && pickMode && (
        <div className="flex shrink-0 items-center gap-2 border-b bg-blue-600/10 px-3 py-1">
          <Crosshair className="size-3 text-blue-400" />
          <span className="text-[11px] text-blue-400">
            Click an element in the page to get its selector
          </span>
        </div>
      )}

      {canvasMode === "preview" && (
        <SimulationControls
          onPlay={startSimulation}
          onStop={stopSimulation}
          onStepForward={simulateOneStep}
          iframeReady={iframeReady && !pickMode}
          replaying={replayState.status === "replaying"}
          replayProgress={
            replayState.status === "replaying" ? replayState.currentStep : undefined
          }
          replayTarget={
            replayState.status === "replaying" ? replayState.targetStep : undefined
          }
        />
      )}

      <div className="h-px shrink-0 bg-border" />
      <ResizablePanelGroup orientation="vertical" className="min-h-0 flex-1">
        <ResizablePanel defaultSize={showConsole ? 70 : 100} minSize={30}>
          <div
            ref={containerRef}
            className="relative flex h-full items-center justify-center overflow-hidden bg-card/50"
            style={
              canvasMode === "preview" && videoConfig && iframeSrc
                ? { cursor: previewCursor }
                : undefined
            }
          >
            {canvasMode === "playback" && videoSrc ? (
              <div
                className="group relative overflow-hidden rounded-lg shadow-lg"
                style={{
                  width: canvasW * scale,
                  height: canvasH * scale,
                }}
              >
                <video
                  ref={videoRef}
                  src={videoSrc}
                  className="h-full w-full bg-black"
                  onTimeUpdate={() =>
                    setVideoCurrentTime(videoRef.current?.currentTime ?? 0)
                  }
                  onLoadedMetadata={() =>
                    setVideoDuration(videoRef.current?.duration ?? 0)
                  }
                  onEnded={() => setVideoPlaying(false)}
                  onPlay={() => setVideoPlaying(true)}
                  onPause={() => setVideoPlaying(false)}
                  onClick={toggleVideoPlay}
                />
                <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 bg-linear-to-t from-black/70 via-black/40 to-transparent px-3 pb-3 pt-10 opacity-0 transition-opacity group-hover:opacity-100">
                  <div
                    className="relative h-1 w-full cursor-pointer rounded-full bg-white/25"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const pct = (e.clientX - rect.left) / rect.width;
                      videoSeekTo(pct * videoDuration);
                    }}
                  >
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-white transition-[width] duration-100"
                      style={{
                        width: `${(videoCurrentTime / (videoDuration || 1)) * 100}%`,
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        videoFrameStep(-1);
                      }}
                      className="text-white hover:bg-white/20 hover:text-white"
                      title="Previous frame"
                    >
                      <SkipBack className="size-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleVideoPlay();
                      }}
                      className="text-white hover:bg-white/20 hover:text-white"
                    >
                      {videoPlaying ? (
                        <Pause className="size-3" />
                      ) : (
                        <Play className="size-3" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        videoFrameStep(1);
                      }}
                      className="text-white hover:bg-white/20 hover:text-white"
                      title="Next frame"
                    >
                      <SkipForward className="size-3" />
                    </Button>
                    <span className="text-[10px] tabular-nums text-white/80">
                      {formatElapsed(Math.floor(videoCurrentTime))} /{" "}
                      {formatElapsed(Math.floor(videoDuration))}
                    </span>
                  </div>
                </div>
              </div>
            ) : videoConfig && iframeSrc ? (
              hasChrome ? (
                <PreviewWithChrome
                  canvasW={canvasW}
                  canvasH={canvasH}
                  vpWidth={vpWidth}
                  vpHeight={vpHeight}
                  scale={scale}
                  titlebarH={titlebarH}
                  titlebarVisible={titlebarVisible}
                  borderRadius={borderRadius}
                  windowCfg={windowCfg}
                  backgroundCfg={backgroundCfg}
                  iframeKey={iframeKey}
                  iframeRef={iframeRef}
                  iframeSrc={iframeSrc}
                  selectedVideo={selectedVideo}
                  pickMode={pickMode}
                  previewCursor={previewCursor}
                />
              ) : (
                <div
                  className={cn(
                    "relative overflow-hidden rounded-lg border bg-background shadow-sm",
                    pickMode && "ring-2 ring-blue-500/50",
                  )}
                  style={{
                    width: vpWidth * scale,
                    height: vpHeight * scale,
                    cursor: previewCursor,
                  }}
                >
                  <iframe
                    key={iframeKey}
                    ref={iframeRef}
                    src={iframeSrc}
                    title={`Preview: ${selectedVideo}`}
                    style={{
                      width: vpWidth,
                      height: vpHeight,
                      transform: `scale(${scale})`,
                      transformOrigin: "top left",
                    }}
                    className="border-0"
                  />
                </div>
              )
            ) : videoConfig ? (
              <div className="space-y-2 text-center">
                <Globe className="mx-auto size-8 text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground/60">
                  Cannot preview this URL
                </p>
                <p className="max-w-[300px] text-[10px] text-muted-foreground/40">
                  Set the URL to an http:// or https:// address to see a live preview.
                  Relative or file:// URLs require running{" "}
                  <code className="rounded bg-muted px-1 py-0.5">
                    webreel preview {selectedVideo}
                  </code>
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Select a video to preview</p>
            )}

            {renderStatus === "running" && canvasMode === "preview" && (
              <div className="absolute right-4 top-4 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 backdrop-blur-sm">
                <span className="size-2 animate-pulse rounded-full bg-red-500" />
                <span className="text-xs font-medium text-white">
                  REC {formatElapsed(recordingElapsed)}
                </span>
              </div>
            )}
          </div>
        </ResizablePanel>
        {showConsole && (
          <>
            <ResizableHandle />
            <ResizablePanel defaultSize={30} minSize={10} maxSize={60}>
              <RenderConsole />
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </div>
  );
}
