export type SubscriptionStatus = "TRIALING" | "ACTIVE" | "EXPIRED" | "CANCELED" | "SUSPENDED";

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
