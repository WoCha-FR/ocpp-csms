# OCPP CSMS (Charging Station Management System)

A high-performance, optimized Node.js implementation of an OCPP (Open Charge Point Protocol) Central System Management System.

## Features

- **High Performance**: Optimized WebSocket server with efficient message handling
- **TypeScript**: Full type safety and better developer experience
- **Scalable**: Supports up to 1000 concurrent connections by default (configurable)
- **Memory Efficient**: Uses WeakMap for WebSocket-to-Station mapping to prevent memory leaks
- **Compression**: Built-in message compression with optimized zlib settings
- **OCPP 1.6**: Implements core OCPP 1.6 messages (BootNotification, Heartbeat, StatusNotification, Authorize, StartTransaction, StopTransaction, MeterValues)

## Performance Optimizations

1. **Efficient Data Structures**
   - `Map` for O(1) station lookups
   - `WeakMap` for automatic cleanup of WebSocket references
   - Pre-allocated buffer sizes for compression

2. **Memory Management**
   - WeakMap prevents memory leaks from closed connections
   - Configurable max payload size
   - Efficient JSON parsing without intermediate copies

3. **Network Optimization**
   - WebSocket compression with tuned parameters
   - Small compression level (3) for balance between CPU and bandwidth
   - Threshold-based compression (only compress messages > 1KB)

4. **Async/Await Pattern**
   - Non-blocking message handling
   - Proper error boundaries
   - Graceful connection handling

5. **Connection Management**
   - Max connection limits to prevent resource exhaustion
   - Automatic cleanup of disconnected stations
   - Efficient station ID extraction

## Installation

```bash
npm install
```

## Build

```bash
npm run build
```

## Usage

### Development mode with auto-reload:
```bash
npm run dev
```

### Production mode:
```bash
npm start
```

## Configuration

Configure the server using environment variables:

- `PORT`: Server port (default: 9000)
- `HOST`: Server host (default: 0.0.0.0)
- `HEARTBEAT_INTERVAL`: Heartbeat interval in milliseconds (default: 60000)
- `MAX_CONNECTIONS`: Maximum concurrent connections (default: 1000)

Example:
```bash
PORT=8080 HOST=localhost MAX_CONNECTIONS=500 npm start
```

## OCPP Connection

Charging stations should connect to:
```
ws://your-server:9000/{station-id}
```

Example:
```
ws://localhost:9000/STATION001
```

## Supported OCPP Messages

- BootNotification
- Heartbeat
- StatusNotification
- Authorize
- StartTransaction
- StopTransaction
- MeterValues

## Project Structure

```
src/
  ├── index.ts       # Entry point and server configuration
  ├── csms.ts        # Core OCPP CSMS implementation
  └── types.ts       # TypeScript type definitions
```

## License

MIT
