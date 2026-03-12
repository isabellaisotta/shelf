import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const { login, password } = await req.json();

  if (!login || !password) {
    return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
  }

  const supabase = await createClient();

  // If login looks like a username (no @), look up the email
  let email = login.toLowerCase();
  if (!email.includes("@")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", email)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Get email from auth.users via admin — but since we're using anon key,
    // we need user to log in with email. Let's try getting it from the profile.
    // Actually, let's just require email for login or store email in profiles.
    // For now, tell user to use email.
    return NextResponse.json({ error: "Please log in with your email address" }, { status: 400 });
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  // Get profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name")
    .eq("id", data.user.id)
    .single();

  return NextResponse.json({
    ok: true,
    user: {
      id: data.user.id,
      username: profile?.username,
      display_name: profile?.display_name,
    },
  });
}
