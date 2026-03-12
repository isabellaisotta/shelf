import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { createSession, SESSION_COOKIE } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const { login, password } = await req.json();

  if (!login || !password) {
    return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
  }

  const db = getDb();
  const user = db
    .prepare("SELECT id, username, email, password_hash, display_name FROM users WHERE username = ? OR email = ?")
    .get(login.toLowerCase(), login.toLowerCase()) as { id: string; username: string; password_hash: string; display_name: string } | undefined;

  if (!user) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = createSession(user.id);

  const res = NextResponse.json({ ok: true, user: { id: user.id, username: user.username, displayName: user.display_name } });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return res;
}
