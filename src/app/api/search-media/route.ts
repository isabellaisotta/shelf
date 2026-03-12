import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

const TMDB_KEY = process.env.TMDB_API_KEY || "";

interface MediaResult {
  title: string;
  creator: string;
  year: string;
  coverUrl: string;
  externalId: string;
}

async function searchBooks(query: string): Promise<MediaResult[]> {
  const res = await fetch(
    `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=8`
  );
  const data = await res.json();

  return (data.docs || []).slice(0, 8).map((doc: Record<string, unknown>) => ({
    title: doc.title as string,
    creator: ((doc.author_name as string[]) || [])[0] || "Unknown",
    year: String(doc.first_publish_year || ""),
    coverUrl: doc.cover_i
      ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
      : "",
    externalId: (doc.key as string) || "",
  }));
}

async function searchFilms(query: string): Promise<MediaResult[]> {
  if (!TMDB_KEY) return [];
  const res = await fetch(
    `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}&page=1`
  );
  const data = await res.json();

  return (data.results || []).slice(0, 8).map((m: Record<string, unknown>) => ({
    title: m.title as string,
    creator: "",
    year: ((m.release_date as string) || "").slice(0, 4),
    coverUrl: m.poster_path
      ? `https://image.tmdb.org/t/p/w200${m.poster_path}`
      : "",
    externalId: `tmdb:${m.id}`,
  }));
}

async function searchTV(query: string): Promise<MediaResult[]> {
  if (!TMDB_KEY) return [];
  const res = await fetch(
    `https://api.themoviedb.org/3/search/tv?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}&page=1`
  );
  const data = await res.json();

  return (data.results || []).slice(0, 8).map((m: Record<string, unknown>) => ({
    title: m.name as string,
    creator: "",
    year: ((m.first_air_date as string) || "").slice(0, 4),
    coverUrl: m.poster_path
      ? `https://image.tmdb.org/t/p/w200${m.poster_path}`
      : "",
    externalId: `tmdb:${m.id}`,
  }));
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const query = req.nextUrl.searchParams.get("q") || "";
  const category = req.nextUrl.searchParams.get("category") || "book";

  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  let results: MediaResult[] = [];

  if (category === "book") {
    results = await searchBooks(query);
  } else if (category === "film") {
    results = await searchFilms(query);
  } else if (category === "tv") {
    results = await searchTV(query);
  }

  return NextResponse.json({ results });
}
