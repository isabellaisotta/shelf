import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { v4 as uuid } from "uuid";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const userId = req.nextUrl.searchParams.get("userId") || user.id;
  const category = req.nextUrl.searchParams.get("category");

  const db = getDb();

  let items;
  if (category) {
    items = db
      .prepare("SELECT * FROM items WHERE user_id = ? AND category = ? ORDER BY rank ASC")
      .all(userId, category);
  } else {
    items = db
      .prepare("SELECT * FROM items WHERE user_id = ? ORDER BY category, rank ASC")
      .all(userId);
  }

  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { category, title, creator, year, coverUrl, externalId } = await req.json();

  if (!category || !title) {
    return NextResponse.json({ error: "Category and title required" }, { status: 400 });
  }

  if (!["book", "film", "tv"].includes(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  const db = getDb();

  // Auto-assign rank (append to end)
  const maxRank = db
    .prepare("SELECT MAX(rank) as max_rank FROM items WHERE user_id = ? AND category = ?")
    .get(user.id, category) as { max_rank: number | null };

  const rank = (maxRank?.max_rank || 0) + 1;
  const id = uuid();

  db.prepare(
    "INSERT INTO items (id, user_id, category, title, creator, year, cover_url, rank, external_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(id, user.id, category, title, creator || "", year || "", coverUrl || "", rank, externalId || "");

  return NextResponse.json({ ok: true, item: { id, category, title, creator, year, cover_url: coverUrl, rank, external_id: externalId } });
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { items } = await req.json(); // [{ id, rank }]

  if (!Array.isArray(items)) {
    return NextResponse.json({ error: "Items array required" }, { status: 400 });
  }

  const db = getDb();
  const updateStmt = db.prepare("UPDATE items SET rank = ? WHERE id = ? AND user_id = ?");

  const updateAll = db.transaction(() => {
    for (const item of items) {
      updateStmt.run(item.rank, item.id, user.id);
    }
  });

  updateAll();

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "Item id required" }, { status: 400 });

  const db = getDb();
  db.prepare("DELETE FROM items WHERE id = ? AND user_id = ?").run(id, user.id);

  return NextResponse.json({ ok: true });
}
