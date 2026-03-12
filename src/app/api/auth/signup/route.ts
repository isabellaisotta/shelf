import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const { username, email, password, displayName } = await req.json();

  if (!username || !email || !password) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = await createClient();

  // Check if username is taken
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username.toLowerCase())
    .single();

  if (existing) {
    return NextResponse.json({ error: "Username already taken" }, { status: 409 });
  }

  const { data, error } = await supabase.auth.signUp({
    email: email.toLowerCase(),
    password,
    options: {
      data: {
        username: username.toLowerCase(),
        display_name: displayName || username,
      },
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    user: { id: data.user?.id, username: username.toLowerCase() },
  });
}
