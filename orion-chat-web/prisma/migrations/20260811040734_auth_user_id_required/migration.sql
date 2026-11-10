/*
  Warnings:

  - Made the column `userId` on table `Conversation` required. This step will fail if there are existing NULL values in that column.
  - Made the column `userId` on table `Memory` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Conversation" ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Memory" ALTER COLUMN "userId" SET NOT NULL;
