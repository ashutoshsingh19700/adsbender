import { IsEmail, IsOptional, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;

  // Cloudflare Turnstile token from the login widget. Optional at the DTO
  // level - TurnstileService itself skips verification (with a warning)
  // when TURNSTILE_SECRET_KEY isn't configured, so this stays required in
  // practice only once that secret is set.
  @IsOptional()
  @IsString()
  captchaToken?: string;
}
