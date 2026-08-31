import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class CreateAdZoneDto {
  @IsString()
  @MinLength(2)
  zoneName: string;

  // Ties this zone to one of the publisher's sites, so it shows up nested
  // under that site on the Websites page. Optional - zones can still be
  // created standalone from the generic Publisher Portal flow.
  @IsOptional()
  @IsString()
  siteId?: string;

  @IsInt()
  @Min(1)
  @Max(4000)
  width: number;

  @IsInt()
  @Min(1)
  @Max(4000)
  height: number;

  @IsString()
  @MinLength(2)
  layoutType: string;
}
