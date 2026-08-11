import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isAuthenticatedUser } from "@/lib/auth/dal";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (!isAuthenticatedUser(auth)) return auth;

  const { id } = await params;
  await prisma.memory.deleteMany({ where: { id, userId: auth.id } });
  return NextResponse.json({ ok: true });
}
