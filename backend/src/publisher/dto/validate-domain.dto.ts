import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

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
}
