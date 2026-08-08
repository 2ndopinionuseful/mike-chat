// Static index of validated real-quote data batches, one file per ingested
// metro (or ingestion batch). Deliberately explicit imports, NOT a runtime
// fs.readdirSync directory scan - Vercel's serverless bundler only reliably
// includes files it can statically trace at build time, and a dynamic
// directory scan is a common way for this kind of data to silently vanish
// in production while still working fine locally.
//
// To add a new metro: drop the JSON file in this folder, then add one line
// here. This manual step is intentional at current scale - per the "no
// abstraction before repetition" principle, an automatic ingestion pipeline
// isn't worth building until there's enough real volume to justify it.
import columbus202608 from "./columbus-2026-08.json";

export const QUOTE_DATA_FILES = [
  columbus202608,
] as const;
