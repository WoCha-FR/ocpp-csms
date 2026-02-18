import { WebSocket, WebSocketServer } from 'ws';
import type { OCPPMessage, ChargingStation, CSMSConfig } from './types.js';

export class OCPPCSMS {
  private wss: WebSocketServer;
  private stations: Map<string, ChargingStation> = new Map();
  private wsToStationId: WeakMap<WebSocket, string> = new WeakMap();
  private config: CSMSConfig;

  constructor(config: Partial<CSMSConfig> = {}) {
    this.config = {
      port: config.port ?? 9000,
      host: config.host ?? '0.0.0.0',
      heartbeatInterval: config.heartbeatInterval ?? 60000,
      maxConnections: config.maxConnections ?? 1000,
    };

    this.wss = new WebSocketServer({
      host: this.config.host,
      port: this.config.port,
      perMessageDeflate: {
        zlibDeflateOptions: {
          chunkSize: 1024,
          memLevel: 7,
          level: 3,
        },
        zlibInflateOptions: {
          chunkSize: 10 * 1024,
        },
        threshold: 1024,
      },
      maxPayload: 100 * 1024 * 1024,
    });

    this.setupServer();
  }

  private setupServer(): void {
    this.wss.on('connection', (ws: WebSocket, req) => {
      const stationId = this.extractStationId(req.url);

      if (!stationId) {
        ws.close(1003, 'Invalid station ID');
        return;
      }

      if (this.stations.size >= this.config.maxConnections) {
        ws.close(1008, 'Maximum connections reached');
        return;
      }

      this.handleConnection(ws, stationId);
    });

    this.wss.on('error', (error) => {
      console.error('WebSocket server error:', error);
    });
  }

  private extractStationId(url: string | undefined): string | null {
    if (!url) return null;
    const match = url.match(/\/([^/]+)$/);
    return match ? match[1] : null;
  }

  private handleConnection(ws: WebSocket, stationId: string): void {
    console.log(`Station ${stationId} connected`);

    this.stations.set(stationId, {
      id: stationId,
      connected: true,
      lastSeen: new Date(),
      protocol: 'OCPP1.6',
    });

    this.wsToStationId.set(ws, stationId);

    ws.on('message', async (data: Buffer) => {
      try {
        await this.handleMessage(ws, stationId, data);
      } catch (error) {
        console.error(`Error handling message from ${stationId}:`, error);
        this.sendError(ws, 'InternalError', 'Failed to process message');
      }
    });

    ws.on('close', () => {
      console.log(`Station ${stationId} disconnected`);
      const station = this.stations.get(stationId);
      if (station) {
        station.connected = false;
      }
    });

    ws.on('error', (error) => {
      console.error(`WebSocket error for ${stationId}:`, error);
    });

    ws.on('pong', () => {
      const station = this.stations.get(stationId);
      if (station) {
        station.lastSeen = new Date();
      }
    });

    this.sendBootNotificationResponse(ws, stationId);
  }

  private async handleMessage(
    ws: WebSocket,
    stationId: string,
    data: Buffer
  ): Promise<void> {
    let message: OCPPMessage;

    try {
      const parsed = JSON.parse(data.toString());

      if (!Array.isArray(parsed) || parsed.length < 3) {
        throw new Error('Invalid OCPP message format');
      }

      message = {
        messageTypeId: parsed[0],
        messageId: parsed[1],
        action: parsed[2],
        payload: parsed[3] || {},
      };
    } catch (error) {
      this.sendError(ws, 'FormatError', 'Invalid JSON format');
      return;
    }

    const station = this.stations.get(stationId);
    if (station) {
      station.lastSeen = new Date();
    }

    switch (message.messageTypeId) {
      case 2:
        await this.handleCall(ws, stationId, message);
        break;
      case 3:
        this.handleCallResult(stationId, message);
        break;
      case 4:
        this.handleCallError(stationId, message);
        break;
      default:
        this.sendError(ws, 'MessageTypeNotSupported', 'Unknown message type');
    }
  }

  private async handleCall(
    ws: WebSocket,
    stationId: string,
    message: OCPPMessage
  ): Promise<void> {
    const action = message.action;

    switch (action) {
      case 'BootNotification':
        this.sendCallResult(ws, message.messageId, {
          status: 'Accepted',
          currentTime: new Date().toISOString(),
          interval: this.config.heartbeatInterval / 1000,
        });
        break;

      case 'Heartbeat':
        this.sendCallResult(ws, message.messageId, {
          currentTime: new Date().toISOString(),
        });
        break;

      case 'StatusNotification':
        this.sendCallResult(ws, message.messageId, {});
        break;

      case 'Authorize':
        this.sendCallResult(ws, message.messageId, {
          idTagInfo: {
            status: 'Accepted',
          },
        });
        break;

      case 'StartTransaction':
        this.sendCallResult(ws, message.messageId, {
          idTagInfo: {
            status: 'Accepted',
          },
          transactionId: Math.floor(Math.random() * 1000000),
        });
        break;

      case 'StopTransaction':
        this.sendCallResult(ws, message.messageId, {
          idTagInfo: {
            status: 'Accepted',
          },
        });
        break;

      case 'MeterValues':
        this.sendCallResult(ws, message.messageId, {});
        break;

      default:
        this.sendError(ws, 'NotSupported', `Action ${action} not supported`);
    }
  }

  private handleCallResult(stationId: string, message: OCPPMessage): void {
    console.log(`Received CallResult from ${stationId}:`, message.messageId);
  }

  private handleCallError(stationId: string, message: OCPPMessage): void {
    console.error(`Received CallError from ${stationId}:`, message);
  }

  private sendCallResult(
    ws: WebSocket,
    messageId: string,
    payload: unknown
  ): void {
    const response = [3, messageId, payload];
    ws.send(JSON.stringify(response));
  }

  private sendError(
    ws: WebSocket,
    errorCode: string,
    errorDescription: string
  ): void {
    const response = [4, '', errorCode, errorDescription, {}];
    ws.send(JSON.stringify(response));
  }

  private sendBootNotificationResponse(ws: WebSocket, stationId: string): void {
    console.log(`Sending boot notification response to ${stationId}`);
  }

  public getConnectedStations(): ChargingStation[] {
    return Array.from(this.stations.values()).filter((s) => s.connected);
  }

  public getStation(stationId: string): ChargingStation | undefined {
    return this.stations.get(stationId);
  }

  public async close(): Promise<void> {
    return new Promise((resolve) => {
      this.wss.close(() => {
        console.log('CSMS server closed');
        resolve();
      });
    });
  }
}
