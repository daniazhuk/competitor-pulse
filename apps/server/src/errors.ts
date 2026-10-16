import type { ErrorCode } from '@competitor-pulse/contract';

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super('VALIDATION_ERROR', 400, message);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super('NOT_FOUND', 404, message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super('CONFLICT', 409, message);
  }
}

export class UnknownCompetitorError extends AppError {
  constructor(id: string) {
    super('UNKNOWN_COMPETITOR', 422, `No listing source is available for competitor "${id}"`);
  }
}
