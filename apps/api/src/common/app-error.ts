import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Machine-readable error codes returned in `{ statusCode, code, message }`.
 * The web app maps behaviour on `code`; `message` is user-facing (Spanish).
 */
export type AppErrorCode =
  | 'VALIDATION_ERROR'
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_LOCKED'
  | 'EMAIL_TAKEN'
  | 'UNAUTHENTICATED'
  | 'INVALID_ORIGIN'
  | 'INVALID_RESET_TOKEN'
  | 'INVALID_CURRENT_PASSWORD'
  | 'NO_TENANT'
  | 'FORBIDDEN_ROLE'
  | 'ALREADY_ONBOARDED'
  | 'STORE_NOT_FOUND'
  | 'PLAN_NOT_FOUND'
  | 'PLAN_NOT_REQUESTABLE'
  | 'PENDING_REQUEST_EXISTS'
  | 'REQUEST_NOT_FOUND'
  | 'SUBSCRIPTION_NOT_FOUND'
  | 'SUBSCRIPTION_INACTIVE'
  | 'FEATURE_NOT_IN_PLAN'
  | 'PLAN_LIMIT_REACHED';

export class AppError extends HttpException {
  constructor(
    status: HttpStatus,
    readonly code: AppErrorCode,
    message: string,
    extra: Record<string, unknown> = {},
  ) {
    super({ statusCode: status, code, message, ...extra }, status);
  }
}
