"use client";

import { useState, useRef, useCallback } from "react";

type Status = "idle" | "loading" | "success" | "error";

interface Result {
  score: number;
  summary: string;
}

const LOADING_STEPS = [
  "Reading your profile…",
  "Analysing positioning…",
  "Rewriting your headline…",
  "Drafting your About section…",
  "Sending to your inbox…",
];

export default function Home() {
  const [mode, setMode] = useState<"upload" | "paste">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<Result | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [loadingStep, setLoadingStep] = useState(0);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startLoadingCycle = () => {
    setLoadingStep(0);
    let i = 0;
    stepTimerRef.current = setInterval(() => {
      i += 1;
      if (i < LOADING_STEPS.length) setLoadingStep(i);
      else if (stepTimerRef.current) clearInterval(stepTimerRef.current);
    }, 2500);
  };

  const stopLoadingCycle = () => {
    if (stepTimerRef.current) clearInterval(stepTimerRef.current);
  };

  const handleFile = (f: File) => {
    if (f.type !== "application/pdf") {
      setErrorMsg("Please upload a PDF file.");
      return;
    }
    if (f.size > 8 * 1024 * 1024) {
      setErrorMsg("File must be under 8 MB.");
      return;
    }
    setErrorMsg("");
    setFile(f);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const onDragLeave = () => setDragging(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!email) { setErrorMsg("Email is required."); return; }
    if (mode === "upload" && !file) { setErrorMsg("Please upload your LinkedIn PDF."); return; }
    if (mode === "paste" && !text.trim()) { setErrorMsg("Please paste your About section."); return; }

    setStatus("loading");
    startLoadingCycle();

    try {
      const body = new FormData();
      body.append("email", email);
      if (mode === "upload" && file) body.append("pdf", file);
      else body.append("text", text);

      const res = await fetch("/api/analyze", { method: "POST", body });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Something went wrong.");

      stopLoadingCycle();
      setResult({ score: data.score, summary: data.summary });
      setStatus("success");
    } catch (err) {
      stopLoadingCycle();
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <header className="border-b border-gray-200 px-6 md:px-12 py-5 flex items-center justify-between">
        <span className="text-sm font-semibold tracking-tight uppercase">
          LinkedIn Audit
        </span>
        <span className="text-sm text-gray-500">Free · No signup required</span>
      </header>

      {/* Main */}
      <main className="flex-1 px-6 md:px-12 py-16 md:py-24 max-w-6xl mx-auto w-full">
        <div className="grid md:grid-cols-2 gap-16 md:gap-24 items-start">

          {/* Left: copy */}
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase text-gray-500 mb-6">
              Free Profile Audit
            </p>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black leading-[1.05] tracking-tight mb-8">
              Your LinkedIn profile is losing you clients.
            </h1>
            <p className="text-lg text-gray-600 leading-relaxed mb-12">
              Upload your profile PDF. Get an instant score. A ghostwriter-rewritten version lands in your inbox — completely free.
            </p>

            <div className="space-y-8">
              {[
                { n: "01", label: "Upload your LinkedIn profile PDF" },
                { n: "02", label: "Get your score instantly on screen" },
                { n: "03", label: "Full breakdown + rewrite hits your inbox" },
              ].map(({ n, label }) => (
                <div key={n} className="flex items-start gap-5">
                  <span className="text-xs font-semibold text-gray-300 mt-1 shrink-0 w-6">{n}</span>
                  <span className="text-base font-medium leading-snug">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: form / result */}
          <div>
            {status === "success" && result ? (
              <SuccessCard score={result.score} summary={result.summary} email={email} />
            ) : (
              <form onSubmit={handleSubmit} className="border border-gray-200 p-8 md:p-10 space-y-6">
                {/* Mode toggle */}
                <div className="flex border border-gray-200 w-fit">
                  {(["upload", "paste"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => { setMode(m); setFile(null); setText(""); setErrorMsg(""); }}
                      className={`px-4 py-2 text-sm font-medium transition-colors ${
                        mode === m
                          ? "bg-black text-white"
                          : "bg-white text-gray-500 hover:text-black"
                      }`}
                    >
                      {m === "upload" ? "Upload PDF" : "Paste text"}
                    </button>
                  ))}
                </div>

                {/* Upload zone */}
                {mode === "upload" ? (
                  <div
                    onDrop={onDrop}
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onClick={() => fileInputRef.current?.click()}
                    className={`relative border-2 border-dashed cursor-pointer transition-colors p-8 text-center ${
                      dragging
                        ? "border-black bg-gray-100"
                        : file
                        ? "border-black bg-gray-100"
                        : "border-gray-300 hover:border-black"
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                    />
                    {file ? (
                      <div>
                        <p className="font-semibold text-sm truncate">{file.name}</p>
                        <p className="text-xs text-gray-500 mt-1">{(file.size / 1024).toFixed(0)} KB · click to change</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm font-medium">Drop your LinkedIn PDF here</p>
                        <p className="text-xs text-gray-500 mt-2">
                          On LinkedIn: <span className="font-medium">More → Save to PDF</span>
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={"Paste your LinkedIn headline + About section here…"}
                    rows={8}
                    className="w-full border border-gray-200 p-4 text-sm resize-none focus:outline-none focus:border-black placeholder:text-gray-400 font-sans"
                  />
                )}

                {/* Email */}
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Your email address"
                  className="w-full border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:border-black placeholder:text-gray-400 font-sans"
                />

                {/* Error */}
                {errorMsg && (
                  <p className="text-sm text-red-600">{errorMsg}</p>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="w-full bg-black text-white py-4 text-sm font-semibold tracking-wide uppercase hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {status === "loading"
                    ? LOADING_STEPS[loadingStep]
                    : "Analyse my profile →"}
                </button>

                <p className="text-xs text-gray-500 text-center">
                  Your data is used solely to generate your audit. We never share it.
                </p>
              </form>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 px-6 md:px-12 py-6 flex items-center justify-between text-xs text-gray-500">
        <span>© {new Date().getFullYear()} Krist Pjetraj</span>
        <span>LinkedIn Ghostwriting Agency</span>
      </footer>
    </div>
  );
}

function SuccessCard({ score, summary, email }: { score: number; summary: string; email: string }) {
  const grade =
    score >= 80 ? "Strong" : score >= 60 ? "Average" : score >= 40 ? "Weak" : "Critical";

  return (
    <div className="border border-gray-200 p-8 md:p-10 space-y-8">
      <div>
        <p className="text-xs font-semibold tracking-widest uppercase text-gray-500 mb-4">
          Your score
        </p>
        <div className="flex items-end gap-2 mb-4">
          <span className="text-8xl font-black leading-none">{score}</span>
          <span className="text-2xl font-medium text-gray-500 mb-3">/100</span>
        </div>
        <span className="inline-block border border-black px-3 py-1 text-xs font-semibold uppercase tracking-wider">
          {grade}
        </span>
      </div>

      <p className="text-base text-gray-600 leading-relaxed">{summary}</p>

      <div className="border-t border-gray-200 pt-6">
        <p className="text-sm font-semibold mb-1">Full breakdown + rewrite sent to:</p>
        <p className="text-sm text-gray-500">{email}</p>
      </div>

      <p className="text-xs text-gray-400">
        Check your spam folder if it doesn&apos;t arrive within a minute.
      </p>
    </div>
  );
}
