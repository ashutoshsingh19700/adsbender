import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';

import { PublicRegisterRole } from './register.dto';

export class VerifyPhoneOtpDto {
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message: 'Phone number must be in E.164 format, e.g. +15551234567',
  })
  phone: string;

  // The 6-digit code Supabase texted to `phone`.
  @IsString()
  token: string;

  // Only used the first time a phone number signs in and no account exists
  // yet for it - completes registration in the same request instead of a
  // separate "finish setting up your account" step.
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(PublicRegisterRole)
  role?: PublicRegisterRole;
}
