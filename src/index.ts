import { ConnectionManager, ConnectionOptions, ConnectionStatus } from './connection-manager';
import { StateManager } from './state-manager';
import { DeviceState, NcState, AcState, InCallState, SubscriptionTopic } from './types';
import { SDKEvent, EventHandler, ConnectionState } from './events';
import { ErrorCode, KrispSDKError } from './errors';

export interface KrispSDKOptions extends ConnectionOptions {
  autoSubscribe?: boolean;
  autoSubscribeTopics?: SubscriptionTopic[];
}

/**
 * Interface for KrispLocalMonitoringSDK
 */
export interface IKrispLocalMonitoringSDK {
  connect(): Promise<void>;
  disconnect(): void;
  getDevicesState(): Promise<DeviceState>;
  getNoiseCancellationState(): Promise<NcState>;
  getAccentConversionState(): Promise<AcState>;
  getInCallState(): Promise<InCallState>;
  subscribe(topics: SubscriptionTopic[]): Promise<void>;
  unsubscribe(topics: SubscriptionTopic[]): Promise<void>;
  getConnectionStatus(): ConnectionStatus;
  on(event: SDKEvent, handler: EventHandler): void;
  off(event: SDKEvent, handler?: EventHandler): void;
  ping(): Promise<void>;
}

/**
 * Main SDK class for connecting to Krisp Desktop WebSocket API
 */
export class KrispLocalMonitoringSDK implements IKrispLocalMonitoringSDK {
  private connectionManager: ConnectionManager;
  private stateManager: StateManager;
  private options: KrispSDKOptions;
  private subscribedTopics: Set<SubscriptionTopic> = new Set();
  private connectionChangeHandlers: Set<EventHandler<ConnectionState>> = new Set();
  private eventHandlers: Map<SDKEvent, Set<EventHandler>> = new Map();
  private wasConnected: boolean = false;
  private isReconnecting: boolean = false;

  constructor(options: KrispSDKOptions = {}) {
    this.options = options;
    this.stateManager = new StateManager();

    // Initialize event handler maps
    Object.values(SDKEvent).forEach((event) => {
      this.eventHandlers.set(event, new Set());
    });

    // Set up connection manager with callbacks
    this.connectionManager = new ConnectionManager(
      options,
      (event, data) => {
        try {
          this.stateManager.handleMessage(event, data);
        } catch (error) {
          this.emitError(
            new KrispSDKError(
              ErrorCode.INVALID_MESSAGE,
              `Failed to process message: ${error}`
            )
          );
        }
      },
      (status) => {
        this.emitConnectionChange(status);
      }
    );

    // Forward state manager events to SDK handlers (not back to state manager!)
    this.stateManager.on(SDKEvent.DEVICES_CHANGED, (data) => {
      this.emitToHandlers(SDKEvent.DEVICES_CHANGED, data);
    });

    this.stateManager.on(SDKEvent.NOISE_CANCELLATION_CHANGED, (data) => {
      this.emitToHandlers(SDKEvent.NOISE_CANCELLATION_CHANGED, data);
    });

    this.stateManager.on(SDKEvent.ACCENT_CONVERSION_CHANGED, (data) => {
      this.emitToHandlers(SDKEvent.ACCENT_CONVERSION_CHANGED, data);
    });

    this.stateManager.on(SDKEvent.IN_CALL_CHANGED, (data) => {
      this.emitToHandlers(SDKEvent.IN_CALL_CHANGED, data);
    });

    this.stateManager.on(SDKEvent.ERROR, (data) => {
      this.emitError(
        new KrispSDKError(ErrorCode.UNKNOWN_ERROR, data.message || 'Server error', undefined)
      );
    });
  }

  /**
   * Connect to the Krisp Desktop WebSocket server
   */
  public async connect(): Promise<void> {
    this.isReconnecting = false; // Reset reconnection flag for manual connect
    await this.connectionManager.connect();

    // Fetch initial states
    await this.fetchInitialStates();

    // Auto-subscribe if enabled
    if (this.options.autoSubscribe !== false) {
      const topics = this.options.autoSubscribeTopics || ['devices', 'nc', 'ac', 'in_call'];
      await this.subscribe(topics);
    }
  }

