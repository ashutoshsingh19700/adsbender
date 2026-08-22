import { IsEmail, IsOptional, IsString } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail()
  email: string;

  // Cloudflare Turnstile token - see LoginDto for why this is optional at
  // the DTO level.
  @IsOptional()
  @IsString()
  captchaToken?: string;
}
