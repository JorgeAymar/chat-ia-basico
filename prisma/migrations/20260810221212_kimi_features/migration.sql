-- DropIndex
DROP INDEX "Conversation_updatedAt_idx";

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "pinned" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "sources" JSONB,
ADD COLUMN     "thinking" TEXT;

-- CreateIndex
CREATE INDEX "Conversation_pinned_updatedAt_idx" ON "Conversation"("pinned", "updatedAt");