  /**
   * Disconnect from the server
   */
  public disconnect(): void {
    this.connectionManager.disconnect();
    this.subscribedTopics.clear();
    this.wasConnected = false;
    this.isReconnecting = false;
  }

  /**
   * Get current device state
   */
  public async getDevicesState(): Promise<DeviceState> {
    if (!this.connectionManager.isConnected()) {
      throw new KrispSDKError(ErrorCode.CONNECTION_REFUSED, 'Not connected to server');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new KrispSDKError(ErrorCode.CONNECTION_TIMEOUT, 'Request timeout'));
      }, 5000);

      const handler = (state: DeviceState) => {
        cleanup();
        resolve(state);
      };

      const cleanup = () => {
        clearTimeout(timeout);
        this.connectionManager.off('device_state', handler);
      };

      // Listen for the state update
      this.connectionManager.on('device_state', handler);

      // Request the state
      this.connectionManager.emit('get_device_state', {}, (response: any) => {
        if (!response?.success) {
          cleanup();
          reject(new KrispSDKError(ErrorCode.UNKNOWN_ERROR, 'Failed to get device state'));
        }
        // If we already have state, resolve immediately
        const currentState = this.stateManager.getDeviceState();
        if (currentState) {
          cleanup();
          resolve(currentState);
        }
      });
    });
  }

  /**
   * Get current noise cancellation state
   */
  public async getNoiseCancellationState(): Promise<NcState> {
    if (!this.connectionManager.isConnected()) {
      throw new KrispSDKError(ErrorCode.CONNECTION_REFUSED, 'Not connected to server');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new KrispSDKError(ErrorCode.CONNECTION_TIMEOUT, 'Request timeout'));
      }, 5000);

      const handler = (state: NcState) => {
        cleanup();
        resolve(state);
      };

      const cleanup = () => {
        clearTimeout(timeout);
        this.connectionManager.off('nc_state', handler);
      };

      // Listen for the state update
      this.connectionManager.on('nc_state', handler);

      // Request the state
      this.connectionManager.emit('get_nc_state', {}, (response: any) => {
        if (!response?.success) {
          cleanup();
          reject(new KrispSDKError(ErrorCode.UNKNOWN_ERROR, 'Failed to get NC state'));
        }
        // If we already have state, resolve immediately
        const currentState = this.stateManager.getNcState();
        if (currentState) {
          cleanup();
          resolve(currentState);
        }
      });
    });
  }

  /**
   * Get current accent conversion state
   */
  public async getAccentConversionState(): Promise<AcState> {
    if (!this.connectionManager.isConnected()) {
      throw new KrispSDKError(ErrorCode.CONNECTION_REFUSED, 'Not connected to server');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new KrispSDKError(ErrorCode.CONNECTION_TIMEOUT, 'Request timeout'));
      }, 5000);

      const handler = (state: AcState) => {
        cleanup();
        resolve(state);
      };

      const cleanup = () => {
        clearTimeout(timeout);
        this.connectionManager.off('ac_state', handler);
      };

      // Listen for the state update
      this.connectionManager.on('ac_state', handler);

      // Request the state
      this.connectionManager.emit('get_ac_state', {}, (response: any) => {
        if (!response?.success) {
          cleanup();
          reject(new KrispSDKError(ErrorCode.UNKNOWN_ERROR, 'Failed to get AC state'));
        }
        // If we already have state, resolve immediately
        const currentState = this.stateManager.getAcState();
        if (currentState) {
          cleanup();
          resolve(currentState);
        }
      });
    });
  }

  /**
   * Get current in-call state
   */
  public async getInCallState(): Promise<InCallState> {
    if (!this.connectionManager.isConnected()) {
      throw new KrispSDKError(ErrorCode.CONNECTION_REFUSED, 'Not connected to server');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new KrispSDKError(ErrorCode.CONNECTION_TIMEOUT, 'Request timeout'));
      }, 5000);

      const handler = (state: InCallState) => {
        cleanup();
        resolve(state);
      };

      const cleanup = () => {
        clearTimeout(timeout);
        this.connectionManager.off('in_call_state', handler);
      };

      // Listen for the state update
      this.connectionManager.on('in_call_state', handler);

      // Request the state
      this.connectionManager.emit('get_in_call_state', {}, (response: any) => {
        if (!response?.success) {
          cleanup();
          reject(new KrispSDKError(ErrorCode.UNKNOWN_ERROR, 'Failed to get in-call state'));
        }
        // If we already have state, resolve immediately
        const currentState = this.stateManager.getInCallState();
        if (currentState) {
          cleanup();
          resolve(currentState);
        }
      });
    });
  }

  /**
   * Subscribe to state updates
   */
  public async subscribe(topics: SubscriptionTopic[]): Promise<void> {
    if (!this.connectionManager.isConnected()) {
      throw new KrispSDKError(ErrorCode.CONNECTION_REFUSED, 'Not connected to server');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new KrispSDKError(ErrorCode.CONNECTION_TIMEOUT, 'Request timeout'));
      }, 5000);

      this.connectionManager.emit('subscribe', { topics }, (response: any) => {
        clearTimeout(timeout);
        if (response?.success) {
          // Only add topics that the server confirmed it subscribed to
          const confirmedTopics = response.subscribed || topics;
          confirmedTopics.forEach((topic: SubscriptionTopic) => {
            if (topics.includes(topic)) {
              this.subscribedTopics.add(topic);
            }
          });
          console.log(`Subscribed to topics: ${topics.join(', ')}, server confirmed: ${confirmedTopics.join(', ')}`);
          resolve();
        } else {
          console.error('Subscription failed:', response);
          reject(new KrispSDKError(ErrorCode.UNKNOWN_ERROR, 'Failed to subscribe'));
        }
      });
    });
  }

  /**
   * Unsubscribe from state updates
   */
  public async unsubscribe(topics: SubscriptionTopic[]): Promise<void> {
    if (!this.connectionManager.isConnected()) {
      throw new KrispSDKError(ErrorCode.CONNECTION_REFUSED, 'Not connected to server');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new KrispSDKError(ErrorCode.CONNECTION_TIMEOUT, 'Request timeout'));
      }, 5000);

      this.connectionManager.emit('unsubscribe', { topics }, (response: any) => {
        clearTimeout(timeout);
        if (response?.success) {
          topics.forEach((topic) => this.subscribedTopics.delete(topic));
          resolve();
        } else {
          reject(new KrispSDKError(ErrorCode.UNKNOWN_ERROR, 'Failed to unsubscribe'));
        }
      });
    });
  }

  /**
   * Get connection status
   */
  public getConnectionStatus(): ConnectionStatus {
    return this.connectionManager.getStatus();
  }

  /**
   * Register event handler
   */
  public on(event: SDKEvent, handler: EventHandler): void {
    if (event === SDKEvent.CONNECTION_CHANGED) {
      // Connection changes are handled separately
      this.connectionChangeHandlers.add(handler as EventHandler<ConnectionState>);
    } else {
      const handlers = this.eventHandlers.get(event);
      if (handlers) {
        handlers.add(handler);
      }
    }
  }

  /**
   * Unregister event handler
   */
  public off(event: SDKEvent, handler?: EventHandler): void {
    if (event === SDKEvent.CONNECTION_CHANGED) {
      if (handler) {
        this.connectionChangeHandlers.delete(handler as EventHandler<ConnectionState>);
      } else {
        this.connectionChangeHandlers.clear();
      }
    } else {
      const handlers = this.eventHandlers.get(event);
      if (handlers) {
        if (handler) {
          handlers.delete(handler);
        } else {
          handlers.clear();
        }
      }
    }
  }

  /**
   * Ping the server (for testing connection)
   */
  public async ping(): Promise<void> {
    if (!this.connectionManager.isConnected()) {
      throw new KrispSDKError(ErrorCode.CONNECTION_REFUSED, 'Not connected to server');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new KrispSDKError(ErrorCode.CONNECTION_TIMEOUT, 'Ping timeout'));
      }, 5000);

      this.connectionManager.emit('ping', {}, (response: any) => {
        clearTimeout(timeout);
        if (response?.success) {
          resolve();
        } else {
          reject(new KrispSDKError(ErrorCode.UNKNOWN_ERROR, 'Ping failed'));
        }
      });
    });
  }

  private async fetchInitialStates(): Promise<void> {
    try {
      await Promise.all([
        this.getDevicesState().catch(() => {
          // Ignore errors, state will be available when subscribed
        }),
        this.getNoiseCancellationState().catch(() => {
          // Ignore errors, state will be available when subscribed
        }),
        this.getAccentConversionState().catch(() => {
          // Ignore errors, state will be available when subscribed
        }),
        this.getInCallState().catch(() => {
          // Ignore errors, state will be available when subscribed
        }),
      ]);
    } catch (error) {
      // Initial fetch errors are non-fatal
      console.warn('Failed to fetch initial states:', error);
    }
  }

  private emitToHandlers(event: SDKEvent, data: any): void {
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

  private emitError(error: KrispSDKError): void {
    this.emitToHandlers(SDKEvent.ERROR, {
      code: error.code,
      message: error.message,
      originalError: error.originalError,
    });
  }

  private emitConnectionChange(status: ConnectionStatus): void {
    const connectionState: ConnectionState = {
      connected: status.connected,
      connecting: status.connecting,
      error: status.error,
    };

    // Detect reconnection: was disconnected, now connected
    const justReconnected = !this.wasConnected && status.connected && this.isReconnecting;
    
    if (status.connected && !this.wasConnected) {
      // Connection established (initial or reconnection)
      this.isReconnecting = this.wasConnected; // If wasConnected was true, this is a reconnection
      this.wasConnected = true;
      
      // On reconnection, re-subscribe and fetch states
      if (justReconnected) {
        this.handleReconnection().catch((error) => {
          console.error('Error during reconnection handling:', error);
        });
      }
    } else if (!status.connected && this.wasConnected) {
      // Connection lost
      this.wasConnected = false;
      this.isReconnecting = true;
    }

    // Emit to dedicated handlers
    this.connectionChangeHandlers.forEach((handler) => {
      try {
        handler(connectionState);
      } catch (error) {
        console.error('Error in connection change handler:', error);
      }
    });
    // Also emit to regular event handlers
    this.emitToHandlers(SDKEvent.CONNECTION_CHANGED, connectionState);
  }

  private async handleReconnection(): Promise<void> {
    try {
      // Wait for connection to be fully established
      // The reconnect event might fire before the socket is ready
      let retries = 10;
      while (!this.connectionManager.isConnected() && retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
        retries--;
      }

      if (!this.connectionManager.isConnected()) {
        console.warn('Connection not ready after reconnection');
        return;
      }

      // Re-fetch initial states
      await this.fetchInitialStates();

      // Re-subscribe to previously subscribed topics or auto-subscribe topics
      if (this.options.autoSubscribe !== false) {
        const topics = this.subscribedTopics.size > 0
          ? Array.from(this.subscribedTopics)
          : (this.options.autoSubscribeTopics || ['devices', 'nc', 'ac', 'in_call']);
        
        await this.subscribe(topics);
        console.log(`Re-subscribed to topics after reconnection: ${topics.join(', ')}`);
      }
    } catch (error) {
      console.error('Failed to handle reconnection:', error);
    }
  }
}

// Export types and enums
export * from './types';
export * from './events';
export * from './errors';
export { KrispLocalMonitoringSDK as default };

