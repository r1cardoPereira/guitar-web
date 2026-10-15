/**
 * @fileoverview Motor de áudio cliente baseado em Web Audio API.
 * Responsável por gerenciar o ciclo de vida do AudioContext, listar e selecionar
 * interfaces de áudio USB, rotear canais específicos (ex: Entrada 1 ou 2) e
 * calcular métricas em tempo real para diagnóstico (VU Meter, RMS, Peak, Latência).
 */

import { calculateRms, calculatePeak, linearToDb, isClipping } from './audio_math';

export interface AudioEngineMetrics {
  sampleRate: number;
  state: AudioContextState;
  baseLatencyMs: number;
  outputLatencyMs: number;
  rmsDb: number;
  peakDb: number;
  isClipping: boolean;
  timeDomainData: Float32Array;
}

export interface AudioDeviceOption {
  deviceId: string;
  label: string;
}

export class AudioEngine {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private splitterNode: ChannelSplitterNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private channelMergerNode: ChannelMergerNode | null = null;

  private buffer: Float32Array<ArrayBuffer>;
  private clipLatched = false;
  private connectedAt = 0;

  constructor(fftSize = 2048) {
    this.buffer = new Float32Array(new ArrayBuffer(fftSize * 4));
  }

  /**
   * Solicita permissão inicial do microfone para que o navegador popule os rótulos
   * dos dispositivos em enumerateDevices.
   *
   * @returns Promessa resolvida quando a permissão for concedida.
   */
  public async requestPermissions(): Promise<void> {
    const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    tempStream.getTracks().forEach((track) => track.stop());
  }

  /**
   * Lista todos os dispositivos de entrada de áudio (microfones e interfaces USB).
   *
   * @returns Lista de dispositivos contendo id e rótulo amigável.
   */
  public async listInputDevices(): Promise<AudioDeviceOption[]> {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter((d) => d.kind === 'audioinput');

    return audioInputs.map((device, index) => ({
      deviceId: device.deviceId,
      label: device.label || `Interface de Áudio ${index + 1}`
    }));
  }

  /**
   * Conecta a uma interface de áudio e inicia o pipeline de análise.
   *
   * @param deviceId - Identificador único do dispositivo selecionado.
   * @param channelIndex - Índice do canal da interface (0 = Canal 1, 1 = Canal 2).
   */
  public async connect(deviceId?: string, channelIndex = 0): Promise<void> {
    await this.disconnect();

    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.audioContext = new AudioContextClass({ latencyHint: 'interactive' });

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    const constraints: MediaStreamConstraints = {
      audio: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 2
      },
      video: false
    };

    this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
    this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

    const availableChannels = Math.max(1, this.sourceNode.channelCount);
    const selectedChannel = channelIndex >= availableChannels ? 0 : Math.max(0, channelIndex);

    this.splitterNode = this.audioContext.createChannelSplitter(2);
    this.analyserNode = this.audioContext.createAnalyser();
    this.analyserNode.fftSize = this.buffer.length;
    this.analyserNode.smoothingTimeConstant = 0.2;

    this.sourceNode.connect(this.splitterNode);

    // Conecta canal selecionado (ou canal 0 se o dispositivo for mono)
    this.channelMergerNode = this.audioContext.createChannelMerger(1);
    this.splitterNode.connect(this.channelMergerNode, selectedChannel, 0);
    this.channelMergerNode.connect(this.analyserNode);

    this.connectedAt = performance.now();
  }

  /**
   * Troca dinamicamente o canal de entrada sem reiniciar o stream de áudio.
   *
   * @param channelIndex - Novo canal selecionado (0 = Canal 1, 1 = Canal 2).
   */
  public switchChannel(channelIndex: number): void {
    if (!this.splitterNode || !this.channelMergerNode || !this.sourceNode) return;

    this.splitterNode.disconnect();
    const availableChannels = Math.max(1, this.sourceNode.channelCount);
    const selectedChannel = channelIndex >= availableChannels ? 0 : Math.max(0, channelIndex);
    this.splitterNode.connect(this.channelMergerNode, selectedChannel, 0);
  }

  /**
   * Coleta as métricas atuais de diagnóstico do áudio em tempo real.
   *
   * @returns Objeto com RMS, Peak, Clipping e estado de latência do hardware.
   */
  public getMetrics(): AudioEngineMetrics | null {
    if (!this.audioContext || !this.analyserNode) {
      return null;
    }

    this.analyserNode.getFloatTimeDomainData(this.buffer);

    const rmsLinear = calculateRms(this.buffer);
    const peakLinear = calculatePeak(this.buffer);
    const rmsDb = linearToDb(rmsLinear);
    const peakDb = linearToDb(peakLinear);

    const isCurrentClip = isClipping(peakLinear);
    const timeSinceConnect = performance.now() - this.connectedAt;
    if (isCurrentClip && timeSinceConnect > 500) {
      this.clipLatched = true;
    }

    const baseLatency = (this.audioContext.baseLatency || 0) * 1000;
    const outputLatency = (this.audioContext.outputLatency || 0) * 1000;

    return {
      sampleRate: this.audioContext.sampleRate,
      state: this.audioContext.state,
      baseLatencyMs: Number(baseLatency.toFixed(2)),
      outputLatencyMs: Number(outputLatency.toFixed(2)),
      rmsDb,
      peakDb,
      isClipping: this.clipLatched,
      timeDomainData: this.buffer
    };
  }

  /**
   * Reseta a retenção do alerta de clipping digital.
   */
  public resetClipLatch(): void {
    this.clipLatched = false;
  }

  /**
   * Desconecta o stream, encerra o AudioContext e libera o hardware de áudio.
   */
  public async disconnect(): Promise<void> {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.splitterNode) {
      this.splitterNode.disconnect();
      this.splitterNode = null;
    }

    if (this.analyserNode) {
      this.analyserNode.disconnect();
      this.analyserNode = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.close();
      this.audioContext = null;
    }

    this.clipLatched = false;
  }
}
