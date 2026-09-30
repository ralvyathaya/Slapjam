export interface LevelConfig {
  level: number
  /** Short HUD label, e.g. "L2" or "ENDLESS 1". */
  label: string
  name: string
  endless: boolean
  targetHeight: number
  coronationMs: number
  /** Gargoyles queued each time the tower passes another 10 m. */
  scoutsPerMilestone: number
  /** One-shot gargoyle wave when the coronation countdown starts. */
  swarmSize: number
  gargoyleHp: number
  /** 0 disables battering rams for the level. */
  ramIntervalMs: number
  ramFirstMs: number
  ramHp: number
  maxRams: number
  /** Peak sideways push on falling rooms, as force per unit mass (gravity is 0.00125). */
  wind: number
  /** Finishing under par earns the third star. */
  parSeconds: number
}

export const CAMPAIGN_LEVELS = 3

const CAMPAIGN: Omit<LevelConfig, 'level' | 'endless'>[] = [
  { label: 'L1', name: 'The First Stone', targetHeight: 15, coronationMs: 8000,
    scoutsPerMilestone: 2, swarmSize: 4, gargoyleHp: 24,
    ramIntervalMs: 0, ramFirstMs: 0, ramHp: 0, maxRams: 0, wind: 0, parSeconds: 120 },
  { label: 'L2', name: 'Siege of Rams', targetHeight: 25, coronationMs: 10_000,
    scoutsPerMilestone: 2, swarmSize: 6, gargoyleHp: 30,
    ramIntervalMs: 16_000, ramFirstMs: 15_000, ramHp: 100, maxRams: 2, wind: 0, parSeconds: 210 },
  { label: 'L3', name: 'The Final Climax', targetHeight: 35, coronationMs: 12_000,
    scoutsPerMilestone: 3, swarmSize: 8, gargoyleHp: 34,
    ramIntervalMs: 12_000, ramFirstMs: 12_000, ramHp: 130, maxRams: 3, wind: .00016, parSeconds: 300 },
]

export function getLevelConfig(level: number): LevelConfig {
  const n = Math.max(1, Math.floor(level))
  if (n <= CAMPAIGN_LEVELS) return { ...CAMPAIGN[n - 1]!, level: n, endless: false }
  const wave = n - CAMPAIGN_LEVELS
  return {
    level: n, label: `ENDLESS ${wave}`, name: `Endless Siege ${wave}`, endless: true,
    targetHeight: 35 + wave * 10, coronationMs: 12_000,
    scoutsPerMilestone: Math.min(5, 3 + Math.floor(wave / 2)), swarmSize: Math.min(12, 8 + wave),
    gargoyleHp: Math.min(60, 34 + wave * 4),
    ramIntervalMs: Math.max(7000, 12_000 - wave * 1000), ramFirstMs: 10_000,
    ramHp: Math.min(220, 130 + wave * 15), maxRams: 4,
    wind: Math.min(.00026, .00016 + wave * .00002), parSeconds: 300 + wave * 90,
  }
}
