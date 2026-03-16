import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

const TMDB_KEY = process.env.TMDB_API_KEY || "";

interface MediaDetail {
  title: string;
  overview: string;
  year: string;
  poster: string;
  backdrop: string;
  genres: string[];
  // Film/TV specific
  rating?: number;
  runtime?: number;
  seasons?: number;
  director?: string;
  creator?: string;
  cast?: { name: string; character: string }[];
  // Book specific
  author?: string;
  subjects?: string[];
  covers?: string[];
}

async function fetchFilmDetail(tmdbId: string): Promise<MediaDetail | null> {
  if (!TMDB_KEY) return null;
  const res = await fetch(
    `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_KEY}&append_to_response=credits`
  );
  if (!res.ok) return null;
  const data = await res.json();

  const director = (data.credits?.crew || []).find(
    (c: { job: string; name: string }) => c.job === "Director"
  );
  const cast = (data.credits?.cast || [])
    .slice(0, 6)
    .map((c: { name: string; character: string }) => ({
      name: c.name,
      character: c.character,
    }));

  return {
    title: data.title || "",
    overview: data.overview || "",
    year: (data.release_date || "").slice(0, 4),
    poster: data.poster_path
      ? `https://image.tmdb.org/t/p/w400${data.poster_path}`
      : "",
    backdrop: data.backdrop_path
      ? `https://image.tmdb.org/t/p/w1280${data.backdrop_path}`
      : "",
    genres: (data.genres || []).map((g: { name: string }) => g.name),
    rating: data.vote_average || null,
    runtime: data.runtime || null,
    director: director?.name || "",
    cast,
  };
}

async function fetchTVDetail(tmdbId: string): Promise<MediaDetail | null> {
  if (!TMDB_KEY) return null;
  const res = await fetch(
    `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${TMDB_KEY}&append_to_response=credits`
  );
  if (!res.ok) return null;
  const data = await res.json();

  const cast = (data.credits?.cast || [])
    .slice(0, 6)
    .map((c: { name: string; character: string }) => ({
      name: c.name,
      character: c.character,
    }));

  const creatorName = (data.created_by || [])
    .map((c: { name: string }) => c.name)
    .join(", ");

  return {
    title: data.name || "",
    overview: data.overview || "",
    year: (data.first_air_date || "").slice(0, 4),
    poster: data.poster_path
      ? `https://image.tmdb.org/t/p/w400${data.poster_path}`
      : "",
    backdrop: data.backdrop_path
      ? `https://image.tmdb.org/t/p/w1280${data.backdrop_path}`
      : "",
    genres: (data.genres || []).map((g: { name: string }) => g.name),
    rating: data.vote_average || null,
    seasons: data.number_of_seasons || null,
    creator: creatorName,
    cast,
  };
}

