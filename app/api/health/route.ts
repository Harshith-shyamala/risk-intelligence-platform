import { MODEL_VERSION } from "../../../lib/risk-engine";

export async function GET() {
  return Response.json({ status: "ok", service: "risk-os", modelVersion: MODEL_VERSION, timestamp: new Date().toISOString() }, { headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}
