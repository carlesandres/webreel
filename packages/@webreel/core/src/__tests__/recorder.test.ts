import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const spawnState = vi.hoisted(() => ({
  stdinWrites: [] as Buffer[],
  spawnArgs: [] as string[],
  ensureFfmpegMock: vi.fn(async () => "ffmpeg"),
  finalizeMp4Mock: vi.fn(),
  finalizeWebmMock: vi.fn(),
  finalizeGifMock: vi.fn(),
  writeFileSyncMock: vi.fn(),
}));

vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return {
    ...actual,
    writeFileSync: spawnState.writeFileSyncMock,
  };
});

vi.mock("../ffmpeg.js", () => ({
  ensureFfmpeg: spawnState.ensureFfmpegMock,
}));

vi.mock("../media.js", () => ({
  finalizeMp4: spawnState.finalizeMp4Mock,
  finalizeWebm: spawnState.finalizeWebmMock,
  finalizeGif: spawnState.finalizeGifMock,
}));

vi.mock("node:child_process", () => ({
  spawn: vi.fn((_command: string, args: string[]) => {
    spawnState.spawnArgs = args;

    const proc = new EventEmitter() as EventEmitter & {
      stdin: EventEmitter & {
        writable: boolean;
        write: (chunk: Buffer) => boolean;
        end: () => void;
      };
      stdout: EventEmitter;
      stderr: EventEmitter;
      exitCode: number | null;
      kill: () => void;
    };

    const stdin = new EventEmitter() as EventEmitter & {
      writable: boolean;
      write: (chunk: Buffer) => boolean;
      end: () => void;
    };
    stdin.writable = true;
    stdin.write = (chunk: Buffer) => {
      spawnState.stdinWrites.push(chunk);
      return true;
    };
    stdin.end = () => {
      proc.exitCode = 0;
      proc.emit("close", 0);
    };

    proc.stdin = stdin;
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.exitCode = null;
    proc.kill = () => {
      proc.exitCode = 0;
      proc.emit("close", 0);
    };

    return proc;
  }),
}));

import { Recorder } from "../recorder.js";
import type { CDPClient } from "../types.js";

describe("Recorder", () => {
  beforeEach(() => {
    spawnState.stdinWrites = [];
    spawnState.spawnArgs = [];
    spawnState.ensureFfmpegMock.mockClear();
    spawnState.finalizeMp4Mock.mockClear();
    spawnState.finalizeWebmMock.mockClear();
    spawnState.finalizeGifMock.mockClear();
    spawnState.writeFileSyncMock.mockClear();
  });

  it("captures recording frames with HeadlessExperimental.beginFrame PNG screenshots", async () => {
    const screenshotData = Buffer.from("png-frame").toString("base64");
    const beginFrame = vi
      .fn<CDPClient["HeadlessExperimental"]["beginFrame"]>()
      .mockResolvedValueOnce({ hasDamage: true, screenshotData })
      .mockImplementationOnce(() => new Promise(() => undefined));
    const captureScreenshot = vi.fn();

    const client = {
      Runtime: { evaluate: vi.fn().mockResolvedValue({ result: {} }) },
      Page: { captureScreenshot },
      HeadlessExperimental: { beginFrame },
    } as unknown as CDPClient;

    const recorder = new Recorder(1080, 1080, { fps: 30, framesDir: "/tmp/frames" });
    recorder.setTimeline({ tick: vi.fn(), toJSON: vi.fn(() => null) } as never);

    await recorder.start(client, "/tmp/out.mp4");
    await vi.waitFor(() => {
      expect(beginFrame).toHaveBeenCalledWith({
        screenshot: { format: "png", optimizeForSpeed: true },
      });
    });
    await recorder.stop();

    expect(captureScreenshot).not.toHaveBeenCalled();
    expect(spawnState.spawnArgs).toContain("png");
    expect(spawnState.writeFileSyncMock).toHaveBeenCalledWith(
      expect.stringMatching(/frame-00001\.png$/),
      expect.any(Buffer),
    );
  });

  it("reuses the previous frame when beginFrame returns no screenshotData", async () => {
    const firstFrame = Buffer.from("png-frame-1");
    const beginFrame = vi
      .fn<CDPClient["HeadlessExperimental"]["beginFrame"]>()
      .mockResolvedValueOnce({
        hasDamage: true,
        screenshotData: firstFrame.toString("base64"),
      })
      .mockResolvedValueOnce({ hasDamage: false })
      .mockImplementationOnce(() => new Promise(() => undefined));

    const client = {
      Runtime: { evaluate: vi.fn().mockResolvedValue({ result: {} }) },
      Page: { captureScreenshot: vi.fn() },
      HeadlessExperimental: { beginFrame },
    } as unknown as CDPClient;

    const recorder = new Recorder(1080, 1080, { fps: 30, framesDir: "/tmp/frames" });
    recorder.setTimeline({ tick: vi.fn(), toJSON: vi.fn(() => null) } as never);

    await recorder.start(client, "/tmp/out.mp4");
    await vi.waitFor(() => {
      expect(spawnState.stdinWrites).toHaveLength(2);
    });
    await recorder.stop();

    expect(spawnState.stdinWrites).toHaveLength(2);
    expect(spawnState.stdinWrites[0]).toEqual(firstFrame);
    expect(spawnState.stdinWrites[1]).toEqual(firstFrame);
    expect(spawnState.writeFileSyncMock).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(/frame-00001\.png$/),
      firstFrame,
    );
    expect(spawnState.writeFileSyncMock).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(/frame-00002\.png$/),
      firstFrame,
    );
  });
});
