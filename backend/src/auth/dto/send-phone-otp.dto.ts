import { IsOptional, IsString, Matches } from 'class-validator';

export class SendPhoneOtpDto {
  // E.164 format, e.g. "+15551234567" - required by Supabase's phone auth
  // (and by SMS providers like Twilio generally).
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message: 'Phone number must be in E.164 format, e.g. +15551234567',
  })
  phone: string;

  @IsOptional()
  @IsString()
  captchaToken?: string;
}
