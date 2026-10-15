/**
 * @fileoverview Utilitários matemáticos para processamento de áudio digital.
 * Fornece cálculos de RMS, conversão de amplitude para decibéis (dBFS),
 * valores de pico e detecção de saturação (clipping).
 */

/**
 * Calcula o valor eficaz (RMS - Root Mean Square) de um buffer de amostras de áudio.
 *
 * @param samples - Buffer de amostras de ponto flutuante normalizadas entre -1.0 e 1.0.
 * @returns O valor RMS linear (entre 0.0 e 1.0).
 */
export function calculateRms(samples: Float32Array): number {
  if (samples.length === 0) return 0;

  let sumSquares = 0;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    sumSquares += s * s;
  }

  return Math.sqrt(sumSquares / samples.length);
}

/**
 * Encontra a amplitude de pico absoluta em um buffer de áudio.
 *
 * @param samples - Buffer de amostras de áudio.
 * @returns O maior valor absoluto encontrado no buffer.
 */
export function calculatePeak(samples: Float32Array): number {
  let max = 0;
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i]);
    if (abs > max) {
      max = abs;
    }
  }
  return max;
}

/**
 * Converte um valor linear de amplitude (0.0 a 1.0+) para decibéis em escala completa (dBFS).
 *
 * @param linear - Amplitude linear.
 * @param minDb - Limite inferior para silêncio (padrão: -60 dBFS).
 * @returns Valor em dBFS clamped no intervalo [minDb, +6 dBFS].
 */
export function linearToDb(linear: number, minDb = -60): number {
  if (linear <= 0.00001) {
    return minDb;
  }
  const db = 20 * Math.log10(linear);
  return Math.max(minDb, db);
}

/**
 * Determina se o sinal de áudio sofreu clipping digital.
 *
 * @param peakValue - Amplitude máxima de pico.
 * @param threshold - Limiar para saturação (padrão: 0.99, equivalente a ~ -0.1 dBFS).
 * @returns Verdadeiro caso o pico atinja ou supere o limiar de saturação.
 */
export function isClipping(peakValue: number, threshold = 0.99): boolean {
  return peakValue >= threshold;
}

/**
 * Formata um valor em decibéis para exibição amigável.
 *
 * @param db - Valor em decibéis (dBFS).
 * @param minDb - Limite considerado silêncio total.
 * @returns String formatada (ex: "-12.5 dBFS" ou "-inf dBFS").
 */
export function formatDb(db: number, minDb = -60): string {
  if (db <= minDb) {
    return "-∞ dBFS";
  }
  return `${db.toFixed(1)} dBFS`;
}
