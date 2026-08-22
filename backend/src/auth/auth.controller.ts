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

  @Post('register')
  async register(@Body() registerDto: RegisterDto, @Ip() ip: string) {
    await this.assertHuman(registerDto.captchaToken, ip);
    return this.authService.register(registerDto);
  }

  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
    @Ip() ip: string,
  ) {
    await this.assertHuman(loginDto.captchaToken, ip);
    return this.authService.login(loginDto, response);
  }

  @Post('forgot-password')
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Ip() ip: string,
  ) {
    await this.assertHuman(dto.captchaToken, ip);
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('phone/send-otp')
  async sendPhoneOtp(@Body() dto: SendPhoneOtpDto, @Ip() ip: string) {
    await this.assertHuman(dto.captchaToken, ip);
    return this.authService.sendPhoneOtp(dto);
  }

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
