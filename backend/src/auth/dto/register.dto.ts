import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

// NOTE: ADMIN is intentionally left out here. Anyone hitting the public
// /auth/register endpoint could otherwise sign themselves up as an admin.
// Admin accounts should be created directly in the database (or by a
// future admin-only invite flow), never through public self-registration.
export enum PublicRegisterRole {
  ADVERTISER = 'ADVERTISER',
  PUBLISHER = 'PUBLISHER',
}

export class RegisterDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  // Mirrors the checklist shown in real time on the signup form (see
  // web/components/app/password-strength.tsx) - kept in sync so the backend
  // never accepts a password the frontend itself would flag as incomplete.
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/, {
    message:
      'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character',
  })
  password: string;

  @IsEnum(PublicRegisterRole)
  role: PublicRegisterRole;

  // ISO 3166-1 alpha-2 country code picked on the signup form - drives GST
  // on wallet top-ups later (see PaymentsService) and the country-based
  // "hidden from other countries" behaviour. Optional at the DTO level so an
  // older client that never sends it doesn't get rejected; the account is
  // simply created with no country on file.
  @IsOptional()
  @IsString()
  @Length(2, 2)
  country?: string;

  // Cloudflare Turnstile token from the signup widget. See LoginDto for why
  // this is optional at the DTO level.
  @IsOptional()
  @IsString()
  captchaToken?: string;
}
