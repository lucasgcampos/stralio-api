import { PrismaClient } from '@prisma/client';
import { ulid } from 'ulid';

const prisma = new PrismaClient();

async function main() {
  const userId = ulid();

  await prisma.role.createMany({
    data: [
      {
        id: ulid(),
        name: 'ADMIN'
      },
      {
        id: userId,
        name: 'USER'
      }
    ]
  });

  await prisma.user.createMany({
    data: [
      {
        personId: ulid(),
        email: 'user@email.com',
        name: 'Marco Aurélio',
        password: 'password',
        document: '11144477735',
        roleId: userId
      }
    ]
  });

  console.log('Seed executed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });