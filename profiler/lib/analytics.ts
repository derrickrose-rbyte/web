import fs from "fs";

const FILE = "/tmp/profiler-analytics.json";

export interface AnalyticsEntry {
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

export function logSubmission(entry: AnalyticsEntry): void {
  let entries: AnalyticsEntry[] = [];
  try {
    entries = JSON.parse(fs.readFileSync(FILE, "utf-8"));
  } catch {
    // first entry
  }
  entries.push(entry);
  fs.writeFileSync(FILE, JSON.stringify(entries));
}

export function getSubmissions(): AnalyticsEntry[] {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf-8"));
  } catch {
    return [];
  }
}
