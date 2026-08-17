import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';

import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UsersService } from '../users/users.service';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly supabase: SupabaseService,
  ) {}

  async register(registerDto: RegisterDto) {
    const existingUser = await this.usersService.findByEmail(
      registerDto.email,
    );

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // Supabase Auth is the source of truth for credentials. `email_confirm:
    // true` skips email-confirmation-gated login for now - flip this to
    // false once outbound email (Supabase's SMTP or a custom provider) is
    // configured, so registration requires a real inbox to complete.
    const { data, error } = await this.supabase.admin.auth.admin.createUser({
      email: registerDto.email,
      password: registerDto.password,
      email_confirm: true,
      user_metadata: {
        name: registerDto.name,
        role: registerDto.role,
      },
    });

    if (error || !data.user) {
      if (error?.status === 422 || error?.code === 'email_exists') {
        throw new ConflictException('Email already exists');
      }
      throw new InternalServerErrorException(
        error?.message ?? 'Failed to create user',
      );
    }

    try {
      const user = await this.usersService.create({
        id: data.user.id,
        name: registerDto.name,
        email: registerDto.email,
        role: registerDto.role,
      });

      return {
        message: 'User registered successfully',
        user,
      };
    } catch (dbError) {
      // Roll back the Supabase auth user so a Prisma-side failure doesn't
      // leave an orphaned auth account with no matching profile row.
      await this.supabase.admin.auth.admin.deleteUser(data.user.id);
      throw dbError;
    }
  }

  async login(loginDto: LoginDto, response: Response) {
    const { data, error } = await this.supabase.anon.auth.signInWithPassword({
      email: loginDto.email,
      password: loginDto.password,
    });

    if (error || !data.session || !data.user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const user = await this.usersService.findById(data.user.id);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    response.cookie('token', data.session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: data.session.expires_in * 1000,
    });

    return {
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }
}
