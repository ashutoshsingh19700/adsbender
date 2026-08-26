import { IsInt, Max, Min } from 'class-validator';

// Basis points, not a float percentage (2000 = 20.00%) - see
// PlatformSetting.platformFeeBps in schema.prisma for why.
export class UpdatePlatformFeeDto {
  @IsInt()
  @Min(0)
  @Max(10_000)
  platformFeeBps: number;
}
