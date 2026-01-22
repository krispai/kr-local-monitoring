import { Socket, io, ManagerOptions, SocketOptions } from 'socket.io-client';
import { ErrorCode, KrispSDKError } from './errors';
import { ServerToClientMessages } from './types';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORTS = [50190, 50191, 50192];
const DEFAULT_CONNECTION_TIMEOUT = 5000;
const MAX_RECONNECT_DELAY = 30000;

export interface ConnectionOptions {
  connectionTimeout?: number;
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
}

export interface ConnectionStatus {
  connected: boolean;
  connecting: boolean;
  port?: number;
  error?: {
    code: string;
    message: string;
  };
}

export class ConnectionManager {
  private socket: Socket | null = null;
  private currentPort: number | undefined = undefined;
  private isConnecting = false;
  private connectionTimeoutTimer: NodeJS.Timeout | null = null;

  constructor(
    private options: ConnectionOptions = {},
    private onMessage: (event: keyof ServerToClientMessages, data: any) => void,
    private onConnectionChange: (status: ConnectionStatus) => void
  ) {}

  public async connect(): Promise<void> {
    if (this.socket?.connected) {
      return;
    }

    if (this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    this.onConnectionChange({
      connected: false,
      connecting: true,
    });

    try {
      // Try each port in sequence
      const ports = DEFAULT_PORTS;
      const host = DEFAULT_HOST;
      let lastError: Error | null = null;

      for (const port of ports) {
        try {
          this.currentPort = port;
          await this.connectToPort(port);
          
          // Success!
          this.isConnecting = false;

          this.onConnectionChange({
            connected: true,
            connecting: false,
            port,
          });
          return; // Success, exit
        } catch (error) {
          // Clean up failed socket
          if (this.socket) {
            this.socket.removeAllListeners();
            this.socket.close();
            this.socket = null;
          }
          lastError = error as Error;
          // Continue to next port
          continue;
        }
      }

      // All ports failed
      const sdkError = lastError instanceof KrispSDKError
        ? lastError
        : new KrispSDKError(
            ErrorCode.KRISP_NOT_REACHABLE,
            'Krisp Desktop is not reachable or API is disabled'
          );

      this.isConnecting = false;
      this.onConnectionChange({
        connected: false,
        connecting: false,
        error: {
          code: sdkError.code,
          message: sdkError.message,
        },
      });

      throw sdkError;
    } catch (error) {
      this.isConnecting = false;
      const sdkError =
        error instanceof KrispSDKError
          ? error
          : new KrispSDKError(ErrorCode.UNKNOWN_ERROR, `Connection failed: ${error}`);

      this.onConnectionChange({
        connected: false,
        connecting: false,
        error: {
          code: sdkError.code,
          message: sdkError.message,
        },
      });

      throw sdkError;
    }
  }

  public disconnect(): void {
    this.clearConnectionTimeout();

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.currentPort = undefined;
    this.isConnecting = false;

    this.onConnectionChange({
      connected: false,
      connecting: false,
    });
  }

  public getStatus(): ConnectionStatus {
    return {
      connected: this.socket?.connected ?? false,
      connecting: this.isConnecting,
      port: this.currentPort,
    };
  }

  public isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  public emit(event: string, data?: any, callback?: (response: any) => void): void {
    if (!this.socket?.connected) {
      throw new KrispSDKError(ErrorCode.CONNECTION_REFUSED, 'Not connected to server');
    }
    this.socket.emit(event, data, callback);
  }

  public on(event: string, handler: (...args: any[]) => void): void {
    if (this.socket) {
      this.socket.on(event, handler);
    }
  }

  public off(event: string, handler?: (...args: any[]) => void): void {
    if (this.socket) {
      this.socket.off(event, handler);
    }
  }

  private async connectToPort(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const host = DEFAULT_HOST;
      const timeout = this.options.connectionTimeout || DEFAULT_CONNECTION_TIMEOUT;

      const socketOptions: Partial<ManagerOptions & SocketOptions> = {
        query: {
          version: '1.0.0'
        },
        transports: ['websocket'],
        timeout,
        autoConnect: true,
        reconnection: this.options.autoReconnect !== false,
        reconnectionDelayMax: MAX_RECONNECT_DELAY,
        reconnectionAttempts: this.options.maxReconnectAttempts ?? Infinity,
      };

      this.socket = io(`http://${host}:${port}`, socketOptions);

      // Set up connection timeout
      this.connectionTimeoutTimer = setTimeout(() => {
        if (!this.socket?.connected) {
          this.socket?.close();
          reject(
            new KrispSDKError(
              ErrorCode.CONNECTION_TIMEOUT,
              `Connection timeout after ${timeout}ms`
            )
          );
        }
      }, timeout);

      // Set up event handlers
      let connectPromiseSettled = false;
      
      this.socket.on('connect', () => {
        this.clearConnectionTimeout();
        console.log('ConnectionManager: connect');
        this.setupMessageHandlers();
        this.isConnecting = false;
        
        // Update connection status
        this.onConnectionChange({
          connected: true,
          connecting: false,
          port,
        });
        
        // Resolve promise only once
        if (!connectPromiseSettled) {
          connectPromiseSettled = true;
          resolve();
        }
      });

      // Handle Socket.IO's automatic reconnection attempts
      this.socket.io.on('reconnect_attempt', (attemptNumber) => {
        console.log('ConnectionManager: reconnect_attempt:', attemptNumber);
        this.isConnecting = true;
        this.onConnectionChange({
          connected: false,
          connecting: true,
          error: {
            code: ErrorCode.CONNECTION_REFUSED,
            message: `Reconnecting... (attempt ${attemptNumber})`,
          },
        });
      });

      this.socket.io.on('reconnect', (attemptNumber) => {
        console.log('ConnectionManager: reconnect:', attemptNumber);
        // Socket.IO handled the reconnection
        // Note: The socket's 'connect' event will also fire, which will update the status
        // We update here too to be responsive, but the socket's connect handler will also run
        this.isConnecting = false;
        // Only update if socket is actually connected
        if (this.socket?.connected) {
          this.onConnectionChange({
            connected: true,
            connecting: false,
            port,
          });
        }
      });

      this.socket.io.on('reconnect_error', (error) => {
        // Socket.IO will continue trying to reconnect
        this.isConnecting = true;
        this.onConnectionChange({
          connected: false,
          connecting: true,
          error: {
            code: ErrorCode.CONNECTION_REFUSED,
            message: `Reconnection error: ${error.message}`,
          },
        });
      });

      this.socket.io.on('reconnect_failed', () => {
        console.log('ConnectionManager: reconnect_failed');
        this.isConnecting = false;
        this.onConnectionChange({
          connected: false,
          connecting: false,
          error: {
            code: ErrorCode.CONNECTION_REFUSED,
            message: 'Reconnection failed after all attempts',
          },
        });
        // Socket.IO has exhausted its reconnection attempts
        // If needed, user can manually call connect() again
      });

      this.socket.on('connect_error', (error) => {
        this.clearConnectionTimeout();
        
        // Only reject promise once (on initial connection failure)
        if (!connectPromiseSettled) {
          connectPromiseSettled = true;
          if (error.message.includes('xhr poll error') || error.message.includes('websocket error')) {
            reject(
              new KrispSDKError(
                ErrorCode.CONNECTION_REFUSED,
                `Connection refused: ${error.message}`
              )
            );
          } else {
            reject(
              new KrispSDKError(ErrorCode.UNKNOWN_ERROR, `Connection error: ${error.message}`)
            );
          }
        }
        // For reconnection attempts, Socket.IO will handle it automatically
      });

      this.socket.on('disconnect', (reason) => {
        this.clearConnectionTimeout();
        
        if (reason === 'io server disconnect') {
          // Server disconnected us - don't auto-reconnect
          this.isConnecting = false;
          this.onConnectionChange({
            connected: false,
            connecting: false,
            error: {
              code: ErrorCode.CONNECTION_REFUSED,
              message: 'Server disconnected client',
            },
          });
        } else if (reason === 'io client disconnect') {
          // We disconnected intentionally, do nothing
          this.isConnecting = false;
        } else {
          console.log('ConnectionManager: Unexpected disconnect:', reason);
          // Unexpected disconnect (e.g., network loss, sleep/wake)
          // Socket.IO will handle reconnection automatically if enabled
          // The reconnect_attempt and reconnect events will update the status
          const socketWillReconnect = this.options.autoReconnect !== false && (this.socket?.active ?? false);
          
          this.onConnectionChange({
            connected: false,
            connecting: socketWillReconnect,
            error: socketWillReconnect ? undefined : {
              code: ErrorCode.CONNECTION_REFUSED,
              message: `Disconnected: ${reason}`,
            },
          });
          // Socket.IO handles reconnection automatically
        }
      });
    });
  }

  private setupMessageHandlers(): void {
    if (!this.socket) {
      return;
    }

    // Handle all server messages
    this.socket.on('device_state', (data: any) => {
      this.onMessage('device_state', data);
    });

    this.socket.on('nc_state', (data: any) => {
      this.onMessage('nc_state', data);
    });

    this.socket.on('ac_state', (data: any) => {
      this.onMessage('ac_state', data);
    });

    this.socket.on('in_call_state', (data: any) => {
      this.onMessage('in_call_state', data);
    });

    this.socket.on('error', (data: any) => {
      this.onMessage('error', data);
    });

    this.socket.on('pong', (data: any) => {
      this.onMessage('pong', data);
    });
  }

  private clearConnectionTimeout(): void {
    if (this.connectionTimeoutTimer) {
      clearTimeout(this.connectionTimeoutTimer);
      this.connectionTimeoutTimer = null;
    }
  }
}


