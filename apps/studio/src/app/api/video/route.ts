import { NextRequest } from "next/server";
import { readFile, stat } from "node:fs/promises";
import { extname } from "node:path";

const MIME_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".gif": "image/gif",
};

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("path");
  if (!path) {
    return Response.json({ error: "Missing path" }, { status: 400 });
  }

  try {
    const stats = await stat(path);
    if (!stats.isFile()) {
      return Response.json({ error: "Not a file" }, { status: 404 });
    }

    const data = await readFile(path);
    const ext = extname(path).toLowerCase();
    const contentType = MIME_TYPES[ext] ?? "application/octet-stream";

    return new Response(data, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(data.length),
        "Content-Disposition": `inline; filename="${path.split("/").pop()}"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch {
    return Response.json({ error: "File not found" }, { status: 404 });
  }
}
