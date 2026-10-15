/**
 * @fileoverview Controlador de interface para a página de diagnóstico de áudio USB.
 * Gerencia a interação do usuário com a seleção de dispositivos, renderização do
 * VU meter com graduação profissional (dBFS), osciloscópio em tempo real e
 * alertas de saturação (clipping).
 */

import { AudioEngine, AudioEngineMetrics } from '../audio/audio_engine';
import { formatDb } from '../audio/audio_math';

class AudioDiagnosticsUI {
  private audioEngine: AudioEngine;
  private animationFrameId: number | null = null;

  // Elementos de UI
  private deviceSelect!: HTMLSelectElement;
  private channelSelect!: HTMLSelectElement;
  private refreshButton!: HTMLButtonElement;
  private connectButton!: HTMLButtonElement;
  private disconnectButton!: HTMLButtonElement;
  private resetClipButton!: HTMLButtonElement;

  private stateBadge!: HTMLElement;
  private sampleRateEl!: HTMLElement;
  private baseLatencyEl!: HTMLElement;
  private outputLatencyEl!: HTMLElement;
  private rmsValueEl!: HTMLElement;
  private peakValueEl!: HTMLElement;
  private clipBadge!: HTMLElement;

  private vuCanvas!: HTMLCanvasElement;
  private vuCtx!: CanvasRenderingContext2D;
  private oscCanvas!: HTMLCanvasElement;
  private oscCtx!: CanvasRenderingContext2D;

  private peakHoldDb = -60;
  private peakHoldTimer = 0;

  constructor() {
    this.audioEngine = new AudioEngine();
    this.initDOMElements();
    this.bindEvents();
    this.populateDevices();
  }

  private initDOMElements(): void {
    this.deviceSelect = document.getElementById('device-select') as HTMLSelectElement;
    this.channelSelect = document.getElementById('channel-select') as HTMLSelectElement;
    this.refreshButton = document.getElementById('refresh-devices-btn') as HTMLButtonElement;
    this.connectButton = document.getElementById('connect-btn') as HTMLButtonElement;
    this.disconnectButton = document.getElementById('disconnect-btn') as HTMLButtonElement;
    this.resetClipButton = document.getElementById('reset-clip-btn') as HTMLButtonElement;

    this.stateBadge = document.getElementById('status-badge') as HTMLElement;
    this.sampleRateEl = document.getElementById('sample-rate-val') as HTMLElement;
    this.baseLatencyEl = document.getElementById('base-latency-val') as HTMLElement;
    this.outputLatencyEl = document.getElementById('output-latency-val') as HTMLElement;
    this.rmsValueEl = document.getElementById('rms-val') as HTMLElement;
    this.peakValueEl = document.getElementById('peak-val') as HTMLElement;
    this.clipBadge = document.getElementById('clip-indicator') as HTMLElement;

    this.vuCanvas = document.getElementById('vu-canvas') as HTMLCanvasElement;
    this.vuCtx = this.vuCanvas.getContext('2d')!;
    this.oscCanvas = document.getElementById('osc-canvas') as HTMLCanvasElement;
    this.oscCtx = this.oscCanvas.getContext('2d')!;
  }

  private bindEvents(): void {
    this.refreshButton?.addEventListener('click', async () => {
      try {
        await this.audioEngine.requestPermissions();
        await this.populateDevices();
      } catch (err) {
        alert('Permissão de acesso ao áudio foi negada ou não está disponível.');
      }
    });

    this.connectButton?.addEventListener('click', async () => {
      const deviceId = this.deviceSelect.value || undefined;
      const channelIndex = parseInt(this.channelSelect.value, 10) || 0;

      try {
        this.connectButton.disabled = true;
        await this.audioEngine.connect(deviceId, channelIndex);
        this.updateConnectionState(true);
        this.startRenderLoop();
      } catch (err) {
        console.error('Erro ao conectar dispositivo de áudio:', err);
        alert(`Não foi possível conectar ao dispositivo: ${(err as Error).message}`);
        this.updateConnectionState(false);
      } finally {
        this.connectButton.disabled = false;
      }
    });

    this.disconnectButton?.addEventListener('click', async () => {
      await this.audioEngine.disconnect();
      this.stopRenderLoop();
      this.updateConnectionState(false);
      this.resetMetricsView();
    });

    this.channelSelect?.addEventListener('change', () => {
      const channelIndex = parseInt(this.channelSelect.value, 10) || 0;
      this.audioEngine.switchChannel(channelIndex);
    });

    this.resetClipButton?.addEventListener('click', () => {
      this.audioEngine.resetClipLatch();
      this.clipBadge.classList.remove('active');
    });
  }

  private async populateDevices(): Promise<void> {
    const devices = await this.audioEngine.listInputDevices();
    const previousSelected = this.deviceSelect.value;
    this.deviceSelect.innerHTML = '';

    if (devices.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'Nenhuma interface encontrada (clique em Atualizar)';
      this.deviceSelect.appendChild(option);
      return;
    }

    devices.forEach((dev) => {
      const option = document.createElement('option');
      option.value = dev.deviceId;
      option.textContent = dev.label;
      if (dev.deviceId === previousSelected) {
        option.selected = true;
      }
      this.deviceSelect.appendChild(option);
    });
  }

