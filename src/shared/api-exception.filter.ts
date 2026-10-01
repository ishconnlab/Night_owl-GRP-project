import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * Keeps every error on the same envelope the frontend expects and stops raw
 * database or stack details from reaching clients.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const payload =
      exception instanceof HttpException ? exception.getResponse() : null;

    let message = 'Something went wrong. Please try again.';
    if (typeof payload === 'string') {
      message = payload;
    } else if (payload && typeof payload === 'object') {
      const raw = (payload as { message?: string | string[] }).message;
      message = Array.isArray(raw) ? raw.join(', ') : (raw ?? message);
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      console.error(`[${request.method} ${request.url}]`, exception);
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      path: request.url,
    });
  }
}