import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectCampaignDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
