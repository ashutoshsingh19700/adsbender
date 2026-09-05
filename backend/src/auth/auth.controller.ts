import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Ip,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';

import { AuthService } from './auth.service';
import { TurnstileService } from './turnstile.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SendPhoneOtpDto } from './dto/send-phone-otp.dto';
import { VerifyPhoneOtpDto } from './dto/verify-phone-otp.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles/roles.guard';
import { Roles } from './decorators/roles.decorator';

@Controller('api/v1/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly turnstile: TurnstileService,
  ) {}

  // Tighter than the global default (see ThrottlerModule.forRoot in
  // app.module.ts) - credential guessing, OTP/email-bomb spam, and account
  // enumeration all live behind these specific endpoints, and Turnstile
  // (assertHuman below) only stops scripted abuse, not a slow manual retry
  // loop or a captcha-solving service. Named to match the global 'burst'
  // tracker so this REPLACES that tracker's limit for this route rather
  // than stacking as a separate counter; the global 'sustained' tracker
  // still applies on top of it.
  @Throttle({ burst: { limit: 5, ttl: 60_000 } })
  @Post('register')
  async register(@Body() registerDto: RegisterDto, @Ip() ip: string) {
    await this.assertHuman(registerDto.captchaToken, ip);
    return this.authService.register(registerDto);
  }

  @Throttle({ burst: { limit: 10, ttl: 60_000 } })
  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
    @Ip() ip: string,
  ) {
    await this.assertHuman(loginDto.captchaToken, ip);
    return this.authService.login(loginDto, response);
  }

  @Throttle({ burst: { limit: 5, ttl: 60_000 } })
  @Post('forgot-password')
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Ip() ip: string,
  ) {
    await this.assertHuman(dto.captchaToken, ip);
    return this.authService.forgotPassword(dto);
  }

  @Throttle({ burst: { limit: 10, ttl: 60_000 } })
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Throttle({ burst: { limit: 5, ttl: 60_000 } })
  @Post('phone/send-otp')
  async sendPhoneOtp(@Body() dto: SendPhoneOtpDto, @Ip() ip: string) {
    await this.assertHuman(dto.captchaToken, ip);
    return this.authService.sendPhoneOtp(dto);
  }

  // A short numeric OTP is brute-forceable in well under a minute without
  // a limit here - captcha doesn't cover this route at all (see
  // sendPhoneOtp above for the send side).
  @Throttle({ burst: { limit: 10, ttl: 60_000 } })
  @Post('phone/verify-otp')
  async verifyPhoneOtp(
    @Body() dto: VerifyPhoneOtpDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.authService.verifyPhoneOtp(dto, response);
  }

  @Post('google')
  async googleAuth(
    @Body() dto: GoogleAuthDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.authService.googleAuth(dto, response);
  }

  // Shared Cloudflare Turnstile check for public auth endpoints - see
  // TurnstileService for the "no secret configured" dev fallback.
  private async assertHuman(captchaToken: string | undefined, ip: string) {
    const isHuman = await this.turnstile.verify(captchaToken, ip);
    if (!isHuman) {
      throw new BadRequestException(
        'Security check failed - please try again.',
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Req() req) {
    return {
      message: 'Profile fetched successfully',
      user: req.user,
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADVERTISER')
  @Get('advertiser')
  getAdvertiserOnly(@Req() req) {
    return {
      message: 'Advertiser access granted',
      user: req.user,
    };
  }
}
