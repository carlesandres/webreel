import { beforeEach, describe, expect, it, vi } from "vitest";

const pauseMock = vi.fn(async () => undefined);
const beginFrameMock = vi.fn(async () => ({ hasDamage: true }));
const enableMock = vi.fn(async () => undefined);
const recorderStartMock = vi.fn(async () => undefined);
const recorderSetTimelineMock = vi.fn();
const recorderStopMock = vi.fn(async () => undefined);
const recorderGetTempVideoPathMock = vi.fn(() => "/tmp/_rec.mp4");
const navigateMock = vi.fn(async () => undefined);
const launchChromeMock = vi.fn(async () => ({
  port: 9222,
  kill: vi.fn(),
  process: {} as never,
}));
const connectCDPMock = vi.fn(async () => ({
  close: vi.fn(async () => undefined),
  Page: { enable: vi.fn(async () => undefined) },
  Runtime: { enable: vi.fn(async () => undefined) },
  Emulation: { setDeviceMetricsOverride: vi.fn(async () => undefined) },
  HeadlessExperimental: {
    enable: enableMock,
    beginFrame: beginFrameMock,
  },
}));

vi.mock("@webreel/core", () => ({
  DEFAULT_VIEWPORT_SIZE: 1080,
  RecordingContext: class {
    resetCursorPosition() {}
    setClickDwell() {}
    getCursorPosition() {
      return { x: 0, y: 0 };
    }
    setMode() {}
    setTimeline() {}
  },
  InteractionTimeline: class {
    constructor() {}
    toJSON() {
      return { width: 1080, height: 1080, fps: 60, zoom: 1, frames: [] };
    }
  },
  Recorder: class {
    setTimeline = recorderSetTimelineMock;
    start = recorderStartMock;
    stop = recorderStopMock;
    getTempVideoPath = recorderGetTempVideoPathMock;
  },
  compose: vi.fn(),
  connectCDP: connectCDPMock,
  launchChrome: launchChromeMock,
  navigate: navigateMock,
  waitForSelector: vi.fn(async () => undefined),
  waitForText: vi.fn(async () => undefined),
  injectOverlays: vi.fn(async () => undefined),
  pause: pauseMock,
  findElementByText: vi.fn(),
  findElementBySelector: vi.fn(),
  clickAt: vi.fn(async () => undefined),
  pressKey: vi.fn(async () => undefined),
  typeText: vi.fn(async () => undefined),
  dragFromTo: vi.fn(async () => undefined),
  moveCursorTo: vi.fn(async () => undefined),
  captureScreenshot: vi.fn(async () => undefined),
  ensureFfmpeg: vi.fn(async () => "ffmpeg"),
  extractThumbnail: vi.fn(),
  moveFileSync: vi.fn(),
}));

describe("runVideo recording setup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    recorderGetTempVideoPathMock.mockReturnValue("/tmp/_rec.mp4");
  });

  it("enables HeadlessExperimental before starting the recorder", async () => {
    vi.useFakeTimers();
    try {
      const releaseNavigate = { current: null as null | (() => void) };
      navigateMock.mockImplementationOnce(
        () =>
          new Promise<undefined>((resolve) => {
            releaseNavigate.current = () => resolve(undefined);
          }),
      );

      const { runVideo } = await import("../runner.js");

      const runPromise = runVideo(
        {
          name: "demo",
          url: "https://example.com",
          steps: [],
          output: "/tmp/demo.mp4",
        },
        { record: true, configDir: "/tmp" },
      );

      await vi.advanceTimersByTimeAsync(16);
      if (releaseNavigate.current) releaseNavigate.current();
      await runPromise;

      expect(enableMock).toHaveBeenCalledTimes(1);
      expect(beginFrameMock).toHaveBeenCalled();
      expect(recorderSetTimelineMock).toHaveBeenCalledTimes(1);
      expect(recorderStartMock).toHaveBeenCalledTimes(1);
      expect(enableMock.mock.invocationCallOrder[0]).toBeLessThan(
        recorderStartMock.mock.invocationCallOrder[0],
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops the pre-record frame pump when setup fails before recording starts", async () => {
    vi.useFakeTimers();
    try {
      const releaseNavigate = { current: null as null | (() => void) };
      navigateMock.mockImplementationOnce(
        () =>
          new Promise<undefined>((resolve) => {
            releaseNavigate.current = () => resolve(undefined);
          }),
      );

      const { runVideo } = await import("../runner.js");

      const runPromise = runVideo(
        {
          name: "demo",
          url: "https://example.com",
          steps: [],
          output: "/tmp/demo.mp4",
          theme: { cursor: { image: "missing-cursor.svg" } },
        },
        { record: true, configDir: "/tmp" },
      );

      await vi.advanceTimersByTimeAsync(16);
      expect(beginFrameMock).toHaveBeenCalledTimes(1);

      if (releaseNavigate.current) releaseNavigate.current();

      await expect(runPromise).rejects.toThrow(/Failed to read cursor SVG/);

      await vi.advanceTimersByTimeAsync(32);
      expect(beginFrameMock).toHaveBeenCalledTimes(1);
      expect(recorderStartMock).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
