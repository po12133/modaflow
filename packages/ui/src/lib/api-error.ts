export interface ApiErrorBody {
  statusCode: number;
  code?: string;
  message: string | string[];
  errors?: Record<string, string[]>;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody,
  ) {
    super(Array.isArray(body.message) ? body.message.join(" ") : body.message);
  }

  get code() {
    return this.body.code;
  }
}
