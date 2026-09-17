import { readUpload } from "@/lib/uploads";

export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const file = await readUpload(path);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.body), {
    headers: {
      "Content-Type": file.type,
      "Content-Length": String(file.size),
      "Cache-Control": "private, max-age=86400",
    },
  });
}
