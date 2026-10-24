// Anonymous per-day device key for rate limiting fee index submissions (F20).
// Owner: Andy (B). Server only. The date is part of the hash, so it limits
// submissions per day but can't link one student's submissions across days.
import { createHash } from "node:crypto";

export function clientHash(ip: string, salt: string, utcDate: string): string {
  return createHash("sha256").update(`${ip}|${salt}|${utcDate}`).digest("hex");
}
