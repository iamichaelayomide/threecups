import { defaultProgress, type Progress } from './game'

const STORAGE_KEY = 'cup-chase-save-v1'

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultProgress
    const parsed = JSON.parse(raw) as Partial<Progress>
    return {
      ...defaultProgress,
      ...parsed,
      boosters: { ...defaultProgress.boosters, ...parsed.boosters },
      settings: { ...defaultProgress.settings, ...parsed.settings },
      recentResults: Array.isArray(parsed.recentResults) ? parsed.recentResults : defaultProgress.recentResults,
    }
  } catch {
    return defaultProgress
  }
}

export function saveProgress(progress: Progress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
}

export function clearProgress() {
  localStorage.removeItem(STORAGE_KEY)
}
