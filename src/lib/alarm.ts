// Rest-timer alarm: a short beep via Web Audio plus vibration (Android).
// Browsers only allow audio after a user gesture, so primeAudio() is called
// from the "Log set" tap and the context is reused for the beep later.

let ctx: AudioContext | null = null

export function primeAudio(): void {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    ctx = null
  }
}

export function beep(): void {
  if (!ctx) return
  const now = ctx.currentTime
  for (const [i, freq] of [880, 880, 1320].entries()) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = freq
    osc.type = 'square'
    const t = now + i * 0.22
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18)
    osc.connect(gain).connect(ctx.destination)
    osc.start(t)
    osc.stop(t + 0.2)
  }
}

export function vibrate(): void {
  try {
    navigator.vibrate?.([250, 120, 250, 120, 400])
  } catch {
    /* not supported */
  }
}
