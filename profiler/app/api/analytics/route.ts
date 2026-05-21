import { NextRequest, NextResponse } from "next/server";
import { getSubmissions } from "@/lib/analytics";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!key || key !== process.env.ANALYTICS_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const entries = getSubmissions();
  return NextResponse.json(entries);
}
