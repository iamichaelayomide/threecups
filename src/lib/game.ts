export type Phase = 'home' | 'howto' | 'ready' | 'reveal' | 'shuffle' | 'guess' | 'result' | 'progress' | 'shop' | 'settings'

export type BoosterId = 'extraTime' | 'slowShuffle' | 'revealOne' | 'secondChance'

export type Booster = {
  id: BoosterId
  name: string
  description: string
  price: number
  icon: string
}

export type Settings = {
  sound: boolean
  haptics: boolean
  music: boolean
  darkMode: boolean
  reduceMotion: boolean
  largeText: boolean
}

export type Progress = {
  level: number
  bestLevel: number
  lightning: number
  streak: number
  gamesPlayed: number
  gamesWon: number
  recentResults: boolean[]
  boosters: Record<BoosterId, number>
  settings: Settings
  lastPlayedDate?: string
}

export type RoundConfig = {
  swaps: number
  shuffleDuration: number
  timerSeconds: number
  difficulty: number
  tempo: 'warmup' | 'quick' | 'wild' | 'expert'
}

export type SwapMove = {
  a: number
  b: number
}

export const BOOSTERS: Booster[] = [
  { id: 'extraTime', name: 'Extra Time', description: '+5 seconds for this round', price: 60, icon: 'flame' },
  { id: 'slowShuffle', name: 'Slow Shuffle', description: 'Shuffles a little slower', price: 80, icon: 'gauge' },
  { id: 'revealOne', name: 'Reveal One', description: 'Shows one empty cup', price: 100, icon: 'eye' },
  { id: 'secondChance', name: 'Second Chance', description: 'Retry once after a miss', price: 120, icon: 'shield' },
]

export const defaultProgress: Progress = {
  level: 1,
  bestLevel: 1,
  lightning: 120,
  streak: 0,
  gamesPlayed: 0,
  gamesWon: 0,
  recentResults: [true, true, false, true, true, true],
  boosters: {
    extraTime: 1,
    slowShuffle: 1,
    revealOne: 1,
    secondChance: 0,
  },
  settings: {
    sound: true,
    haptics: true,
    music: false,
    darkMode: false,
    reduceMotion: false,
    largeText: false,
  },
}

export function getRoundConfig(level: number, activeBoosters: BoosterId[] = []): RoundConfig {
  const safeLevel = Math.max(1, level)
  const hasSlowShuffle = activeBoosters.includes('slowShuffle')
  const hasExtraTime = activeBoosters.includes('extraTime')
  const difficulty = Math.min(24, safeLevel)
  const swaps = Math.min(26, 3 + safeLevel + Math.floor(safeLevel / 3))
  const shuffleDuration = Math.max(0.24, 0.78 - safeLevel * 0.034) * (hasSlowShuffle ? 1.45 : 1)
  const timerSeconds = Math.max(3, 9 - Math.floor(safeLevel / 2.5)) + (hasExtraTime ? 5 : 0)
  const tempo = safeLevel >= 16 ? 'expert' : safeLevel >= 10 ? 'wild' : safeLevel >= 5 ? 'quick' : 'warmup'

  return { swaps, shuffleDuration, timerSeconds, difficulty, tempo }
}

export function createShuffleSequence(count: number, seed = Math.random()): SwapMove[] {
  let value = Math.abs(Math.sin(seed || 0.41) * 10000)
  const moves: SwapMove[] = []
  let previous = ''

  for (let index = 0; index < count; index += 1) {
    value = (value * 9301 + 49297) % 233280
    const roll = value / 233280
    const pairs: SwapMove[] = [
      { a: 0, b: 1 },
      { a: 1, b: 2 },
      { a: 0, b: 2 },
    ]
    let move = pairs[Math.floor(roll * pairs.length)]
    const key = `${move.a}-${move.b}`
    if (key === previous) {
      move = pairs[(pairs.findIndex((pair) => `${pair.a}-${pair.b}` === key) + 1) % pairs.length]
    }
    previous = `${move.a}-${move.b}`
    moves.push(move)
  }

  return moves
}

export function applySwap(positionMap: number[], move: SwapMove): number[] {
  const next = [...positionMap]
  const temp = next[move.a]
  next[move.a] = next[move.b]
  next[move.b] = temp
  return next
}

export function resolveCupSlots(moves: SwapMove[]): number[] {
  let positionMap = [0, 1, 2]
  for (const move of moves) {
    positionMap = applySwap(positionMap, move)
  }
  return positionMap
}

export function resolveStonePosition(initialStoneCup: number, moves: SwapMove[]): number {
  const positionMap = resolveCupSlots(moves)
  return positionMap.indexOf(initialStoneCup)
}

export function recordRound(progress: Progress, won: boolean): Progress {
  const today = new Date().toISOString().slice(0, 10)
  const keptStreak = won
    ? progress.lastPlayedDate === today
      ? progress.streak || 1
      : progress.streak + 1
    : Math.max(0, progress.streak - 1)
  const level = won ? progress.level + 1 : Math.max(1, progress.level)
  const reward = won ? 18 + Math.min(24, progress.level * 2) : 4

  return {
    ...progress,
    level,
    bestLevel: Math.max(progress.bestLevel, level),
    lightning: progress.lightning + reward,
    streak: keptStreak,
    gamesPlayed: progress.gamesPlayed + 1,
    gamesWon: progress.gamesWon + (won ? 1 : 0),
    recentResults: [...progress.recentResults.slice(-6), won],
    lastPlayedDate: today,
  }
}

export function spendBooster(progress: Progress, boosterId: BoosterId): Progress {
  const booster = BOOSTERS.find((item) => item.id === boosterId)
  if (!booster || progress.lightning < booster.price) return progress

  return {
    ...progress,
    lightning: progress.lightning - booster.price,
    boosters: {
      ...progress.boosters,
      [boosterId]: progress.boosters[boosterId] + 1,
    },
  }
}

export function consumeOwnedBooster(progress: Progress, boosterId: BoosterId): Progress {
  if (progress.boosters[boosterId] <= 0) return progress
  return {
    ...progress,
    boosters: {
      ...progress.boosters,
      [boosterId]: progress.boosters[boosterId] - 1,
    },
  }
}
