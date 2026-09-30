import { CAMPAIGN_LEVELS } from '../config/levels'

const KEY = 'castledown-save-v1'

export interface LevelRecord { bestScore: number; stars: number; bestHeight: number }
export interface SaveState {
  bestHeight: number
  highScore: number
  /** Highest level the player may start from (4+ means endless). */
  unlockedLevel: number
  levels: Record<string, LevelRecord>
}

export interface RunStats {
  level: number; height: number; kills: number; placed: number; lost: number; seconds: number; parSeconds: number
}

/** Height is the core score; kills reward defence and speed rewards a crisp build. */
export function scoreRun(stats: RunStats) {
  const timeBonus = Math.max(0, Math.round((stats.parSeconds - stats.seconds) * 10))
  const score = Math.round(stats.height * 100) + stats.kills * 50 + timeBonus - stats.lost * 40 + stats.level * 250
  const stars = 1 + Number(stats.lost <= 2) + Number(stats.seconds <= stats.parSeconds)
  return { score: Math.max(0, score), stars, timeBonus }
}

function empty(): SaveState { return { bestHeight: 0, highScore: 0, unlockedLevel: 1, levels: {} } }

export function loadSave(): SaveState {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<SaveState> | null
    return { ...empty(), ...parsed, levels: { ...parsed?.levels } }
  } catch { return empty() }
}

function write(save: SaveState) {
  // Storage can be unavailable in sandboxed iframes; progress then lasts only this session.
  try { localStorage.setItem(KEY, JSON.stringify(save)) } catch { /* ignore */ }
}

/** Returns true when this height is a new all-time best. */
export function recordHeight(height: number) {
  const save = loadSave()
  if (height <= save.bestHeight + .05) return false
  save.bestHeight = Math.round(height * 10) / 10; write(save)
  return true
}

export function recordVictory(stats: RunStats) {
  const save = loadSave(), result = scoreRun(stats)
  const previous = save.levels[stats.level] ?? { bestScore: 0, stars: 0, bestHeight: 0 }
  const newHighScore = result.score > save.highScore
  save.levels[stats.level] = {
    bestScore: Math.max(previous.bestScore, result.score), stars: Math.max(previous.stars, result.stars),
    bestHeight: Math.max(previous.bestHeight, Math.round(stats.height * 10) / 10),
  }
  save.highScore = Math.max(save.highScore, result.score)
  save.bestHeight = Math.max(save.bestHeight, Math.round(stats.height * 10) / 10)
  save.unlockedLevel = Math.max(save.unlockedLevel, stats.level + 1)
  write(save)
  return { ...result, newHighScore, previousBest: previous.bestScore }
}

export const endlessUnlocked = () => loadSave().unlockedLevel > CAMPAIGN_LEVELS
