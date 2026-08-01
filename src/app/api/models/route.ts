import { NextResponse } from "next/server";
import { getAvailableModels } from "@/lib/ollama";

export async function GET() {
  const result = await getAvailableModels();
  return NextResponse.json(result);
}
