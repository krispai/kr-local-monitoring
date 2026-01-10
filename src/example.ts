/**
 * Example usage of the Krisp Local Monitoring SDK
 */

import { KrispLocalMonitoringSDK, SDKEvent, ErrorCode, AudioDeviceType } from './index';

async function main() {
  // Create SDK instance
  const sdk = new KrispLocalMonitoringSDK({
    // Optional: auto-reconnect (default: true)
    autoReconnect: true,
    // Optional: max reconnect attempts (default: unlimited)
    // maxReconnectAttempts: 10,
    // Optional: auto-subscribe on connect (default: true)
    autoSubscribe: true,
    // Optional: topics to auto-subscribe (default: ['devices', 'nc', 'ac', 'in_call'])
    autoSubscribeTopics: ['devices', 'nc', 'ac', 'in_call'],
  });

  // Set up event handlers before connecting
  sdk.on(SDKEvent.DEVICES_CHANGED, (deviceState) => {
    console.log('Device state changed:');
    console.log('  Microphone:', deviceState[AudioDeviceType.microphone].physicalDeviceInfo?.name || 'None');
    console.log('  Speaker:', deviceState[AudioDeviceType.speaker].physicalDeviceInfo?.name || 'None');
  });

  sdk.on(SDKEvent.NOISE_CANCELLATION_CHANGED, (ncState) => {
    console.log('Noise Cancellation state changed:');
    console.log('  Microphone NC:', ncState[AudioDeviceType.microphone].enabled);
    console.log('  Speaker NC:', ncState[AudioDeviceType.speaker].enabled);
  });

  sdk.on(SDKEvent.ACCENT_CONVERSION_CHANGED, (acState) => {
    console.log('Accent Conversion state changed:');
    console.log('  Microphone AC:', acState[AudioDeviceType.microphone].enabled);
    console.log('  Speaker AC:', acState[AudioDeviceType.speaker].enabled);
  });

  sdk.on(SDKEvent.IN_CALL_CHANGED, (inCallState) => {
    console.log('In-call state changed:');
    console.log('  In call:', inCallState.inCall);
  });

  sdk.on(SDKEvent.CONNECTION_CHANGED, (connectionState) => {
    console.log('Connection state changed:');
    console.log('  Connected:', connectionState.connected);
    console.log('  Connecting:', connectionState.connecting);
    if (connectionState.error) {
      console.error('  Error:', connectionState.error.code, connectionState.error.message);
    }
  });

  sdk.on(SDKEvent.ERROR, (error) => {
    console.error('SDK error:', error);
  });

  try {
    // Connect to server
    console.log('Connecting to Krisp Desktop...');
    await sdk.connect();
    console.log('Connected!');

    // Get initial states
    console.log('\n=== Initial States ===');
    const deviceState = await sdk.getDevicesState();
    console.log('Device State:');
    console.log('  Microphone:', deviceState[AudioDeviceType.microphone].physicalDeviceInfo?.name || 'None');
    console.log('  Speaker:', deviceState[AudioDeviceType.speaker].physicalDeviceInfo?.name || 'None');

    const ncState = await sdk.getNoiseCancellationState();
    console.log('Noise Cancellation:');
    console.log('  Microphone NC:', ncState[AudioDeviceType.microphone].enabled);
    console.log('  Speaker NC:', ncState[AudioDeviceType.speaker].enabled);

    const acState = await sdk.getAccentConversionState();
    console.log('Accent Conversion:');
    console.log('  Microphone AC:', acState[AudioDeviceType.microphone].enabled);
    console.log('  Speaker AC:', acState[AudioDeviceType.speaker].enabled);

    const inCallState = await sdk.getInCallState();
    console.log('In Call:', inCallState.inCall);

    // Get connection status
    const status = sdk.getConnectionStatus();
    console.log('\n=== Connection Status ===');
    console.log('Port:', status.port);
    console.log('Connected:', status.connected);

    // Test ping
    console.log('\nTesting ping...');
    await sdk.ping();
    console.log('Ping successful!');

    // Keep the connection alive for a while to see updates
    console.log('\nListening for updates (press Ctrl+C to exit)...');
    await new Promise((resolve) => {
      // Keep running until interrupted
      process.on('SIGINT', () => {
        console.log('\nDisconnecting...');
        sdk.disconnect();
        resolve(undefined);
      });
    });
  } catch (error: any) {
    if (error.code === ErrorCode.KRISP_NOT_REACHABLE) {
      console.error('Krisp Desktop is not reachable or API is disabled');
    } else if (error.code === ErrorCode.CONNECTION_REFUSED) {
      console.error('Connection refused:', error.message);
    } else if (error.code === ErrorCode.CONNECTION_TIMEOUT) {
      console.error('Connection timeout');
    } else {
      console.error('Error:', error);
    }
    process.exit(1);
  }
}

// Run the example
if (require.main === module) {
  main().catch(console.error);
}


