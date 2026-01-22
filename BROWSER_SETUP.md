# Browser Setup Guide

This guide explains how to test and build the Krisp Local Monitoring SDK for browser usage.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the development server:**
   ```bash
   npm run dev
   ```
   
   This will start Vite dev server at `http://localhost:3000` and automatically open your browser.

## Building for Production

### Build for Node.js (CommonJS):
```bash
npm run build
```

### Build for Browser (ESM + UMD):
```bash
npm run build:browser
```

### Build both:
```bash
npm run build:all
```

The browser build will create:
- `dist/krisp-local-monitoring.es.js` - ES Module format
- `dist/krisp-local-monitoring.umd.js` - UMD format (for direct script tag usage)

## Using in Browser Applications

### Option 1: ES Modules (Recommended)

```html
<script type="module">
  import { KrispLocalMonitoringSDK } from './node_modules/krisp-local-monitoring/dist/krisp-local-monitoring.es.js';
  
  const sdk = new KrispLocalMonitoringSDK();
  // ... use SDK
</script>
```

### Option 2: UMD (Script Tag)

```html
<script src="https://cdn.jsdelivr.net/npm/socket.io-client@4/dist/socket.io.min.js"></script>
<script src="./node_modules/krisp-local-monitoring/dist/krisp-local-monitoring.umd.js"></script>
<script>
  const sdk = new KrispLocalMonitoringSDK.KrispLocalMonitoringSDK();
  // ... use SDK
</script>
```

### Option 3: Bundler (Webpack, Vite, etc.)

```javascript
import { KrispLocalMonitoringSDK } from 'krisp-local-monitoring';

const sdk = new KrispLocalMonitoringSDK();
// ... use SDK
```

## Testing

The `index.html` file provides a complete browser-based test interface. When you run `npm run dev`, you can:

1. Click "Connect" to connect to Krisp Desktop
2. View real-time connection status
3. See device states, noise cancellation status, and in-call status
4. Test ping functionality
5. View event logs

## Package.json Fields

The package.json includes:
- `main`: Node.js entry point (`dist/index.js`)
- `browser`: Browser entry point (`dist/krisp-local-monitoring.es.js`)
- `module`: ES Module entry point (same as browser)

This ensures proper resolution when the package is installed via npm.

