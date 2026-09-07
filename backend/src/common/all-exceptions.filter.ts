import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

// Without this, an exception thrown outside a route handler's own try/catch
// (a rejected promise Nest didn't already wrap, a bug in a service, a
// third-party client throwing something that isn't an HttpException) either
// leaks an Express default HTML error page - stack trace included - or, for
// certain error shapes, can bubble past Nest's own handling entirely.
// Neither is acceptable once this is public: a stack trace is an
// information leak, and at real traffic volume a handler that occasionally
// throws must degrade to "that one request got a clean 500" rather than
// ever affecting other in-flight requests or the process itself. Catching
// literally everything here (`@Catch()` with no argument) and always
// responding with plain JSON is what guarantees that - Express/Nest already
// isolate a thrown error to the single request it happened on, this filter
// just makes sure the response for that request is safe and consistent
// instead of an accidental leak.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const payload = isHttpException
      ? exception.getResponse()
      : { message: 'Internal server error' };

    // A 5xx here means something actually went wrong server-side (a bug, a
    // downstream dependency down) - log it with enough context to act on.
    // A 4xx is normal request-level rejection (bad input, not found, fraud
    // block) and logging every one of those at scale is pure noise.
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(
        `${request.method} ${request.originalUrl} -> ${status}: ${
          exception instanceof Error ? exception.message : String(exception)
        }`,
        stack,
      );
    }

    response.status(status).json(
      typeof payload === 'string'
        ? { statusCode: status, message: payload }
        : { statusCode: status, ...payload },
    );
  }
}
