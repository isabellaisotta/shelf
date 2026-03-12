import { cookies } from "next/headers";
import { getDb } from "./db";

const SESSION_COOKIE = "tastematch_session";

export interface User {
  id: string;
  username: string;
  email: string;
  display_name: string | null;
  bio: string;
}

// Simple token-based sessions stored in a Map (in-memory, fine for prototype)
const sessions = new Map<string, string>(); // token -> userId

export function createSession(userId: string): string {
  const token = crypto.randomUUID();
  sessions.set(token, userId);
  return token;
}

export function destroySession(token: string) {
  sessions.delete(token);
}

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const userId = sessions.get(token);
  if (!userId) return null;

  const db = getDb();
  const user = db
    .prepare("SELECT id, username, email, display_name, bio FROM users WHERE id = ?")
    .get(userId) as User | undefined;

  return user || null;
}

export { SESSION_COOKIE };
