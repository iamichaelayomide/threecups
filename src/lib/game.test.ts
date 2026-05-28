import { describe, expect, it } from 'vitest'
import { applySwap, createShuffleSequence, getRoundConfig, recordRound, resolveCupSlots, resolveStonePosition, spendBooster, defaultProgress } from './game'

describe('cup chase game logic', () => {
  it('keeps exactly one stone position after a shuffle', () => {
    const moves = createShuffleSequence(9, 42)
    const finalPosition = resolveStonePosition(1, moves)
    expect([0, 1, 2]).toContain(finalPosition)
  })

  it('updates cup positions through swaps', () => {
    expect(applySwap([0, 1, 2], { a: 0, b: 2 })).toEqual([2, 1, 0])
    expect(applySwap([2, 1, 0], { a: 1, b: 2 })).toEqual([2, 0, 1])
  })

  it('resolves the final slot map used by gameplay and the 3D scene', () => {
    const moves = [
      { a: 0, b: 2 },
      { a: 1, b: 2 },
    ]

    expect(resolveCupSlots(moves)).toEqual([2, 0, 1])
    expect(resolveStonePosition(1, moves)).toBe(2)
  })

  it('increases level difficulty predictably', () => {
    const early = getRoundConfig(1)
    const later = getRoundConfig(10)
    expect(later.swaps).toBeGreaterThan(early.swaps)
    expect(later.timerSeconds).toBeLessThanOrEqual(early.timerSeconds)
    expect(later.shuffleDuration).toBeLessThan(early.shuffleDuration)
  })

  it('boosters affect only the intended round config', () => {
    const base = getRoundConfig(6)
    const boosted = getRoundConfig(6, ['extraTime', 'slowShuffle'])
    expect(boosted.timerSeconds).toBe(base.timerSeconds + 5)
    expect(boosted.shuffleDuration).toBeGreaterThan(base.shuffleDuration)
  })

  it('records wins and spends booster currency', () => {
    const won = recordRound(defaultProgress, true)
    expect(won.gamesPlayed).toBe(1)
    expect(won.gamesWon).toBe(1)
    expect(won.level).toBe(2)
    const purchased = spendBooster(won, 'extraTime')
    expect(purchased.boosters.extraTime).toBe(won.boosters.extraTime + 1)
    expect(purchased.lightning).toBe(won.lightning - 60)
  })
})
