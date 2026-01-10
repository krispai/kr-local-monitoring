/**
 * Type definitions matching the server-side interfaces
 */

export enum AudioDeviceType {
  microphone = 0,
  speaker = 1,
}

export interface DeviceInfo {
  id: string;
  name: string;
  description?: string;
  manufacturer?: string;
  modelId?: string;
  bus?: string;
  formFactor?: string;
  isMuted?: boolean;
  isDefaultMultimedia?: boolean;
  isDefaultCommunication?: boolean;
  isKrisp?: boolean;
  isHIDHeadset?: boolean;
  isDisabled?: boolean;
  isAvailable?: boolean;
}

export interface DevicePairState {
  physicalDeviceInfo: DeviceInfo | null;
  updatedAt: number;
}

export interface DeviceState {
  [AudioDeviceType.microphone]: DevicePairState;
  [AudioDeviceType.speaker]: DevicePairState;
}

export interface NcState {
  [AudioDeviceType.microphone]: {
    enabled: boolean;
    updatedAt: number;
  };
  [AudioDeviceType.speaker]: {
    enabled: boolean;
    updatedAt: number;
  };
}

export interface AcState {
  [AudioDeviceType.microphone]: {
    enabled: boolean;
    updatedAt: number;
  };
  [AudioDeviceType.speaker]: {
    enabled: boolean;
    updatedAt: number;
  };
}

export interface InCallState {
  inCall: boolean;
  updatedAt: number;
}

export type SubscriptionTopic = 'devices' | 'nc' | 'ac' | 'in_call';

export interface ClientToServerMessages {
  subscribe: {
    topics: SubscriptionTopic[];
  };
  unsubscribe: {
    topics: SubscriptionTopic[];
  };
}

export interface ServerToClientMessages {
  device_state: DeviceState;
  nc_state: NcState;
  ac_state: AcState;
  in_call_state: InCallState;
  error: {
    code: string;
    message: string;
  };
  pong: {};
}


