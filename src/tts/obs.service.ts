import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OBSWebSocket from 'obs-websocket-js';
import { TtsException } from './exceptions/tts.exception';

export enum ObsConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  RECONNECTING = 'RECONNECTING',
}

export interface ObsConfig {
  host: string;
  port: string;
  password?: string;
}

@Injectable()
export class ObsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ObsService.name);
  private obs: OBSWebSocket | null = null;
  private connectionState: ObsConnectionState = ObsConnectionState.DISCONNECTED;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private readonly initialReconnectDelay = 1000;
  private readonly maxReconnectDelay = 30000;
  private readonly heartbeatIntervalMs = 15000;
  private eventListeners: Map<string, Set<(data: any) => void>> = new Map();

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }

  getConnectionState(): ObsConnectionState {
    return this.connectionState;
  }

  on(event: string, callback: (data: any) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  off(event: string, callback: (data: any) => void): void {
    this.eventListeners.get(event)?.delete(callback);
  }

  private emit(event: string, data: any): void {
    this.eventListeners.get(event)?.forEach((callback) => callback(data));
  }

  async connect(): Promise<void> {
    if (this.connectionState === ObsConnectionState.CONNECTED) {
      return;
    }

    if (this.connectionState === ObsConnectionState.RECONNECTING) {
      return;
    }

    this.connectionState = ObsConnectionState.CONNECTING;
    this.emit('stateChanged', this.connectionState);
    this.logger.log('Initializing OBS WebSocket connection...');

    const config = this.getObsConfig();
    this.obs = new OBSWebSocket();

    this.setupEventHandlers();

    try {
      await this.obs.connect(
        `ws://${config.host}:${config.port}`,
        config.password || undefined,
      );

      this.connectionState = ObsConnectionState.CONNECTED;
      this.reconnectAttempts = 0;
      this.emit('stateChanged', this.connectionState);
      this.logger.log('OBS WebSocket connected successfully');

      this.startHeartbeat();
    } catch (err) {
      const error = err as { code?: number; message?: string };
      this.logger.error(`OBS connection failed: ${error.message}`);
      this.connectionState = ObsConnectionState.DISCONNECTED;
      this.emit('stateChanged', this.connectionState);

      if (error.code === 4009) {
        throw new TtsException(
          'OBS_AUTH_ERROR',
          `OBS WebSocket authentication failed: ${error.message}`,
          err,
        );
      }

      this.scheduleReconnect();
    }
  }

  private setupEventHandlers(): void {
    if (!this.obs) return;

    this.obs.on('ConnectionClosed', (event: { message: string }) => {
      this.logger.warn(`OBS connection closed: ${event.message}`);
      this.handleDisconnect();
    });

    this.obs.on('Identified', () => {
      this.logger.debug('OBS identified successfully');
      this.reconnectAttempts = 0;
    });

    this.obs.on('ConnectionError', (event: { message: string }) => {
      this.logger.error(`OBS WebSocket error: ${event.message}`);
    });
  }

  private handleDisconnect(): void {
    this.stopHeartbeat();
    this.connectionState = ObsConnectionState.DISCONNECTED;
    this.emit('stateChanged', this.connectionState);
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error(
        `Max reconnect attempts (${this.maxReconnectAttempts}) reached. Giving up.`,
      );
      return;
    }

    this.connectionState = ObsConnectionState.RECONNECTING;
    this.emit('stateChanged', this.connectionState);

    const delay = Math.min(
      this.initialReconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay,
    );

    this.reconnectAttempts++;
    this.logger.log(
      `Scheduling OBS reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`,
    );

    setTimeout(() => {
      this.connect().catch((err: Error) => {
        this.logger.error(`Reconnect failed: ${err.message}`);
      });
    }, delay);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.heartbeatInterval = setInterval(() => {
      void (async () => {
        try {
          if (
            this.obs &&
            this.connectionState === ObsConnectionState.CONNECTED
          ) {
            await this.obs.call('GetVersion');
            this.logger.debug('OBS heartbeat: OK');
          }
        } catch {
          this.logger.warn('OBS heartbeat failed, triggering reconnect');
          this.handleDisconnect();
        }
      })();
    }, this.heartbeatIntervalMs);

    this.logger.debug(
      `OBS heartbeat started (interval: ${this.heartbeatIntervalMs}ms)`,
    );
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      this.logger.debug('OBS heartbeat stopped');
    }
  }

  async disconnect(): Promise<void> {
    this.stopHeartbeat();

    if (this.obs) {
      try {
        await this.obs.disconnect();
      } catch (err) {
        this.logger.warn(`Error disconnecting OBS: ${(err as Error).message}`);
      }
      this.obs = null;
    }

    this.connectionState = ObsConnectionState.DISCONNECTED;
    this.emit('stateChanged', this.connectionState);
    this.logger.log('OBS WebSocket disconnected');
  }

  private async ensureConnected(): Promise<OBSWebSocket> {
    if (!this.obs || this.connectionState !== ObsConnectionState.CONNECTED) {
      await this.connect();
    }

    if (!this.obs) {
      throw new TtsException(
        'OBS_NOT_CONNECTED',
        'OBS WebSocket is not connected',
      );
    }

    return this.obs;
  }

  /**
   * Full per-request lifecycle: connect → auth → check scene (if provided)
   * → check/create source → SetInputSettings → TriggerMediaInputAction → disconnect.
   */
  async playAudio(filePath: string, sceneName?: string): Promise<void> {
    const obs = await this.ensureConnected();

    const sourceName = this.config.get<string>('OBS_MEDIA_SOURCE_NAME')!;

    if (sceneName) {
      await this.assertSceneExists(obs, sceneName);
    }

    const sourceExists = await this.sourceExists(obs, sourceName);
    if (!sourceExists) {
      await this.createSource(obs, sourceName, sceneName);
    }

    try {
      await obs.call('SetInputSettings', {
        inputName: sourceName,
        inputSettings: { local_file: filePath },
      });
    } catch (err) {
      throw new TtsException(
        'OBS_COMMAND_ERROR',
        `Failed to set input settings: ${(err as Error).message}`,
        err,
      );
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  async checkConnectivity(): Promise<boolean> {
    try {
      await this.connect();
      if (this.obs && this.connectionState === ObsConnectionState.CONNECTED) {
        await this.obs.call('GetVersion');
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  private async assertSceneExists(
    obs: OBSWebSocket,
    sceneName: string,
  ): Promise<void> {
    try {
      const { scenes } = await obs.call('GetSceneList');
      const exists = (scenes as Array<{ sceneName: string }>).some(
        (s) => s.sceneName === sceneName,
      );
      if (!exists) {
        throw new TtsException(
          'OBS_SCENE_NOT_FOUND',
          `OBS scene "${sceneName}" does not exist`,
        );
      }
    } catch (err) {
      if (err instanceof TtsException) {
        throw err;
      }
      throw new TtsException(
        'OBS_COMMAND_ERROR',
        `Failed to get scene list: ${(err as Error).message}`,
        err,
      );
    }
  }

  private async sourceExists(
    obs: OBSWebSocket,
    sourceName: string,
  ): Promise<boolean> {
    try {
      const { inputs } = await obs.call('GetInputList');
      return (inputs as Array<{ inputName: string }>).some(
        (i) => i.inputName === sourceName,
      );
    } catch (err) {
      throw new TtsException(
        'OBS_COMMAND_ERROR',
        `Failed to get input list: ${(err as Error).message}`,
        err,
      );
    }
  }

  private async createSource(
    obs: OBSWebSocket,
    sourceName: string,
    sceneName?: string,
  ): Promise<void> {
    try {
      await obs.call('CreateInput', {
        inputName: sourceName,
        inputKind: 'ffmpeg_source',
        inputSettings: {},
        ...(sceneName ? { sceneName } : {}),
      });
    } catch (err) {
      throw new TtsException(
        'OBS_COMMAND_ERROR',
        `Failed to create OBS input "${sourceName}": ${(err as Error).message}`,
        err,
      );
    }
  }

  private getObsConfig(): ObsConfig {
    return {
      host: this.config.get<string>('OBS_WS_HOST') ?? 'localhost',
      port: this.config.get<string>('OBS_WS_PORT') ?? '4455',
      password: this.config.get<string>('OBS_WS_PASSWORD'),
    };
  }

  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }
}
