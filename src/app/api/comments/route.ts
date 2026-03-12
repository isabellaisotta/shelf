import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { v4 as uuid } from "uuid";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const itemId = req.nextUrl.searchParams.get("itemId");
  if (!itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 });

  const db = getDb();
  const comments = db
    .prepare(`
      SELECT c.id, c.body, c.created_at, u.username, u.display_name
      FROM comments c
      JOIN users u ON c.author_id = u.id
      WHERE c.item_id = ?
      ORDER BY c.created_at ASC
    `)
    .all(itemId);

  return NextResponse.json({ comments });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { itemId, body } = await req.json();
  if (!itemId || !body) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const db = getDb();
  const id = uuid();

  db.prepare("INSERT INTO comments (id, item_id, author_id, body) VALUES (?, ?, ?, ?)").run(
    id,
    itemId,
    user.id,
    body
  );

  return NextResponse.json({
    ok: true,
    comment: { id, body, created_at: new Date().toISOString(), username: user.username, display_name: user.display_name },
  });
}
