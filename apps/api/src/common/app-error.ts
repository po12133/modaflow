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
  | 'PLAN_LIMIT_REACHED'
  // Stage 2: catalog, inventory, photos and AI
  | 'STORAGE_NOT_CONFIGURED'
  | 'STORAGE_ERROR'
  | 'INVALID_IMAGE'
  | 'IMAGE_NOT_FOUND'
  | 'TOO_MANY_IMAGES'
  | 'CATEGORY_EXISTS'
  | 'CATEGORY_NOT_FOUND'
  | 'PRODUCT_NOT_FOUND'
  | 'PRODUCT_ARCHIVED'
  | 'VARIANT_NOT_FOUND'
  | 'DUPLICATE_VARIANT'
  | 'SKU_TAKEN'
  | 'INSUFFICIENT_STOCK'
  | 'AI_NOT_CONFIGURED'
  | 'AI_UNAVAILABLE'
  | 'AI_INVALID_RESPONSE'
  | 'ANALYSIS_IN_PROGRESS'
  // Stage 3: sales
  | 'SALE_NOT_FOUND'
  | 'SALE_ALREADY_CANCELED'
  | 'PRODUCT_UNAVAILABLE'
  | 'RECEIPT_NOT_FOUND'
  | 'CATALOG_UNAVAILABLE'
  | 'CATALOG_PRODUCT_NOT_FOUND'
  | 'CATALOG_ITEMS_UNAVAILABLE'
  | 'CATALOG_REQUEST_NOT_FOUND'
  | 'SLUG_TAKEN'
  | 'SLUG_INVALID'
  | 'ACCOUNT_SUSPENDED'
  | 'FORBIDDEN_STAFF_ROLE'
  | 'INVALID_SETUP_TOKEN'
  | 'INVALID_PASSWORD'
  | 'TENANT_WITHOUT_OWNER'
  | 'STAFF_NOT_FOUND'
  | 'STAFF_DISABLED'
  | 'STAFF_SELF_CHANGE'
  | 'LAST_SUPERADMIN'
  | 'TENANT_NOT_FOUND'
  | 'USER_NOT_FOUND'
  | 'PAYMENT_NOT_FOUND'
  | 'PAYMENT_ALREADY_REVIEWED'
  | 'PAYMENT_METHOD_UNAVAILABLE'
  | 'RECEIPT_REQUIRED'
  | 'SUBSCRIPTION_SUSPENDED'
  | 'INVALID_TRANSITION'
  | 'PLAN_NOT_PAYABLE'
  | 'NOTIFICATION_NOT_FOUND';

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
