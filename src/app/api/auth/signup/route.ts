import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { createSession, SESSION_COOKIE } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";

export async function POST(req: NextRequest) {
  const { username, email, password, displayName } = await req.json();

  if (!username || !email || !password) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (username.length < 3 || username.length > 30) {
    return NextResponse.json({ error: "Username must be 3-30 characters" }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  const db = getDb();

  const existing = db.prepare("SELECT id FROM users WHERE username = ? OR email = ?").get(username, email);
  if (existing) {
    return NextResponse.json({ error: "Username or email already taken" }, { status: 409 });
  }

  const id = uuid();
  const passwordHash = await bcrypt.hash(password, 10);

  db.prepare(
    "INSERT INTO users (id, username, email, password_hash, display_name) VALUES (?, ?, ?, ?, ?)"
  ).run(id, username.toLowerCase(), email.toLowerCase(), passwordHash, displayName || username);

  const token = createSession(id);

  const res = NextResponse.json({ ok: true, user: { id, username: username.toLowerCase(), displayName: displayName || username } });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return res;
}
