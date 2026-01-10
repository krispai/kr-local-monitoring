/**
 * Error codes for connection failures
 */
export enum ErrorCode {
  KRISP_NOT_REACHABLE = 'KRISP_NOT_REACHABLE',
  CONNECTION_REFUSED = 'CONNECTION_REFUSED',
  CONNECTION_TIMEOUT = 'CONNECTION_TIMEOUT',
  INVALID_MESSAGE = 'INVALID_MESSAGE',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export class KrispSDKError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'KrispSDKError';
    Object.setPrototypeOf(this, KrispSDKError.prototype);
  }
}


