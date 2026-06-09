import { describe, it, expect } from "vitest";
import {
  getCaptureScreenshotParams,
  getFfmpegInputCodec,
  getFrameExtension,
} from "../recorder.js";

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
