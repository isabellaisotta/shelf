"use client";

import { useAuth } from "@/components/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push("/trove");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center max-w-lg px-6">
        <img src="/logo.svg" alt="Trove" className="h-14 mx-auto mb-4" />
        <p className="text-lg text-muted mb-10">
          Your taste, ranked. Your friends, compared.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/signup"
            className="px-8 py-3 bg-coral text-white rounded-lg font-medium hover:bg-coral-hover transition-colors"
          >
            Get started
          </Link>
          <Link
            href="/login"
            className="px-8 py-3 bg-surface text-foreground rounded-lg font-medium border border-border hover:bg-surface-hover transition-colors"
          >
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
}
