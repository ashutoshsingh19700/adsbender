import {
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class DepositDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(1_000_000)
  amount: number;

  // Optional client-supplied idempotency key so retried/duplicate "Add
  // funds" clicks (e.g. a double-submit or a client-side retry after a
  // timeout) can never post two deposits for one user action.
  @IsOptional()
  @IsString()
  @MaxLength(255)
  idempotencyKey?: string;
}
