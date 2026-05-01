-- Keep production user records compatible with generated Prisma clients that expect an access status.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ACTIVE';
