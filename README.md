# Krisp Local Monitoring

Client SDK for connecting to Krisp Desktop WebSocket API to read device states and Krisp feature status.

## Features

- Connect to Krisp Desktop localhost WebSocket server
- Read current device states (physical devices mapped to Krisp virtual devices)
- Read Noise Cancellation (NC) and Accent Conversion (AC) states
- Read in-call status
- Subscribe to real-time updates
- Automatic reconnection with exponential backoff and auto re-subscribe
- Type-safe API with TypeScript support

## Installation

> **Note:** This NPM package is currently in progress and not ready for production use.

```bash
npm install krisp-local-monitoring
```

## Usage

### Basic Example

```typescript
import { KrispLocalMonitoringSDK, SDKEvent } from 'krisp-local-monitoring';

const sdk = new KrispLocalMonitoringSDK({
  // Optional: auto-reconnect (default: true)
  autoReconnect: true,
  // Optional: max reconnect attempts (default: unlimited)
  maxReconnectAttempts: 10,
});

// Connect to server
await sdk.connect();

// Get current device state
const deviceState = await sdk.getDevicesState();
console.log('Microphone physical device:', deviceState[0].physicalDeviceInfo?.name);
console.log('Speaker physical device:', deviceState[1].physicalDeviceInfo?.name);

// Get noise cancellation state
const ncState = await sdk.getNoiseCancellationState();
console.log('NC enabled (mic):', ncState[0].enabled);
console.log('NC enabled (speaker):', ncState[1].enabled);

// Get accent conversion state
const acState = await sdk.getAccentConversionState();
console.log('AC enabled (mic):', acState[0].enabled);
console.log('AC enabled (speaker):', acState[1].enabled);

// Get in-call state
const inCallState = await sdk.getInCallState();
console.log('In call:', inCallState.inCall);
```

### Event Handling

```typescript
// Listen for device changes
sdk.on(SDKEvent.DEVICES_CHANGED, (deviceState) => {
  console.log('Device state changed:', deviceState);
});

// Listen for noise cancellation changes
sdk.on(SDKEvent.NOISE_CANCELLATION_CHANGED, (ncState) => {
  console.log('NC state changed:', ncState);
});

// Listen for accent conversion changes
sdk.on(SDKEvent.ACCENT_CONVERSION_CHANGED, (acState) => {
  console.log('AC state changed:', acState);
});

// Listen for in-call state changes
sdk.on(SDKEvent.IN_CALL_CHANGED, (inCallState) => {
  console.log('In-call state changed:', inCallState.inCall);
});

// Listen for connection changes
sdk.on(SDKEvent.CONNECTION_CHANGED, (connectionState) => {
  console.log('Connection state:', connectionState.connected);
  if (connectionState.error) {
    console.error('Connection error:', connectionState.error);
  }
});

// Listen for errors
sdk.on(SDKEvent.ERROR, (error) => {
  console.error('SDK error:', error);
});
```

### Subscription Management

```typescript
// Subscribe to specific topics
await sdk.subscribe(['devices', 'nc', 'ac', 'in_call']);

// Unsubscribe from topics
await sdk.unsubscribe(['ac']);

// By default, SDK auto-subscribes to all topics on connect
// You can disable this:
const sdk = new KrispLocalMonitoringSDK({
  autoSubscribe: false,
  // Or subscribe to specific topics only:
  autoSubscribeTopics: ['devices', 'nc', 'in_call'],
});

// Note: On reconnection, the SDK automatically re-subscribes to previously
// subscribed topics (or auto-subscribe topics) to ensure you continue
// receiving updates after reconnection.
```

### Connection Status

```typescript
const status = sdk.getConnectionStatus();
console.log('Connected:', status.connected);
console.log('Connecting:', status.connecting);
console.log('Port:', status.port);
if (status.error) {
  console.error('Error:', status.error.code, status.error.message);
}
```

### Error Handling

