import {
  IsBoolean,
  IsOptional,
  IsString,
  Length,
  MinLength,
} from 'class-validator';

export class ValidateDomainDto {
  @IsString()
  @MinLength(3)
  domain: string;

  @IsOptional()
  @IsString()
  expectedText?: string;

  // Set from the "Add new Website" dialog - see PublisherSite.category in
  // schema.prisma for why this isn't a fixed enum.
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsBoolean()
  adultAds?: boolean;

  // ISO 3166-1 alpha-2 code for this site's primary traffic country - see
  // PublisherSite.country in schema.prisma for what it's used for.
  @IsOptional()
  @IsString()
  @Length(2, 2)
  country?: string;
}
