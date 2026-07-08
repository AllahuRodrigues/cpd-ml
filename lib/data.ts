import fs from "fs";
import path from "path";
import type { CpdAnalysis } from "./types";

let cached: CpdAnalysis | null = null;

export function getData(): CpdAnalysis {
  if (cached) return cached;
  const p = path.join(process.cwd(), "data", "cpd_analysis.json");
  cached = JSON.parse(fs.readFileSync(p, "utf-8")) as CpdAnalysis;
  return cached;
}
