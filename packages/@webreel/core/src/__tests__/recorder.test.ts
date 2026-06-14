import { describe, it, expect } from "vitest";
import {
  buildFfmpegRecorderArgs,
  getCaptureScreenshotParams,
  getFfmpegInputCodec,
  getFrameExtension,
} from "../recorder.js";

function expectPipeInputCodec(args: string[], codec: string): void {
  const inputIndex = args.indexOf("pipe:0");
  expect(inputIndex).toBeGreaterThan(0);
  expect(args.slice(inputIndex - 3, inputIndex + 1)).toEqual([
    "-c:v",
    codec,
    "-i",
    "pipe:0",
  ]);
}

describe("getCaptureScreenshotParams", () => {
  it("returns jpeg capture settings by default", () => {
    expect(getCaptureScreenshotParams("jpeg")).toEqual({
      format: "jpeg",
      quality: 60,
      optimizeForSpeed: true,
    });
  });

  it("returns png capture settings without jpeg quality", () => {
    expect(getCaptureScreenshotParams("png")).toEqual({
      format: "png",
      optimizeForSpeed: true,
    });
  });
});

describe("capture format helpers", () => {
  it("uses mjpeg ffmpeg input for jpeg frames", () => {
    expect(getFfmpegInputCodec("jpeg")).toBe("mjpeg");
    expect(getFrameExtension("jpeg")).toBe(".jpg");
  });

  it("uses png ffmpeg input for png frames", () => {
    expect(getFfmpegInputCodec("png")).toBe("png");
    expect(getFrameExtension("png")).toBe(".png");
  });
});

describe("buildFfmpegRecorderArgs", () => {
  it("uses image2pipe with the jpeg decoder by default", () => {
    const args = buildFfmpegRecorderArgs({
      fps: 60,
      crf: 18,
      captureFormat: "jpeg",
      outputPath: "out.mp4",
    });

    expect(args.slice(1, 3)).toEqual(["-f", "image2pipe"]);
    expectPipeInputCodec(args, "mjpeg");
  });

  it("uses image2pipe with the png decoder for png source frames", () => {
    const args = buildFfmpegRecorderArgs({
      fps: 60,
      crf: 18,
      captureFormat: "png",
      outputPath: "out.mp4",
    });

    expect(args.slice(1, 3)).toEqual(["-f", "image2pipe"]);
    expectPipeInputCodec(args, "png");
  });
});
