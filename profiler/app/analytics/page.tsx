"use client";

import { useState } from "react";

interface Entry {
  email: string;
  score: number;
  timestamp: string;
  dimensions: {
    headline: number;
    about: number;
    positioning: number;
    conversion: number;
  };
}

export default function AnalyticsPage() {
  const [password, setPassword] = useState("");
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/analytics?key=${encodeURIComponent(password)}`);
    setLoading(false);
    if (!res.ok) { setError("Wrong password."); return; }
    const data = await res.json();
    setEntries([...data].reverse());
  };

  if (!entries) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-6">
        <div className="w-full max-w-xs space-y-4">
          <p className="text-xs font-semibold tracking-widest uppercase text-gray-500">Analytics</p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchData()}
            placeholder="Password"
            className="w-full border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:border-black font-sans"
            autoFocus
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            onClick={fetchData}
            disabled={loading}
            className="w-full bg-black text-white py-3 text-sm font-semibold uppercase tracking-wide hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            {loading ? "Loading..." : "Enter"}
          </button>
        </div>
      </div>
    );
  }

  const total = entries.length;
  const avgScore = total > 0 ? Math.round(entries.reduce((s, e) => s + e.score, 0) / total) : 0;
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = entries.filter((e) => e.timestamp.startsWith(today)).length;

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 px-6 md:px-12 py-5 flex items-center justify-between">
        <span className="text-sm font-semibold tracking-tight uppercase">Analytics</span>
        <button
          onClick={() => setEntries(null)}
          className="text-xs text-gray-500 hover:text-black"
        >
          Lock
        </button>
      </header>

      <main className="px-6 md:px-12 py-12 max-w-5xl mx-auto">
        <div className="grid grid-cols-3 gap-6 mb-12">
          {[
            { label: "Total audits", value: total },
            { label: "Today", value: todayCount },
            { label: "Avg score", value: avgScore + "/100" },
          ].map(({ label, value }) => (
            <div key={label} className="border border-gray-200 p-6">
              <p className="text-xs font-semibold tracking-widest uppercase text-gray-500 mb-2">{label}</p>
              <p className="text-4xl font-black">{value}</p>
            </div>
          ))}
        </div>

        {total === 0 ? (
          <p className="text-gray-500 text-sm">No submissions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200">
                  {["Date", "Email", "Score", "Headline", "About", "Positioning", "Conversion"].map((h) => (
                    <th key={h} className="text-left py-3 pr-6 text-xs font-semibold tracking-widest uppercase text-gray-500 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 pr-6 text-gray-500 whitespace-nowrap">
                      {new Date(e.timestamp).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-3 pr-6">{e.email}</td>
                    <td className="py-3 pr-6 font-bold">{e.score}</td>
                    <td className="py-3 pr-6">{e.dimensions.headline}/25</td>
                    <td className="py-3 pr-6">{e.dimensions.about}/25</td>
                    <td className="py-3 pr-6">{e.dimensions.positioning}/25</td>
                    <td className="py-3 pr-6">{e.dimensions.conversion}/25</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
