import { NextResponse } from "next/server";
import { mockQuery } from "@/lib/mock-data";

/** Stands in for the FastAPI POST /query until the backend exists. */
export async function POST(request: Request) {
  let question = "";
  try {
    const body = await request.json();
    question = typeof body?.question === "string" ? body.question.trim() : "";
  } catch {
    return NextResponse.json({ detail: "Body must be JSON." }, { status: 400 });
  }

  if (!question) {
    return NextResponse.json({ detail: "Question must not be empty." }, { status: 422 });
  }

  // The real thing spends a second or two in the LLM; keep the loading state honest.
  await new Promise((resolve) => setTimeout(resolve, 900));

  return NextResponse.json(mockQuery(question));
}
