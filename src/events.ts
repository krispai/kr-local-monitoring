/**
 * Event types emitted by the SDK
 */
export enum SDKEvent {
  DEVICES_CHANGED = 'devicesChanged',
  NOISE_CANCELLATION_CHANGED = 'noiseCancellationChanged',
  ACCENT_CONVERSION_CHANGED = 'accentConversionChanged',
  IN_CALL_CHANGED = 'inCallChanged',
  CONNECTION_CHANGED = 'connectionChanged',
  ERROR = 'error',
}

export interface ConnectionState {
  connected: boolean;
  connecting: boolean;
  error?: {
    code: string;
    message: string;
  };
}

export type EventHandler<T = any> = (data: T) => void;


