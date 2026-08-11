-- AlterTable: contraseña del usuario (null hasta que la define)
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;

-- AlterEnum: Postgres no permite DROP VALUE en un enum, así que se
-- recrea el tipo sin LOGIN (reemplazado por RESET). La tabla LoginToken
-- está vacía en este punto de la migración (tokens de un solo uso, ya
-- consumidos o descartables), así que el USING no tiene filas LOGIN que
-- fallarían el cast.
ALTER TYPE "TokenPurpose" RENAME TO "TokenPurpose_old";
CREATE TYPE "TokenPurpose" AS ENUM ('INVITE', 'RESET');
ALTER TABLE "LoginToken" ALTER COLUMN "purpose" TYPE "TokenPurpose" USING ("purpose"::text::"TokenPurpose");
DROP TYPE "TokenPurpose_old";
