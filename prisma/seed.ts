import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log("\n[🌱] Seeding the database with test data...");

  // Clear existing data to prevent duplicates during testing
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  // Create a master test organization
  const org = await prisma.organization.create({
    data: {
      name: "Novoriq Alpha Testers",
      tier: "PRO", // Bypasses the paywall for testing
    }
  });

  // Create a securely hashed password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash("admin123!", salt);

  // Create the Admin user attached to the organization
  const user = await prisma.user.create({
    data: {
      email: "admin@novoriq.local",
      passwordHash: hashedPassword,
      role: "ADMIN",
      organizationId: org.id
    }
  });

  console.log(`[✅] Organization created: ${org.name} (ID: ${org.id})`);
  console.log(`[✅] User created: ${user.email} (Org ID: ${user.organizationId})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
