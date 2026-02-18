export interface OCPPMessage {
  messageTypeId: number;
  messageId: string;
  action?: string;
  payload: unknown;
}

export interface ChargingStation {
  id: string;
  connected: boolean;
  lastSeen: Date;
  protocol: string;
}

export interface CSMSConfig {
  port: number;
  host: string;
  heartbeatInterval: number;
  maxConnections: number;
}
