import { IsString, Matches } from 'class-validator';

export class ResetPasswordDto {
  // The Supabase recovery access_token lifted from the reset-password link's
  // URL fragment (see web/app/reset-password) - proves the request came from
  // whoever clicked the emailed link, not just anyone who knows the email.
  @IsString()
  accessToken: string;

  // Mirrors RegisterDto's rule so a reset can't produce a weaker password
  // than a fresh signup would allow.
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/, {
    message:
      'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character',
  })
  password: string;
}
