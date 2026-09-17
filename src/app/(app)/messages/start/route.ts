import { NextResponse, type NextRequest } from "next/server";

export function GET(req: NextRequest) {
  const to = req.nextUrl.searchParams.get("to");
  return NextResponse.redirect(new URL(to ? `/messages/${to}` : "/messages", req.url));
}
