export const CUE_DURATIONS = {
  thud: .42, grind: .38, arrow: .19, cannon: .9, shatter: .65,
  crown: 1.25, tick: .16, victory: 2.5, defeat: 1.8,
} as const
export type SoundCue = keyof typeof CUE_DURATIONS
export const SAMPLE_RATE = 22050

/** Deterministic, original PCM sounds. No downloads, codecs, or audio assets. */
export function synthesize(cue: SoundCue): Float32Array {
  const duration = CUE_DURATIONS[cue]
  const samples = new Float32Array(Math.ceil(duration * SAMPLE_RATE))
  let seed = 731, low = 0
  const tone = (t: number, frequency: number, start: number, length: number) => {
    const age = t - start
    if (age < 0 || age >= length) return 0
    const envelope = Math.min(1, age / .012) * Math.pow(1 - age / length, 2)
    const phase = age * frequency * Math.PI * 2
    return (Math.sin(phase) + .24 * Math.sin(phase * 2) + .1 * Math.sin(phase * 3)) * envelope
  }
  for (let i = 0; i < samples.length; i++) {
    const t = i / SAMPLE_RATE, p = t / duration
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    const noise = seed / 2147483648 - 1
    low += (noise - low) * .12
    let value = 0
    switch (cue) {
      case 'thud': value = .8 * Math.sin(2 * Math.PI * (95 * t - 65 * t * t)) * Math.exp(-t * 14) + low * Math.exp(-t * 10); break
      case 'grind': value = low * 2.3 * Math.sin(Math.PI * p) * (.65 + .35 * Math.sin(t * 210)); break
      case 'arrow': value = (noise - low) * Math.sin(Math.PI * p) * Math.exp(-p * 3) * .7 + tone(t, 1100, 0, .07) * .12; break
      case 'cannon': value = Math.sin(2 * Math.PI * (65 * t - 19 * t * t)) * Math.exp(-t * 7) * .65 + low * 2 * Math.exp(-t * 5); break
      case 'shatter': value = noise * Math.exp(-t * 8) * .5 + low * Math.exp(-t * 4) + tone(t, 190, .05, .25) * .15; break
      case 'tick': value = tone(t, 760, 0, duration) * .5; break
      case 'crown': value = tone(t, 523.25, 0, .8) * .45 + tone(t, 659.25, .16, .8) * .4 + tone(t, 783.99, .32, .9) * .4; break
      case 'victory':
        for (const [start, frequency] of [[0, 261.63], [.22, 329.63], [.44, 392], [.68, 523.25]]) value += tone(t, frequency!, start!, .65) * .45
        for (const frequency of [261.63, 392, 523.25, 659.25]) value += tone(t, frequency, 1, 1.5) * .23
        break
      case 'defeat': value = tone(t, 220, 0, .8) * .45 + tone(t, 174.61, .32, .9) * .4 + tone(t, 130.81, .68, 1.1) * .5; break
    }
    // Short edge ramps eliminate clicks; saturation prevents digital clipping.
    const edge = Math.min(1, t / .005, (duration - t) / .015)
    samples[i] = Math.tanh(value) * .9 * Math.max(0, edge)
  }
  return samples
}
