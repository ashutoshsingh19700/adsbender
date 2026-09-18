import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { ThrottlerLimitDetail } from '@nestjs/throttler';

// The stock ThrottlerGuard throws `ThrottlerException`, whose default
// message is the class name itself ("ThrottlerException: Too Many
// Requests") - technically accurate but reads like a raw internal error to
// an end user rather than a normal, expected "slow down" response. Same
// 429 status and AllExceptionsFilter handling either way; this only swaps
// the message body for something a real user's UI can show as-is.
@Injectable()
export class FriendlyThrottlerGuard extends ThrottlerGuard {
  protected async throwThrottlingException(
    _context: ExecutionContext,
    _throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    throw new HttpException(
      { message: 'Too many requests - please wait a moment and try again.' },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
