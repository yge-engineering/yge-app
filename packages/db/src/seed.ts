// Seed script — sets up YGE as the first tenant with its real profile.
// Rate tables, cost codes, employees, etc. come from the Excel master extract.
// Run with: pnpm db:seed

import { PrismaClient, UserRole, InsuranceKind } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding YGE tenant…');

  // 1) Company
  const yge = await prisma.company.upsert({
    where: { id: 'yge-root' },
    update: {},
    create: {
      id: 'yge-root',
      name: 'Young General Engineering, Inc.',
      addressLine: '19645 Little Woods Rd',
      city: 'Cottonwood',
      state: 'CA',
      zip: '96022',
      cslb: '1145219',
      dir: '2000018967',
      dot: '4528204',
      naics: ['115310'],
      psc: ['F003', 'F004'],
      domain: 'youngge.com',
    },
  });
  console.log(`  Company: ${yge.name}`);

  // 2) Officers
  await prisma.officer.upsert({
    where: { id: 'officer-brook' },
    update: {},
    create: {
      id: 'officer-brook',
      companyId: yge.id,
      firstName: 'Brook',
      lastName: 'Young',
      title: 'President',
      phone: '707-499-7065',
      email: 'brookyoung@youngge.com',
      isPrimary: true,
    },
  });
  await prisma.officer.upsert({
    where: { id: 'officer-ryan' },
    update: {},
    create: {
      id: 'officer-ryan',
      companyId: yge.id,
      firstName: 'Ryan',
      lastName: 'Young',
      title: 'Vice President',
      phone: '707-599-9921',
      email: 'ryoung@youngge.com',
      isPrimary: false,
    },
  });
  console.log('  Officers: Brook Young (President), Ryan Young (VP)');

  // 3) First user — Ryan
  await prisma.user.upsert({
    where: { email: 'ryoung@youngge.com' },
    update: {},
    create: {
      companyId: yge.id,
      email: 'ryoung@youngge.com',
      firstName: 'Ryan',
      lastName: 'Young',
      phone: '707-599-9921',
      role: UserRole.OWNER,
    },
  });
  console.log('  User: Ryan Young (OWNER)');

  // Placeholder for rate + cost code seeding. The real data lands here from
  // seeds/excel-master/* once the Excel extract is run. Keeping this empty
  // in initial commit so the seed still succeeds on a clean clone.
  console.log('  (Rate + cost code seeds pending Excel extract.)');

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
