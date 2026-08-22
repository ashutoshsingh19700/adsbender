import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async findByPhone(phone: string) {
    return this.prisma.user.findUnique({
      where: { phone },
    });
  }

  // `id` must be the corresponding Supabase auth.users.id - credentials
  // live in Supabase, this table only stores app-level profile/role data.
  async create(data: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    phone?: string;
  }) {
    return this.prisma.user.create({
      data: {
        ...data,
        balance_usd: 0,
      },
    });
  }

  async setPhone(id: string, phone: string) {
    return this.prisma.user.update({
      where: { id },
      data: { phone },
    });
  }
}
