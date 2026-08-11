import { NextResponse } from "next/server";
import { getAvailableModels } from "@/lib/ollama";
import { requireUser, isAuthenticatedUser } from "@/lib/auth/dal";

export async function GET() {
  const auth = await requireUser();
  if (!isAuthenticatedUser(auth)) return auth;

  const result = await getAvailableModels();
  return NextResponse.json(result);
}
