import { IsOptional, IsString, MaxLength } from 'class-validator';

export class FailPayoutDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
