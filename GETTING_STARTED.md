# Getting Started

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Krisp Desktop app running with the WebSocket API enabled

## Installation

1. Install dependencies:

```bash
npm install
```

## Building the Project

Build the TypeScript code to JavaScript:

```bash
npm run build
```

This will automatically clean the `dist/` directory and compile the TypeScript files in `src/` to JavaScript in `dist/`.

## Running the Example

Build and run the example:

```bash
npm start
```

This will automatically clean the `dist/` directory, build the TypeScript files, and run the compiled example.

Alternatively, you can build and run separately:

```bash
npm run build
node dist/example.js
```

## Development Workflow

### Testing with Your Server

1. Start your Krisp Desktop server (separately) on one of the default ports: `50190`, `50191`, or `50192`
2. Build and run the example:
   ```bash
   npm start
   ```

The SDK will automatically:

- Connect to `127.0.0.1` and try ports 50190, 50191, 50192 in order
- Connect to the first available port
- Fetch initial device and feature states
- Subscribe to real-time updates
- Display all state changes in the console

## Customizing the Example

You can modify `src/example.ts` to:

- Change the connection options (autoReconnect, maxReconnectAttempts, etc.)
- Add custom event handlers
- Test specific features

After making changes, rebuild and run:

```bash
npm start
```

## Project Structure

```
krisp-local-monitoring/
├── src/
│   ├── index.ts           # Main SDK class
│   ├── connection-manager.ts  # WebSocket connection handling
│   ├── state-manager.ts   # State caching and events
│   ├── types/             # TypeScript type definitions
│   ├── events.ts          # Event types
│   ├── errors.ts          # Error codes and classes
│   └── example.ts         # Example usage
├── dist/                  # Compiled JavaScript (generated)
├── package.json
└── tsconfig.json
```

## Troubleshooting

### "Krisp Desktop is not running or API is disabled"

- Make sure Krisp Desktop is running
- Verify the WebSocket API is enabled in Krisp Desktop
- Check that the server is listening on one of the expected ports

### "Connection refused"

- Verify the server is running
- Check if the port is correct
- Ensure no firewall is blocking the connection

### TypeScript compilation errors

- Run `npm install` to ensure all dependencies are installed
- Check that your TypeScript version matches the project requirements
