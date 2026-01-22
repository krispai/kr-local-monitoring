/**
 * Browser example for Krisp Local Monitoring SDK
 */

import { KrispLocalMonitoringSDK, SDKEvent, ErrorCode, AudioDeviceType } from './index';

// Get DOM elements
const statusEl = document.getElementById('status')!;
const statusTextEl = document.getElementById('status-text')!;
const connectBtn = document.getElementById('connect-btn')!;
const disconnectBtn = document.getElementById('disconnect-btn')!;
const pingBtn = document.getElementById('ping-btn')!;
const clearLogBtn = document.getElementById('clear-log-btn')!;
const logEl = document.getElementById('log')!;
const connectionInfoEl = document.getElementById('connection-info')!;
const deviceInfoEl = document.getElementById('device-info')!;
const ncInfoEl = document.getElementById('nc-info')!;
const inCallInfoEl = document.getElementById('in-call-info')!;

// Create SDK instance
const sdk = new KrispLocalMonitoringSDK({
  autoReconnect: true,
  autoSubscribe: true,
  autoSubscribeTopics: ['devices', 'nc', 'ac', 'in_call'],
});

// Logging helper
function log(message: string, type: 'info' | 'error' | 'success' | 'warn' = 'info') {
  const time = new Date().toLocaleTimeString();
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  
  const timeSpan = document.createElement('span');
  timeSpan.className = 'log-time';
  timeSpan.textContent = `[${time}]`;
  
  const messageSpan = document.createElement('span');
  messageSpan.className = `log-${type}`;
  messageSpan.textContent = message;
  
  entry.appendChild(timeSpan);
  entry.appendChild(messageSpan);
  logEl.appendChild(entry);
  logEl.scrollTop = logEl.scrollHeight;
}

function updateStatus(connected: boolean, connecting: boolean, error?: { code: string; message: string }) {
  statusEl.className = 'status';
  if (connected) {
    statusEl.classList.add('connected');
    statusTextEl.textContent = 'Connected';
  } else if (connecting) {
    statusEl.classList.add('connecting');
    statusTextEl.textContent = 'Connecting...';
  } else {
    statusEl.classList.add('disconnected');
    statusTextEl.textContent = error ? `Error: ${error.message}` : 'Disconnected';
  }

  connectBtn.disabled = connected || connecting;
  disconnectBtn.disabled = !connected && !connecting;
  pingBtn.disabled = !connected;
}

// Set up event handlers
sdk.on(SDKEvent.DEVICES_CHANGED, (deviceState) => {
  const mic = deviceState[AudioDeviceType.microphone].physicalDeviceInfo?.name || 'None';
  const speaker = deviceState[AudioDeviceType.speaker].physicalDeviceInfo?.name || 'None';
  deviceInfoEl.textContent = `Mic: ${mic} | Speaker: ${speaker}`;
  log(`Device state changed - Mic: ${mic}, Speaker: ${speaker}`, 'info');
});

sdk.on(SDKEvent.NOISE_CANCELLATION_CHANGED, (ncState) => {
  const micNC = ncState[AudioDeviceType.microphone].enabled;
  const speakerNC = ncState[AudioDeviceType.speaker].enabled;
  ncInfoEl.textContent = `Mic NC: ${micNC ? 'ON' : 'OFF'} | Speaker NC: ${speakerNC ? 'ON' : 'OFF'}`;
  log(`Noise Cancellation changed - Mic: ${micNC}, Speaker: ${speakerNC}`, 'info');
});

sdk.on(SDKEvent.ACCENT_CONVERSION_CHANGED, (acState) => {
  const micAC = acState[AudioDeviceType.microphone].enabled;
  const speakerAC = acState[AudioDeviceType.speaker].enabled;
  log(`Accent Conversion changed - Mic: ${micAC}, Speaker: ${speakerAC}`, 'info');
});

sdk.on(SDKEvent.IN_CALL_CHANGED, (inCallState) => {
  inCallInfoEl.textContent = inCallState.inCall ? 'In Call' : 'Not in Call';
  log(`In-call state changed: ${inCallState.inCall}`, 'info');
});

sdk.on(SDKEvent.CONNECTION_CHANGED, (connectionState) => {
  updateStatus(connectionState.connected, connectionState.connecting, connectionState.error);
  
  if (connectionState.connected) {
    connectionInfoEl.textContent = `Connected on port ${sdk.getConnectionStatus().port}`;
    log('Connection established', 'success');
  } else if (connectionState.connecting) {
    connectionInfoEl.textContent = 'Connecting...';
    log('Connecting...', 'warn');
  } else {
    connectionInfoEl.textContent = 'Disconnected';
    if (connectionState.error) {
      log(`Connection error: ${connectionState.error.message}`, 'error');
    } else {
      log('Disconnected', 'warn');
    }
  }
});

sdk.on(SDKEvent.ERROR, (error) => {
  log(`SDK error: ${error.message || error}`, 'error');
});

// Button handlers
connectBtn.addEventListener('click', async () => {
  try {
    log('Connecting to Krisp Desktop...', 'info');
    await sdk.connect();
    
    // Fetch initial states
    try {
      const deviceState = await sdk.getDevicesState();
      const mic = deviceState[AudioDeviceType.microphone].physicalDeviceInfo?.name || 'None';
      const speaker = deviceState[AudioDeviceType.speaker].physicalDeviceInfo?.name || 'None';
      deviceInfoEl.textContent = `Mic: ${mic} | Speaker: ${speaker}`;
      
      const ncState = await sdk.getNoiseCancellationState();
      const micNC = ncState[AudioDeviceType.microphone].enabled;
      const speakerNC = ncState[AudioDeviceType.speaker].enabled;
      ncInfoEl.textContent = `Mic NC: ${micNC ? 'ON' : 'OFF'} | Speaker NC: ${speakerNC ? 'ON' : 'OFF'}`;
      
      const inCallState = await sdk.getInCallState();
      inCallInfoEl.textContent = inCallState.inCall ? 'In Call' : 'Not in Call';
      
      log('Initial states fetched successfully', 'success');
    } catch (error: any) {
      log(`Failed to fetch initial states: ${error.message}`, 'warn');
    }
  } catch (error: any) {
    if (error.code === ErrorCode.KRISP_NOT_REACHABLE) {
      log('Krisp Desktop is not reachable or API is disabled', 'error');
    } else if (error.code === ErrorCode.CONNECTION_REFUSED) {
      log(`Connection refused: ${error.message}`, 'error');
    } else if (error.code === ErrorCode.CONNECTION_TIMEOUT) {
      log('Connection timeout', 'error');
    } else {
      log(`Connection error: ${error.message || error}`, 'error');
    }
  }
});

disconnectBtn.addEventListener('click', () => {
  sdk.disconnect();
  log('Disconnected', 'warn');
  deviceInfoEl.textContent = 'No device information';
  ncInfoEl.textContent = 'No NC information';
  inCallInfoEl.textContent = 'Not in call';
  connectionInfoEl.textContent = 'Not connected';
});

pingBtn.addEventListener('click', async () => {
  try {
    log('Sending ping...', 'info');
    await sdk.ping();
    log('Ping successful!', 'success');
  } catch (error: any) {
    log(`Ping failed: ${error.message}`, 'error');
  }
});

clearLogBtn.addEventListener('click', () => {
  logEl.innerHTML = '';
  log('Log cleared', 'info');
});

// Initial log
log('SDK initialized. Click "Connect" to start.', 'info');

