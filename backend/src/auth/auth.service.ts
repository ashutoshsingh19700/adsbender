import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { OAuth2Client } from 'google-auth-library';
import type { Response } from 'express';

import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SendPhoneOtpDto } from './dto/send-phone-otp.dto';
import { VerifyPhoneOtpDto } from './dto/verify-phone-otp.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { UsersService } from '../users/users.service';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private googleClient: OAuth2Client | null = null;

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

    this.setSessionCookie(response, data.session);

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

  // Kicks off Supabase's own "reset password" email - it owns sending the
  // mail (via whatever SMTP/provider is configured on the Supabase project)
  // and issuing the one-time recovery token embedded in the link. Always
  // returns the same generic response whether or not the email exists, so
  // this endpoint can't be used to enumerate registered accounts.
  async forgotPassword(dto: ForgotPasswordDto) {
    const webAppUrl = process.env.WEB_APP_URL ?? 'http://localhost:3001';

    const { error } = await this.supabase.anon.auth.resetPasswordForEmail(
      dto.email,
      { redirectTo: `${webAppUrl}/reset-password` },
    );

    if (error) {
      // Log the real failure (e.g. Supabase SMTP not configured) but never
      // leak it to the caller - same enumeration-safety reasoning as above.
      this.logger.error(
        `resetPasswordForEmail failed for ${dto.email}: ${error.message}`,
      );
    }

    return {
      message:
        'If an account exists for that email, a password reset link has been sent.',
    };
  }

  // Completes the reset: `accessToken` is the recovery token Supabase put
  // in the emailed link's URL fragment. A scoped client authenticated as
  // that token is the only thing allowed to call updateUser on its own
  // behalf - this never touches the admin API, so a stolen/expired token
  // can't be used for anything beyond what Supabase itself already granted.
  async resetPassword(dto: ResetPasswordDto) {
    const url = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;

    if (!url) {
      throw new InternalServerErrorException('SUPABASE_URL must be set');
    }

    const scopedClient = createClient(url, anonKey ?? '', {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${dto.accessToken}` } },
    });

    const { error } = await scopedClient.auth.updateUser({
      password: dto.password,
    });

    if (error) {
      throw new BadRequestException(
        'This reset link is invalid or has expired - request a new one.',
      );
    }

    return { message: 'Password updated successfully - you can log in now.' };
  }

  // Sends a one-time SMS code to `phone` via Supabase's phone auth. Supabase
  // owns OTP generation/expiry/rate-limiting and delivery through whichever
  // SMS provider (e.g. Twilio) is configured under Authentication -> Phone
  // in the Supabase dashboard.
  async sendPhoneOtp(dto: SendPhoneOtpDto) {
    const { error } = await this.supabase.anon.auth.signInWithOtp({
      phone: dto.phone,
    });

    if (error) {
      throw new BadRequestException(
        error.message || 'Could not send verification code',
      );
    }

    return { message: 'Verification code sent.' };
  }

  // Verifies the SMS code and, on success, either logs an existing user in
  // or completes registration for a first-time phone signup (name + role
  // required in that case, same as email/password RegisterDto).
  async verifyPhoneOtp(dto: VerifyPhoneOtpDto, response: Response) {
    const { data, error } = await this.supabase.anon.auth.verifyOtp({
      phone: dto.phone,
      token: dto.token,
      type: 'sms',
    });

    if (error || !data.session || !data.user) {
      throw new UnauthorizedException('Invalid or expired verification code');
    }

    let user = await this.usersService.findById(data.user.id);

    if (!user) {
      // First time this phone number has completed OTP verification -
      // finish registration using the details submitted alongside the code.
      if (!dto.name || !dto.role) {
        throw new BadRequestException(
          'name and role are required to finish creating an account',
        );
      }

      const existingByPhone = await this.usersService.findByPhone(dto.phone);
      if (existingByPhone) {
        throw new ConflictException('Phone number already in use');
      }

      user = await this.usersService.create({
        id: data.user.id,
        name: dto.name,
        email: data.user.email ?? `${data.user.id}@phone.adnetwork.local`,
        role: dto.role,
        phone: dto.phone,
      });
    } else if (!user.phone) {
      user = await this.usersService.setPhone(user.id, dto.phone);
    }

    this.setSessionCookie(response, data.session);

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

  // Verifies the Google ID token server-side, then finds-or-creates the
  // matching Supabase Auth + app user, and mints a real Supabase session
  // for it via Supabase's magic-link token exchange - the standard pattern
  // for turning an externally-verified identity into a first-party session
  // without ever touching the account's password.
  async googleAuth(dto: GoogleAuthDto, response: Response) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new InternalServerErrorException(
        'GOOGLE_CLIENT_ID is not configured on the server',
      );
    }

    if (!this.googleClient) {
      this.googleClient = new OAuth2Client(clientId);
    }

    let payload;
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: dto.idToken,
        audience: clientId,
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Invalid Google credential');
    }

    if (!payload?.email) {
      throw new UnauthorizedException('Invalid Google credential');
    }

    if (!payload.email_verified) {
      throw new UnauthorizedException('Google account email is not verified');
    }

    let user = await this.usersService.findByEmail(payload.email);

    if (!user) {
      if (!dto.role) {
        throw new BadRequestException(
          'role is required to finish creating an account',
        );
      }

      // Google already verified this email, so the account can be created
      // confirmed. The random password is never used - sign-in for this
      // user only ever happens through this Google flow or a subsequent
      // "forgot password" reset.
      const { data, error } = await this.supabase.admin.auth.admin.createUser(
        {
          email: payload.email,
          password: crypto.randomUUID(),
          email_confirm: true,
          user_metadata: { name: payload.name ?? payload.email, role: dto.role },
        },
      );

      if (error || !data.user) {
        if (error?.status === 422 || error?.code === 'email_exists') {
          throw new ConflictException('Email already exists');
        }
        throw new InternalServerErrorException(
          error?.message ?? 'Failed to create user',
        );
      }

      try {
        user = await this.usersService.create({
          id: data.user.id,
          name: payload.name ?? payload.email,
          email: payload.email,
          role: dto.role,
        });
      } catch (dbError) {
        await this.supabase.admin.auth.admin.deleteUser(data.user.id);
        throw dbError;
      }
    }

    const { data: linkData, error: linkError } =
      await this.supabase.admin.auth.admin.generateLink({
        type: 'magiclink',
        email: payload.email,
      });

    const hashedToken = linkData?.properties?.hashed_token;
    if (linkError || !hashedToken) {
      throw new InternalServerErrorException('Failed to establish session');
    }

    const { data: verifyData, error: verifyError } =
      await this.supabase.anon.auth.verifyOtp({
        token_hash: hashedToken,
        type: 'magiclink',
      });

    if (verifyError || !verifyData.session) {
      throw new InternalServerErrorException('Failed to establish session');
    }

    this.setSessionCookie(response, verifyData.session);

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

  // Shared by login/verifyPhoneOtp/googleAuth - see login() for why
  // sameSite/secure are tied to NODE_ENV.
  private setSessionCookie(
    response: Response,
    session: { access_token: string; expires_in: number },
  ) {
    const isProduction = process.env.NODE_ENV === 'production';

    response.cookie('token', session.access_token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: session.expires_in * 1000,
    });
  }
}