```typescript
import { KrispLocalMonitoringSDK, ErrorCode } from 'krisp-local-monitoring';

try {
  await sdk.connect();
} catch (error) {
  if (error.code === ErrorCode.KRISP_NOT_REACHABLE) {
    console.error('Krisp Desktop is not reachable or API is disabled');
  } else if (error.code === ErrorCode.CONNECTION_REFUSED) {
    console.error('Connection refused');
  } else if (error.code === ErrorCode.CONNECTION_TIMEOUT) {
    console.error('Connection timeout');
  }
}
```

### API Reference

### `KrispLocalMonitoringSDK`

Main SDK class.

#### Constructor

```typescript
new KrispLocalMonitoringSDK(options?: KrispSDKOptions)
```

**Options:**

- `connectionTimeout?: number` - Connection timeout in ms (default: 5000)
- `autoReconnect?: boolean` - Enable auto-reconnect (default: true)
- `maxReconnectAttempts?: number` - Max reconnect attempts (default: unlimited)
- `autoSubscribe?: boolean` - Auto-subscribe on connect (default: true)
- `autoSubscribeTopics?: SubscriptionTopic[]` - Topics to auto-subscribe (default: ['devices', 'nc', 'ac', 'in_call'])

**Note:** The SDK automatically connects to `127.0.0.1` and tries ports `50190`, `50191`, `50192` in order until it finds an available server.

#### Methods

- `connect(): Promise<void>` - Connect to server
- `disconnect(): void` - Disconnect from server
- `getDevicesState(): Promise<DeviceState>` - Get current device state
- `getNoiseCancellationState(): Promise<NcState>` - Get current NC state
- `getAccentConversionState(): Promise<AcState>` - Get current AC state
- `getInCallState(): Promise<InCallState>` - Get current in-call state
- `subscribe(topics: SubscriptionTopic[]): Promise<void>` - Subscribe to updates
- `unsubscribe(topics: SubscriptionTopic[]): Promise<void>` - Unsubscribe from updates
- `getConnectionStatus(): ConnectionStatus` - Get connection status
- `on(event: SDKEvent, handler: EventHandler): void` - Register event handler
- `off(event: SDKEvent, handler?: EventHandler): void` - Unregister event handler
- `ping(): Promise<void>` - Ping server (test connection)

### Events

- `SDKEvent.DEVICES_CHANGED` - Emitted when device state changes
- `SDKEvent.NOISE_CANCELLATION_CHANGED` - Emitted when NC state changes
- `SDKEvent.ACCENT_CONVERSION_CHANGED` - Emitted when AC state changes
- `SDKEvent.IN_CALL_CHANGED` - Emitted when in-call status changes
- `SDKEvent.CONNECTION_CHANGED` - Emitted when connection state changes
- `SDKEvent.ERROR` - Emitted when an error occurs

### Error Codes

- `ErrorCode.KRISP_NOT_REACHABLE` - Krisp Desktop is not reachable or API is disabled
- `ErrorCode.CONNECTION_REFUSED` - Connection refused
- `ErrorCode.CONNECTION_TIMEOUT` - Connection timeout
- `ErrorCode.INVALID_MESSAGE` - Invalid message received
- `ErrorCode.UNKNOWN_ERROR` - Unknown error

## Quick Start

1. **Install dependencies:**

   ```bash
   npm install
   ```
2. **Start your Krisp Desktop server** (separately) on one of the default ports: `50190`, `50191`, or `50192`
3. **Build and run the example:**

   ```bash
   npm start
   ```

   Or build first, then run:

   ```bash
   npm run build
   node dist/example.js
   ```

## Reconnection Behavior

The SDK automatically handles reconnection with the following features:

- **Automatic Reconnection**: When the connection is lost, the SDK automatically attempts to reconnect with exponential backoff
- **Auto Re-subscribe**: After successful reconnection, the SDK automatically:
  - Re-fetches all initial states (devices, NC, AC, in-call)
  - Re-subscribes to previously subscribed topics (or auto-subscribe topics if none were subscribed)
- **State Preservation**: Your event handlers remain active and will continue to receive updates after reconnection

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Build and run example
npm start
```

## License

ISC
