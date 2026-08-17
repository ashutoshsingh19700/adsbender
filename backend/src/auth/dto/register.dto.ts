import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';

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

  @MinLength(6)
  password: string;

  @IsEnum(PublicRegisterRole)
  role: PublicRegisterRole;
}
