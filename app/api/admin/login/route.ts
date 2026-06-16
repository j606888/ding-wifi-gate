import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, signToken } from "@/lib/auth";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 天

export async function POST(req: NextRequest) {
  const { password } = await req.json().catch(() => ({ password: "" }));

  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "密碼錯誤" }, { status: 401 });
  }

  const token = signToken({ role: "admin" }, SESSION_TTL_MS, Date.now());
  const res = NextResponse.json({ status: "ok" });
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ status: "ok" });
  res.cookies.set(ADMIN_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
