import { describe, it, expect } from 'vitest';
import {
  calculateRms,
  calculatePeak,
  linearToDb,
  isClipping,
  formatDb
} from '../../app/frontend/audio/audio_math';

describe('audio_math', () => {
  describe('calculateRms', () => {
    it('retorna 0 para buffer vazio', () => {
      expect(calculateRms(new Float32Array([]))).toBe(0);
    });

    it('calcula RMS correto para onda quadrada de amplitude 1.0', () => {
      const buffer = new Float32Array([1.0, -1.0, 1.0, -1.0]);
      expect(calculateRms(buffer)).toBeCloseTo(1.0, 4);
    });

    it('calcula RMS correto para onda senoidal pura (amplitude / sqrt(2))', () => {
      // 100 amostras de uma senoide com amplitude 0.8
      const n = 1000;
      const buffer = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        buffer[i] = 0.8 * Math.sin((2 * Math.PI * i) / 50);
      }
      const expectedRms = 0.8 / Math.SQRT2;
      expect(calculateRms(buffer)).toBeCloseTo(expectedRms, 2);
    });
  });

  describe('calculatePeak', () => {
    it('encontra o valor de pico positivo e negativo', () => {
      const buffer = new Float32Array([0.1, -0.75, 0.4, -0.2]);
      expect(calculatePeak(buffer)).toBe(0.75);
    });
  });

  describe('linearToDb', () => {
    it('converte amplitude 1.0 para 0 dBFS', () => {
      expect(linearToDb(1.0)).toBeCloseTo(0, 4);
    });

    it('converte amplitude 0.5 para aproximadamente -6.02 dBFS', () => {
      expect(linearToDb(0.5)).toBeCloseTo(-6.02, 1);
    });

    it('limita silêncio absoluto ao minDb configurado', () => {
      expect(linearToDb(0, -60)).toBe(-60);
      expect(linearToDb(0, -90)).toBe(-90);
    });
  });

  describe('isClipping', () => {
    it('retorna true quando o pico atinge ou supera o threshold', () => {
      expect(isClipping(0.99)).toBe(true);
      expect(isClipping(1.05)).toBe(true);
    });

    it('retorna false quando o pico está abaixo do threshold', () => {
      expect(isClipping(0.95)).toBe(false);
      expect(isClipping(0.1)).toBe(false);
    });
  });

  describe('formatDb', () => {
    it('formata valores normais com 1 casa decimal', () => {
      expect(formatDb(-12.4)).toBe('-12.4 dBFS');
    });

    it('formata silêncio como -inf', () => {
      expect(formatDb(-65, -60)).toBe('-∞ dBFS');
    });
  });
});
