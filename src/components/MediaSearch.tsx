"use client";

import { useState, useEffect, useRef } from "react";

interface MediaResult {
  title: string;
  creator: string;
  year: string;
  coverUrl: string;
  externalId: string;
}

interface Props {
  category: "book" | "film" | "tv";
  onSelect: (result: MediaResult) => void;
}

export default function MediaSearch({ category, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MediaResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search-media?q=${encodeURIComponent(query)}&category=${category}`);
        const data = await res.json();
        setResults(data.results || []);
        setShowResults(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, category]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const categoryLabel = category === "book" ? "book" : category === "film" ? "film" : "TV show";

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setShowResults(true)}
        placeholder={`Search for a ${categoryLabel}...`}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
      />
      {loading && (
        <div className="absolute right-3 top-2.5 text-gray-400 text-sm">Searching...</div>
      )}

      {showResults && results.length > 0 && (
        <div className="absolute z-10 mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-200 max-h-80 overflow-y-auto">
          {results.map((r, i) => (
            <button
              key={i}
              onClick={() => {
                onSelect(r);
                setQuery("");
                setResults([]);
                setShowResults(false);
              }}
              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-indigo-50 text-left border-b border-gray-100 last:border-0"
            >
              {r.coverUrl ? (
                <img src={r.coverUrl} alt="" className="w-10 h-14 object-cover rounded" />
              ) : (
                <div className="w-10 h-14 bg-gray-200 rounded flex items-center justify-center text-xs text-gray-400">
                  No img
                </div>
              )}
              <div>
                <div className="font-medium text-gray-900">{r.title}</div>
                <div className="text-sm text-gray-500">
                  {r.creator && <span>{r.creator}</span>}
                  {r.creator && r.year && <span> · </span>}
                  {r.year && <span>{r.year}</span>}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
