import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

// Same fields as CreateAdZoneDto, but all optional since this is a partial
// update (PATCH) - only send the fields you want to change.
export class UpdateAdZoneDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  zoneName?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4000)
  width?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4000)
  height?: number;

  @IsOptional()
  @IsString()
  @MinLength(2)
  layoutType?: string;
}
