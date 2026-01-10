import { Socket, io, ManagerOptions, SocketOptions } from 'socket.io-client';
import { ErrorCode, KrispSDKError } from './errors';
import { ServerToClientMessages } from './types';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORTS = [50190, 50191, 50192];
const DEFAULT_CONNECTION_TIMEOUT = 5000;
const DEFAULT_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;
const RECONNECT_BACKOFF_MULTIPLIER = 1.5;

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
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private currentReconnectDelay = DEFAULT_RECONNECT_DELAY;
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
          
          // Success! Reset reconnection state
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.currentReconnectDelay = DEFAULT_RECONNECT_DELAY;

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

      // Attempt reconnect if enabled
      if (this.options.autoReconnect !== false) {
        this.scheduleReconnect();
      } else {
        throw sdkError;
      }
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

      // Attempt reconnect if enabled
      if (this.options.autoReconnect !== false) {
        this.scheduleReconnect();
      } else {
        throw sdkError;
      }
    }
  }

  public disconnect(): void {
    this.clearReconnectTimer();
    this.clearConnectionTimeout();

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.currentPort = undefined;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.currentReconnectDelay = DEFAULT_RECONNECT_DELAY;

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
      this.socket.on('connect', () => {
        this.clearConnectionTimeout();
        this.setupMessageHandlers();
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        this.clearConnectionTimeout();
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
      });

      this.socket.on('disconnect', (reason) => {
        this.clearConnectionTimeout();
        if (reason === 'io server disconnect') {
          // Server disconnected us
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
        } else {
          // Unexpected disconnect
          this.onConnectionChange({
            connected: false,
            connecting: false,
            error: {
              code: ErrorCode.CONNECTION_REFUSED,
              message: `Disconnected: ${reason}`,
            },
          });

          // Attempt reconnect if enabled
          if (this.options.autoReconnect !== false) {
            this.scheduleReconnect();
          }
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

  private scheduleReconnect(): void {
    this.clearReconnectTimer();

    const maxAttempts = this.options.maxReconnectAttempts;
    if (maxAttempts !== undefined && this.reconnectAttempts >= maxAttempts) {
      this.onConnectionChange({
        connected: false,
        connecting: false,
        error: {
          code: ErrorCode.CONNECTION_REFUSED,
          message: `Max reconnect attempts (${maxAttempts}) reached`,
        },
      });
      return;
    }

    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(() => {
        // Error already handled in connect()
      });
    }, this.currentReconnectDelay);

    // Increase delay for next attempt (exponential backoff)
    this.currentReconnectDelay = Math.min(
      this.currentReconnectDelay * RECONNECT_BACKOFF_MULTIPLIER,
      MAX_RECONNECT_DELAY
    );
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private clearConnectionTimeout(): void {
    if (this.connectionTimeoutTimer) {
      clearTimeout(this.connectionTimeoutTimer);
      this.connectionTimeoutTimer = null;
    }
  }
}


