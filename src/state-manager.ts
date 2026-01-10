import { DeviceState, NcState, AcState, InCallState, ServerToClientMessages } from './types';
import { SDKEvent, EventHandler } from './events';

export class StateManager {
  private deviceState: DeviceState | null = null;
  private ncState: NcState | null = null;
  private acState: AcState | null = null;
  private inCallState: InCallState | null = null;

  private eventHandlers: Map<SDKEvent, Set<EventHandler>> = new Map();

  constructor() {
    // Initialize event handler maps
    Object.values(SDKEvent).forEach((event) => {
      this.eventHandlers.set(event, new Set());
    });
  }

  public on(event: SDKEvent, handler: EventHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.add(handler);
    }
  }

  public off(event: SDKEvent, handler?: EventHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      if (handler) {
        handlers.delete(handler);
      } else {
        handlers.clear();
      }
    }
  }

  public handleMessage(event: keyof ServerToClientMessages, data: any): void {
    switch (event) {
      case 'device_state':
        this.updateDeviceState(data);
        break;
      case 'nc_state':
        this.updateNcState(data);
        break;
      case 'ac_state':
        this.updateAcState(data);
        break;
      case 'in_call_state':
        this.updateInCallState(data);
        break;
      case 'error':
        this.emitInternal(SDKEvent.ERROR, data);
        break;
      case 'pong':
        // No-op, ping/pong is handled by connection manager
        break;
    }
  }

  public getDeviceState(): DeviceState | null {
    return this.deviceState;
  }

  public getNcState(): NcState | null {
    return this.ncState;
  }

  public getAcState(): AcState | null {
    return this.acState;
  }

  public getInCallState(): InCallState | null {
    return this.inCallState;
  }

  /**
   * Emit an event (public method for external use)
   */
  public emit(event: SDKEvent, data: any): void {
    this.emitInternal(event, data);
  }

  private updateDeviceState(newState: DeviceState): void {
    const hasChanged = !this.deviceState || this.hasDeviceStateChanged(this.deviceState, newState);
    this.deviceState = this.validateAndNormalizeDeviceState(newState);
    if (hasChanged) {
      this.emitInternal(SDKEvent.DEVICES_CHANGED, this.deviceState);
    }
  }

  private updateNcState(newState: NcState): void {
    const hasChanged = !this.ncState || this.hasNcStateChanged(this.ncState, newState);
    this.ncState = this.validateAndNormalizeNcState(newState);
    if (hasChanged) {
      this.emitInternal(SDKEvent.NOISE_CANCELLATION_CHANGED, this.ncState);
    }
  }

  private updateAcState(newState: AcState): void {
    const hasChanged = !this.acState || this.hasAcStateChanged(this.acState, newState);
    this.acState = this.validateAndNormalizeAcState(newState);
    if (hasChanged) {
      this.emitInternal(SDKEvent.ACCENT_CONVERSION_CHANGED, this.acState);
    }
  }

  private updateInCallState(newState: InCallState): void {
    const hasChanged = !this.inCallState || this.hasInCallStateChanged(this.inCallState, newState);
    this.inCallState = this.validateAndNormalizeInCallState(newState);
    if (hasChanged) {
      this.emitInternal(SDKEvent.IN_CALL_CHANGED, this.inCallState);
    }
  }

  private hasInCallStateChanged(oldState: InCallState, newState: InCallState): boolean {
    return oldState.inCall !== newState.inCall;
  }

  private hasDeviceStateChanged(oldState: DeviceState, newState: DeviceState): boolean {
    return (
      JSON.stringify(oldState[0]) !== JSON.stringify(newState[0]) ||
      JSON.stringify(oldState[1]) !== JSON.stringify(newState[1])
    );
  }

  private hasNcStateChanged(oldState: NcState, newState: NcState): boolean {
    return (
      oldState[0].enabled !== newState[0].enabled ||
      oldState[1].enabled !== newState[1].enabled
    );
  }

  private hasAcStateChanged(oldState: AcState, newState: AcState): boolean {
    return (
      oldState[0].enabled !== newState[0].enabled ||
      oldState[1].enabled !== newState[1].enabled
    );
  }

  private validateAndNormalizeDeviceState(state: any): DeviceState {
    if (!state || typeof state !== 'object') {
      throw new Error('Invalid device state: must be an object');
    }

    // Validate structure
    if (typeof state[0] !== 'object' || typeof state[1] !== 'object') {
      throw new Error('Invalid device state: missing microphone or speaker state');
    }

    return {
      0: {
        physicalDeviceInfo: state[0].physicalDeviceInfo || null,
        updatedAt: state[0].updatedAt || Date.now(),
      },
      1: {
        physicalDeviceInfo: state[1].physicalDeviceInfo || null,
        updatedAt: state[1].updatedAt || Date.now(),
      },
    };
  }

  private validateAndNormalizeNcState(state: any): NcState {
    if (!state || typeof state !== 'object') {
      throw new Error('Invalid NC state: must be an object');
    }

    return {
      0: {
        enabled: Boolean(state[0]?.enabled),
        updatedAt: state[0]?.updatedAt || Date.now(),
      },
      1: {
        enabled: Boolean(state[1]?.enabled),
        updatedAt: state[1]?.updatedAt || Date.now(),
      },
    };
  }

  private validateAndNormalizeAcState(state: any): AcState {
    if (!state || typeof state !== 'object') {
      throw new Error('Invalid AC state: must be an object');
    }

    return {
      0: {
        enabled: Boolean(state[0]?.enabled),
        updatedAt: state[0]?.updatedAt || Date.now(),
      },
      1: {
        enabled: Boolean(state[1]?.enabled),
        updatedAt: state[1]?.updatedAt || Date.now(),
      },
    };
  }

  private validateAndNormalizeInCallState(state: any): InCallState {
    if (!state || typeof state !== 'object') {
      throw new Error('Invalid in-call state: must be an object');
    }

    return {
      inCall: Boolean(state.inCall),
      updatedAt: state.updatedAt || Date.now(),
    };
  }

  private emitInternal(event: SDKEvent, data: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }
}

