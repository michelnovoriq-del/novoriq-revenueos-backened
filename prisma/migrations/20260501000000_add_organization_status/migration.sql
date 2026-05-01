-- Add launch access status used by the Whop hard-lock provisioning path.
ALTER TABLE "Organization" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'INACTIVE';
