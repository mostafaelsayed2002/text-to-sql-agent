import { NextResponse } from "next/server";
import { MOCK_SCHEMA } from "@/lib/mock-data";

/** Stands in for the FastAPI GET /schema until the backend exists. */
export async function GET() {
  return NextResponse.json(MOCK_SCHEMA);
}
