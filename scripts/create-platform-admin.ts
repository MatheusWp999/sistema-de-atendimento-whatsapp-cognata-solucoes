import { prisma } from "@/lib/db";
import { hashPassword } from "@/services/password.service";

async function main() {
  const email = (process.env.PLATFORM_ADMIN_EMAIL || "admin@central.local").toLowerCase();
  const password = process.env.PLATFORM_ADMIN_PASSWORD || "Admin@12345";
  const name = process.env.PLATFORM_ADMIN_NAME || "Administrador da Plataforma";

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name,
      passwordHash: hashPassword(password),
      role: "PLATFORM_ADMIN",
      active: true,
    },
    update: {
      name,
      passwordHash: hashPassword(password),
      role: "PLATFORM_ADMIN",
      active: true,
    },
    select: { id: true, email: true, name: true, role: true },
  });

  console.log(JSON.stringify({ user, password }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
