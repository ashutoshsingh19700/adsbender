import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CompletePayoutDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  providerRef?: string;
}
