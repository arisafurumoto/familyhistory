import { env } from "cloudflare:workers";
import { isFamilyAuthenticated } from "../../../auth";

export const dynamic = "force-dynamic";

type MediaObject = {
  body: ReadableStream;
  httpMetadata?: { contentType?: string };
  writeHttpMetadata?: (headers: Headers) => void;
};

type MediaBucket = {
  get(key: string): Promise<MediaObject | null>;
};

type PhotoRouteContext = {
  params: Promise<{ key: string[] }> | { key: string[] };
};

export async function GET(_request: Request, context: PhotoRouteContext) {
  if (!(await isFamilyAuthenticated())) {
    return new Response("ログインが必要です。", { status: 401 });
  }

  const params = await context.params;
  const key = params.key.join("/");
  if (!key || key.includes("..")) return new Response("Not found", { status: 404 });

  const runtimeEnv = env as unknown as { MEDIA?: MediaBucket };
  const object = await runtimeEnv.MEDIA?.get(key);
  if (!object) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata?.(headers);
  headers.set(
    "content-type",
    headers.get("content-type") ??
      object.httpMetadata?.contentType ??
      "application/octet-stream",
  );
  headers.set("cache-control", "private, max-age=3600");

  return new Response(object.body, { headers });
}
