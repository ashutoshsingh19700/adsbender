import { IsEnum, IsOptional, IsString } from 'class-validator';

import { PublicRegisterRole } from './register.dto';

export class GoogleAuthDto {
  // Google Identity Services ID token (JWT) from the frontend's "Sign in
  // with Google" button - verified server-side against GOOGLE_CLIENT_ID.
  @IsString()
  idToken: string;

  // Only used the first time this Google account signs in and no app
  // account exists yet for its email - picks which side (advertiser vs
  // publisher) the new account belongs to.
  @IsOptional()
  @IsEnum(PublicRegisterRole)
  role?: PublicRegisterRole;
}
