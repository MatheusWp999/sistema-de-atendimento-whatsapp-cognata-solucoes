import { prisma } from "@/lib/db";
import { hashPassword } from "@/services/password.service";

function slugify(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "") || "empresa";
}

async function main() {
  const password = process.env.COMPANY_DEFAULT_PASSWORD || "Empresa@123";
  const companies = await prisma.company.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  const createdUsers = [];

  for (const company of companies) {
    const email = `${slugify(company.name)}@demo.local`;
    const existing = await prisma.user.findUnique({ where: { email }, include: { memberships: true } });
    if (existing) {
      const hasMembership = existing.memberships.some((membership) => membership.companyId === company.id);
      if (!hasMembership) {
        await prisma.companyMembership.create({ data: { userId: existing.id, companyId: company.id, role: "OWNER" } });
      }
      continue;
    }

    const user = await prisma.user.create({
      data: {
        name: `Admin ${company.name}`,
        email,
        passwordHash: hashPassword(password),
        role: "OWNER",
        memberships: { create: { companyId: company.id, role: "OWNER" } },
      },
    });
    createdUsers.push({ company: company.name, email: user.email });
  }

  console.log(JSON.stringify({ password, createdUsers }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