  private updateConnectionState(isConnected: boolean): void {
    if (isConnected) {
      this.stateBadge.textContent = 'CONECTADO';
      this.stateBadge.className = 'badge badge-success';
      this.connectButton.classList.add('hidden');
      this.disconnectButton.classList.remove('hidden');
      this.channelSelect.disabled = false;
    } else {
      this.stateBadge.textContent = 'DESCONECTADO';
      this.stateBadge.className = 'badge badge-muted';
      this.connectButton.classList.remove('hidden');
      this.disconnectButton.classList.add('hidden');
    }
  }

  private startRenderLoop(): void {
    const render = () => {
      const metrics = this.audioEngine.getMetrics();
      if (metrics) {
        this.updateTelemetry(metrics);
        this.drawVuMeter(metrics);
        this.drawOscilloscope(metrics.timeDomainData);
      }
      this.animationFrameId = requestAnimationFrame(render);
    };

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.animationFrameId = requestAnimationFrame(render);
  }

  private stopRenderLoop(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private updateTelemetry(metrics: AudioEngineMetrics): void {
    this.sampleRateEl.textContent = `${metrics.sampleRate.toLocaleString('pt-BR')} Hz`;
    this.baseLatencyEl.textContent = `${metrics.baseLatencyMs} ms`;
    this.outputLatencyEl.textContent = `${metrics.outputLatencyMs} ms`;
    this.rmsValueEl.textContent = formatDb(metrics.rmsDb);
    this.peakValueEl.textContent = formatDb(metrics.peakDb);

    if (metrics.isClipping) {
      this.clipBadge.classList.add('active');
    } else {
      this.clipBadge.classList.remove('active');
    }
  }

  private drawVuMeter(metrics: AudioEngineMetrics): void {
    const ctx = this.vuCtx;
    const width = this.vuCanvas.width;
    const height = this.vuCanvas.height;

    ctx.clearRect(0, 0, width, height);

    // Fundo do VU
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, width, height);

    // Mapeia dBFS (-60 a 0) para a largura em pixels
    const minDb = -60;
    const maxDb = 0;
    const rmsNormalized = Math.max(0, Math.min(1, (metrics.rmsDb - minDb) / (maxDb - minDb)));
    const peakNormalized = Math.max(0, Math.min(1, (metrics.peakDb - minDb) / (maxDb - minDb)));

    // Atualiza retenção de pico
    if (metrics.peakDb > this.peakHoldDb) {
      this.peakHoldDb = metrics.peakDb;
      this.peakHoldTimer = 60; // Mantém por ~1 segundo a 60fps
    } else if (this.peakHoldTimer > 0) {
      this.peakHoldTimer--;
    } else {
      this.peakHoldDb = Math.max(minDb, this.peakHoldDb - 0.5);
    }
    const peakHoldNorm = Math.max(0, Math.min(1, (this.peakHoldDb - minDb) / (maxDb - minDb)));

    // Gradiente: Verde -> Amarelo -> Vermelho
    const grad = ctx.createLinearGradient(0, 0, width, 0);
    grad.addColorStop(0, '#10b981');   // Verde (-60 a -12)
    grad.addColorStop(0.8, '#f59e0b'); // Amarelo (-12 a -3)
    grad.addColorStop(1.0, '#ef4444'); // Vermelho (-3 a 0)

    // Barra RMS sólida
    ctx.fillStyle = grad;
    ctx.fillRect(0, 4, width * rmsNormalized, height - 8);

    // Marcador de Pico Instantâneo
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.max(0, width * peakNormalized - 2), 2, 3, height - 4);

    // Marcador de Retenção de Pico (Peak Hold)
    ctx.fillStyle = this.peakHoldDb > -0.5 ? '#ef4444' : '#fbbf24';
    ctx.fillRect(Math.max(0, width * peakHoldNorm - 2), 0, 3, height);
  }

  private drawOscilloscope(data: Float32Array): void {
    const ctx = this.oscCtx;
    const width = this.oscCanvas.width;
    const height = this.oscCanvas.height;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    // Linha de centro (zero volts)
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    // Traçado da forma de onda
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    const sliceWidth = width / data.length;
    let x = 0;

    for (let i = 0; i < data.length; i++) {
      const v = data[i]; // -1.0 a 1.0
      const y = (0.5 - v / 2) * height;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    ctx.stroke();
  }

  private resetMetricsView(): void {
    this.sampleRateEl.textContent = '---';
    this.baseLatencyEl.textContent = '---';
    this.outputLatencyEl.textContent = '---';
    this.rmsValueEl.textContent = '-∞ dBFS';
    this.peakValueEl.textContent = '-∞ dBFS';
    this.clipBadge.classList.remove('active');

    // Limpa os canvas
    this.vuCtx.fillStyle = '#111827';
    this.vuCtx.fillRect(0, 0, this.vuCanvas.width, this.vuCanvas.height);
    this.oscCtx.fillStyle = '#0f172a';
    this.oscCtx.fillRect(0, 0, this.oscCanvas.width, this.oscCanvas.height);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('audio-diagnostics-container')) {
    new AudioDiagnosticsUI();
  }
});