async function fetchBookDetail(workId: string): Promise<MediaDetail | null> {
  const res = await fetch(`https://openlibrary.org${workId}.json`);
  if (!res.ok) return null;
  const data = await res.json();

  // Fetch author names
  const authorKeys: string[] = (data.authors || []).map(
    (a: { author?: { key: string }; key?: string }) =>
      a.author?.key || a.key || ""
  );
  let authorName = "";
  if (authorKeys.length > 0 && authorKeys[0]) {
    try {
      const authorRes = await fetch(
        `https://openlibrary.org${authorKeys[0]}.json`
      );
      if (authorRes.ok) {
        const authorData = await authorRes.json();
        authorName = authorData.name || "";
      }
    } catch {
      // Author fetch failed, leave empty
    }
  }

  // Extract description
  let overview = "";
  if (typeof data.description === "string") {
    overview = data.description;
  } else if (data.description?.value) {
    overview = data.description.value;
  }

  // Cover
  const coverId = data.covers?.[0];
  const poster = coverId
    ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`
    : "";

  return {
    title: data.title || "",
    overview,
    year: data.first_publish_date
      ? String(data.first_publish_date).slice(0, 4)
      : "",
    poster,
    backdrop: "",
    genres: [],
    author: authorName,
    subjects: (data.subjects || []).slice(0, 6),
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ category: string; externalId: string[] }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { category, externalId } = await params;
  const externalIdStr = externalId.join("/");

  // Fetch media detail from external API
  let detail: MediaDetail | null = null;

  if (category === "film") {
    const tmdbId = externalIdStr.replace("tmdb:", "");
    detail = await fetchFilmDetail(tmdbId);
  } else if (category === "tv") {
    const tmdbId = externalIdStr.replace("tmdb:", "");
    detail = await fetchTVDetail(tmdbId);
  } else if (category === "book") {
    // externalId comes as ["works", "OL123W"] from the catch-all
    const workPath = "/" + externalIdStr;
    detail = await fetchBookDetail(workPath);
  }

  if (!detail) {
    return NextResponse.json(
      { error: "Media not found" },
      { status: 404 }
    );
  }

  // Social context: user's own item
  const { data: myItems } = await supabase
    .from("items")
    .select("id, rank")
    .eq("user_id", user.id)
    .eq("category", category)
    .eq("external_id", externalIdStr);
  const myItem = myItems?.[0] || null;

  // Social context: on user's to-consume list
  const { data: myRecommended } = await supabase
    .from("recommended")
    .select("id")
    .eq("user_id", user.id)
    .eq("category", category)
    .ilike("title", detail.title);
  const onToConsume = (myRecommended || []).length > 0;

  // Social context: friends who have it
  // First get friend IDs
  const { data: friendships } = await supabase
    .from("friendships")
    .select("requester_id, addressee_id")
    .eq("status", "accepted")
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

  const friendIds = (friendships || []).map((f) =>
    f.requester_id === user.id ? f.addressee_id : f.requester_id
  );

  let friendsWithItem: {
    id: string;
    username: string;
    display_name: string;
    rank: number;
    item_id: string;
  }[] = [];

  if (friendIds.length > 0) {
    const { data: friendItems } = await supabase
      .from("items")
      .select("id, user_id, rank")
      .eq("category", category)
      .eq("external_id", externalIdStr)
      .in("user_id", friendIds);

    if (friendItems && friendItems.length > 0) {
      const friendUserIds = friendItems.map((fi) => fi.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, display_name")
        .in("id", friendUserIds);
      const profileMap = new Map(
        (profiles || []).map((p) => [p.id, p])
      );

      friendsWithItem = friendItems.map((fi) => {
        const profile = profileMap.get(fi.user_id);
        return {
          id: fi.user_id,
          username: profile?.username || "unknown",
          display_name: profile?.display_name || "Unknown",
          rank: fi.rank,
          item_id: fi.id,
        };
      });
    }
  }

  // Social context: conversations
  // Find all item UUIDs with this external_id
  const { data: allItemsWithId } = await supabase
    .from("items")
    .select("id, user_id")
    .eq("category", category)
    .eq("external_id", externalIdStr);

  const itemUuids = (allItemsWithId || []).map((i) => i.id);

  interface ConversationPreview {
    friend: { id: string; username: string; display_name: string };
    item_id: string;
    last_message: string;
    last_message_at: string;
  }

  let conversations: ConversationPreview[] = [];

  if (itemUuids.length > 0) {
    // Get messages I authored on these items
    const { data: authoredMsgs } = await supabase
      .from("messages")
      .select("id, body, created_at, author_id, item_id")
      .in("item_id", itemUuids)
      .eq("author_id", user.id)
      .order("created_at", { ascending: false });

    // Get messages where I'm a recipient on these items
    const { data: myRecipientEntries } = await supabase
      .from("message_recipients")
      .select("message_id")
      .eq("recipient_id", user.id);
    const recipientMsgIds = (myRecipientEntries || []).map(
      (r) => r.message_id
    );

    let receivedMsgs: typeof authoredMsgs = [];
    if (recipientMsgIds.length > 0) {
      const { data } = await supabase
        .from("messages")
        .select("id, body, created_at, author_id, item_id")
        .in("item_id", itemUuids)
        .in("id", recipientMsgIds)
        .order("created_at", { ascending: false });
      receivedMsgs = data || [];
    }

    // Merge and deduplicate
    const allMsgs = [...(authoredMsgs || []), ...(receivedMsgs || [])];
    const uniqueMap = new Map(allMsgs.map((m) => [m.id, m]));
    const msgs = Array.from(uniqueMap.values());

    // Group by friend (the other person in the conversation)
    const friendMsgMap = new Map<
      string,
      { item_id: string; body: string; created_at: string }
    >();

    for (const msg of msgs) {
      const otherId =
        msg.author_id === user.id ? null : msg.author_id;

      if (otherId) {
        const existing = friendMsgMap.get(otherId);
        if (
          !existing ||
          new Date(msg.created_at) > new Date(existing.created_at)
        ) {
          friendMsgMap.set(otherId, {
            item_id: msg.item_id,
            body: msg.body,
            created_at: msg.created_at,
          });
        }
      } else {
        // I authored this; find recipients
        const { data: recipients } = await supabase
          .from("message_recipients")
          .select("recipient_id")
          .eq("message_id", msg.id);

        for (const r of recipients || []) {
          const existing = friendMsgMap.get(r.recipient_id);
          if (
            !existing ||
            new Date(msg.created_at) > new Date(existing.created_at)
          ) {
            friendMsgMap.set(r.recipient_id, {
              item_id: msg.item_id,
              body: msg.body,
              created_at: msg.created_at,
            });
          }
        }
      }
    }

    // Fetch profiles for conversation partners
    const convoFriendIds = [...friendMsgMap.keys()];
    if (convoFriendIds.length > 0) {
      const { data: convoProfiles } = await supabase
        .from("profiles")
        .select("id, username, display_name")
        .in("id", convoFriendIds);
      const profileMap = new Map(
        (convoProfiles || []).map((p) => [p.id, p])
      );

      conversations = convoFriendIds
        .map((fid) => {
          const profile = profileMap.get(fid);
          const msgData = friendMsgMap.get(fid)!;
          return {
            friend: {
              id: fid,
              username: profile?.username || "unknown",
              display_name: profile?.display_name || "Unknown",
            },
            item_id: msgData.item_id,
            last_message: msgData.body,
            last_message_at: msgData.created_at,
          };
        })
        .sort(
          (a, b) =>
            new Date(b.last_message_at).getTime() -
            new Date(a.last_message_at).getTime()
        );
    }
  }

  return NextResponse.json({
    detail,
    social: {
      myItem,
      onToConsume,
      friendsWithItem,
      conversations,
    },
  });
}
