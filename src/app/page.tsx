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
      router.push("/profile");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="text-center max-w-lg px-6">
        <h1 className="text-5xl font-bold text-gray-900 mb-2">
          Taste<span className="text-indigo-600">Match</span>
        </h1>
        <p className="text-xl text-gray-500 mb-8">
          Share your favorite books, films, and TV shows. See what you have in common with friends.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/signup"
            className="px-8 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
          >
            Get started
          </Link>
          <Link
            href="/login"
            className="px-8 py-3 bg-white text-gray-700 rounded-lg font-medium border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            Log in
          </Link>
        </div>

        <div className="mt-16 grid grid-cols-3 gap-6 text-center">
          <div>
            <div className="text-3xl mb-2">📚</div>
            <p className="text-sm text-gray-500">Rank your favorite books</p>
          </div>
          <div>
            <div className="text-3xl mb-2">🎬</div>
            <p className="text-sm text-gray-500">Share your top films</p>
          </div>
          <div>
            <div className="text-3xl mb-2">📺</div>
            <p className="text-sm text-gray-500">Compare TV tastes</p>
          </div>
        </div>
      </div>
    </div>
  );
}
