import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OBSWebSocket } from 'obs-websocket-js';
import { TtsException } from './exceptions/tts.exception';

@Injectable()
export class ObsService {
  private readonly logger = new Logger(ObsService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Full per-request lifecycle: connect → auth → check scene (if provided)
   * → check/create source → SetInputSettings → TriggerMediaInputAction → disconnect.
   */
  async playAudio(filePath: string, sceneName?: string): Promise<void> {
    const obs = new OBSWebSocket();

    try {
      await this.connect(obs);

      const sourceName = this.config.get<string>('OBS_MEDIA_SOURCE_NAME')!;

      // Check scene exists if provided
      if (sceneName) {
        await this.assertSceneExists(obs, sceneName);
      }

      // Check if source exists; create it if not
      const sourceExists = await this.sourceExists(obs, sourceName);
      if (!sourceExists) {
        await this.createSource(obs, sourceName, sceneName);
      }

      // Update the source's local_file path
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
    } finally {
      await obs.disconnect();
    }
  }

  /**
   * Probe connectivity: connect, get version, disconnect. Returns true if successful.
   */
  async checkConnectivity(): Promise<boolean> {
    const obs = new OBSWebSocket();
    try {
      await this.connect(obs);
      await obs.call('GetVersion');
      return true;
    } catch {
      return false;
    } finally {
      await obs.disconnect();
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async connect(obs: OBSWebSocket): Promise<void> {
    const host = this.config.get<string>('OBS_WS_HOST');
    const port = this.config.get<string>('OBS_WS_PORT');
    const password = this.config.get<string>('OBS_WS_PASSWORD');

    const url = `ws://${host}:${port}`;

    try {
      await obs.connect(url, password || undefined);
    } catch (err) {
      const error = err as { code?: number; message?: string };

      // obs-websocket-js uses close codes; 4009 = AuthenticationFailed
      if (error.code === 4009) {
        this.logger.error(`OBS authentication failed: ${error.message}`);
        throw new TtsException(
          'OBS_AUTH_ERROR',
          `OBS WebSocket authentication failed: ${error.message}`,
          err,
        );
      }

      this.logger.error(`OBS connection failed: ${error.message}`);
      throw new TtsException(
        'OBS_CONNECTION_ERROR',
        `Failed to connect to OBS WebSocket at ${url}: ${error.message}`,
        err,
      );
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
}
