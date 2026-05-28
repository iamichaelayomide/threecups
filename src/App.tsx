import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  Award,
  Chart,
  Clock,
  Cup,
  Eye,
  Flash,
  Home,
  MagicStar,
  MedalStar,
  Music,
  Pause,
  Setting2,
  Shield,
  Shop,
  Speedometer,
  Timer,
  VolumeHigh,
  ArrowRight2,
} from 'iconsax-react'
import { ThreeCupScene } from './components/ThreeCupScene'
import {
  BOOSTERS,
  createShuffleSequence,
  defaultProgress,
  getRoundConfig,
  recordRound,
  resolveStonePosition,
  spendBooster,
  consumeOwnedBooster,
  type BoosterId,
  type Phase,
  type Progress,
  type SwapMove,
} from './lib/game'
import { clearProgress, loadProgress, saveProgress } from './lib/storage'

const navItems = [
  { phase: 'home' as const, label: 'Home', icon: Home },
  { phase: 'progress' as const, label: 'Progress', icon: Chart },
  { phase: 'shop' as const, label: 'Shop', icon: Shop },
  { phase: 'settings' as const, label: 'Settings', icon: Setting2 },
]

function boosterIcon(id: BoosterId) {
  if (id === 'extraTime') return <Flash size={20} variant="Bulk" color="currentColor" />
  if (id === 'slowShuffle') return <Speedometer size={20} variant="Bulk" color="currentColor" />
  if (id === 'revealOne') return <Eye size={20} variant="Bulk" color="currentColor" />
  return <Shield size={20} variant="Bulk" color="currentColor" />
}

function App() {
  const [phase, setPhase] = useState<Phase>('home')
  const [progress, setProgress] = useState<Progress>(() => loadProgress())
  const [stoneStart, setStoneStart] = useState(1)
  const [moves, setMoves] = useState<SwapMove[]>([])
  const [correctCup, setCorrectCup] = useState(1)
  const [selectedCup, setSelectedCup] = useState<number | null>(null)
  const [activeBoosters, setActiveBoosters] = useState<BoosterId[]>([])
  const [resultWon, setResultWon] = useState<boolean | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [usedSecondChance, setUsedSecondChance] = useState(false)
  const finishRoundRef = useRef<(cup: number | null) => void>(() => undefined)

  const config = useMemo(() => getRoundConfig(progress.level, activeBoosters), [activeBoosters, progress.level])
  const accuracy = progress.gamesPlayed ? Math.round((progress.gamesWon / progress.gamesPlayed) * 100) : 0
  const revealEmptyCup = activeBoosters.includes('revealOne')
    ? [0, 1, 2].find((cup) => cup !== correctCup) ?? null
    : null
  const nextConfig = useMemo(() => getRoundConfig(progress.level + 1), [progress.level])

  useEffect(() => {
    saveProgress(progress)
  }, [progress])

  useEffect(() => {
    if (phase !== 'guess') return
    const startedAt = Date.now()
    const timer = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000)
      const next = Math.max(0, config.timerSeconds - elapsed)
      setSecondsLeft(next)
      if (next <= 0) {
        window.clearInterval(timer)
        finishRoundRef.current(null)
      }
    }, 180)
    return () => window.clearInterval(timer)
  }, [phase, config.timerSeconds])

  function startRound() {
    const nextStone = Math.floor(Math.random() * 3)
    const nextMoves = createShuffleSequence(config.swaps, Date.now() % 9999)
    const nextCorrect = resolveStonePosition(nextStone, nextMoves)
    setStoneStart(nextStone)
    setMoves(nextMoves)
    setCorrectCup(nextCorrect)
    setSelectedCup(null)
    setResultWon(null)
    setUsedSecondChance(false)
    setPhase('ready')
  }

  function beginReveal() {
    setPhase('reveal')
    window.setTimeout(() => setPhase('shuffle'), 1150)
  }

  function finishRound(cup: number | null) {
    if (phase === 'result') return
    const won = cup === correctCup
    if (!won && activeBoosters.includes('secondChance') && !usedSecondChance) {
      setUsedSecondChance(true)
      setSelectedCup(null)
      return
    }
    setSelectedCup(cup)
    setResultWon(won)
    setProgress((current) => recordRound(current, won))
    setActiveBoosters([])
    setPhase('result')
  }

  useEffect(() => {
    finishRoundRef.current = finishRound
  })

  function toggleBooster(id: BoosterId) {
    if (!['ready', 'guess'].includes(phase)) return
    if (activeBoosters.includes(id)) {
      setActiveBoosters((items) => items.filter((item) => item !== id))
      setProgress((current) => ({
        ...current,
        boosters: { ...current.boosters, [id]: current.boosters[id] + 1 },
      }))
      return
    }
    if (progress.boosters[id] <= 0) return
    setProgress((current) => consumeOwnedBooster(current, id))
    setActiveBoosters((items) => [...items, id])
  }

  function handleShuffleComplete() {
    setSecondsLeft(config.timerSeconds)
    setPhase('guess')
  }

  function updateSetting(key: keyof Progress['settings']) {
    setProgress((current) => ({
      ...current,
      settings: {
        ...current.settings,
        [key]: !current.settings[key],
      },
    }))
  }

  const scenePhase = phase === 'ready' ? 'idle' : phase === 'reveal' ? 'reveal' : phase === 'shuffle' ? 'shuffle' : phase === 'guess' ? 'guess' : phase === 'result' ? 'result' : 'idle'

  return (
    <main className="app-shell">
      <section className={`phone ${progress.settings.darkMode ? 'dark' : ''} ${progress.settings.reduceMotion ? 'reduce-motion' : ''} ${progress.settings.largeText ? 'large-text' : ''}`}>
        <div className="screen">
          <div className="status">
            <span>11:05</span>
            <span>5G 100%</span>
          </div>
          {phase === 'home' && (
            <HomeScreen
              progress={progress}
              onPlay={() => (progress.gamesPlayed === 0 ? setPhase('howto') : startRound())}
            />
          )}
          {phase === 'howto' && <HowToScreen onBack={() => setPhase('home')} onDone={startRound} />}
          {['ready', 'reveal', 'shuffle', 'guess', 'result'].includes(phase) && (
            <>
              {phase !== 'result' && (
                <GameScreen
                  phase={phase}
                  progress={progress}
                  configSeconds={config.timerSeconds}
                  configSwaps={config.swaps}
                  tempo={config.tempo}
                  secondsLeft={secondsLeft}
                  activeBoosters={activeBoosters}
                  scenePhase={scenePhase}
                  stoneStart={stoneStart}
                  moves={moves}
                  correctCup={correctCup}
                  selectedCup={selectedCup}
                  revealEmptyCup={revealEmptyCup}
                  shuffleDuration={config.shuffleDuration}
                  onBack={() => setPhase('home')}
                  onReady={beginReveal}
                  onShuffleComplete={handleShuffleComplete}
                  onCupSelect={finishRound}
                  onToggleBooster={toggleBooster}
                />
              )}
              {phase === 'result' && (
                <ResultScreen
                  won={Boolean(resultWon)}
                  progress={progress}
                  nextSwaps={nextConfig.swaps}
                  nextSpeed={nextConfig.shuffleDuration}
                  scenePhase={scenePhase}
                  stoneStart={stoneStart}
                  moves={moves}
                  correctCup={correctCup}
                  selectedCup={selectedCup}
                  shuffleDuration={config.shuffleDuration}
                  onNext={startRound}
                />
              )}
            </>
          )}
          {phase === 'progress' && <ProgressScreen progress={progress} accuracy={accuracy} />}
          {phase === 'shop' && (
            <ShopScreen progress={progress} onBuy={(id) => setProgress((current) => spendBooster(current, id))} />
          )}
          {phase === 'settings' && (
            <SettingsScreen
              progress={progress}
              onToggle={updateSetting}
              onReset={() => {
                clearProgress()
                setProgress(defaultProgress)
                setPhase('home')
              }}
            />
          )}
        </div>
        <BottomNav phase={phase} onNavigate={setPhase} />
      </section>
    </main>
  )
}

function TopBar({ progress, onBack }: { progress: Progress; onBack?: () => void }) {
  return (
    <div className="top-bar">
      {onBack ? (
        <button className="icon-button" onClick={onBack} aria-label="Go back">
          <ArrowLeft size={23} variant="Linear" color="currentColor" />
        </button>
      ) : (
        <div className="avatar" />
      )}
      <span className="pill">Level {progress.level}</span>
      <span className="pill coin-pill">
        <Flash size={18} variant="Bulk" color="currentColor" /> {progress.lightning}
      </span>
    </div>
  )
}

function HomeScreen({ progress, onPlay }: { progress: Progress; onPlay: () => void }) {
  return (
    <>
      <TopBar progress={progress} />
      <section className="hero">
        <h1 className="title">
          <span>CUP</span>CHASE
        </h1>
        <p className="subtitle">Track the stone. Trust your eyes.</p>
        <div className="fun-strip" aria-label="Current challenge">
          <span><Cup size={16} variant="Bulk" color="currentColor" /> Level {progress.level}</span>
          <span><MedalStar size={16} variant="Bulk" color="currentColor" /> Streak {progress.streak}</span>
        </div>
        <div className="mini-cups" aria-hidden="true">
          <div className="sparkles"><i /><i /><i /><i /></div>
          <div className="cup-art" />
          <div className="cup-art" />
          <div className="cup-art" />
          <div className="stone-art" />
        </div>
        <button className="primary-btn" onClick={onPlay}>Play</button>
      </section>
    </>
  )
}

function HowToScreen({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const steps = [
    ['The stone is hidden under a cup.', 'Watch where it starts before the cups drop.'],
    ['The cups are shuffled around.', 'Follow the motion and do not blink.'],
    ['Guess the cup with the stone.', 'Pick fast before the timer runs out.'],
  ]
  return (
    <>
      <div className="top-bar">
        <button className="icon-button" onClick={onBack} aria-label="Go back"><ArrowLeft size={23} color="currentColor" /></button>
        <h2>How to Play</h2>
        <span />
      </div>
      <div className="howto-list">
        {steps.map(([title, copy], index) => (
          <div className="howto-row" key={title}>
            <span className="step-num">{index + 1}</span>
            <div>
              <p className="row-title">{title}</p>
              <p className="row-copy">{copy}</p>
            </div>
            <div className="cup-art" style={{ position: 'relative', left: 'auto', right: 'auto', bottom: 'auto', width: 42, height: 52 }} />
          </div>
        ))}
      </div>
      <button className="primary-btn" onClick={onDone}>Got it!</button>
    </>
  )
}

function GameScreen({
  phase,
  progress,
  configSeconds,
  configSwaps,
  tempo,
  secondsLeft,
  activeBoosters,
  scenePhase,
  stoneStart,
  moves,
  correctCup,
  selectedCup,
  revealEmptyCup,
  shuffleDuration,
  onBack,
  onReady,
  onShuffleComplete,
  onCupSelect,
  onToggleBooster,
}: {
  phase: Phase
  progress: Progress
  configSeconds: number
  configSwaps: number
  tempo: string
  secondsLeft: number
  activeBoosters: BoosterId[]
  scenePhase: 'idle' | 'reveal' | 'shuffle' | 'guess' | 'result'
  stoneStart: number
  moves: SwapMove[]
  correctCup: number
  selectedCup: number | null
  revealEmptyCup: number | null
  shuffleDuration: number
  onBack: () => void
  onReady: () => void
  onShuffleComplete: () => void
  onCupSelect: (cup: number | null) => void
  onToggleBooster: (id: BoosterId) => void
}) {
  const title = phase === 'ready' ? 'Get Ready!' : phase === 'reveal' || phase === 'shuffle' ? 'Watch Closely!' : 'Where is the stone?'
  const copy = phase === 'ready' ? 'Memorize the cup with the stone.' : phase === 'guess' ? 'Tap a cup before time runs out.' : 'Follow the shuffle.'
  const progressWidth = `${Math.max(0, Math.min(100, (secondsLeft / configSeconds) * 100))}%`

  return (
    <section className="game-screen">
      <TopBar progress={progress} onBack={onBack} />
      <div className="game-copy">
        <h1>{title}</h1>
        <p>{copy}</p>
      </div>
      <div className="round-hud" aria-label="Current round challenge">
        <span><Speedometer size={18} variant="Bulk" color="currentColor" /> {tempo}</span>
        <span><MagicStar size={18} variant="Bulk" color="currentColor" /> {configSwaps} turns</span>
        <span><Timer size={18} variant="Bulk" color="currentColor" /> {configSeconds}s</span>
      </div>
      <div className="scene-wrap">
        <ThreeCupScene
          phase={scenePhase}
          stonePosition={stoneStart}
          moves={moves}
          selectedCup={selectedCup}
          correctCup={correctCup}
          shuffleDuration={shuffleDuration}
          revealEmptyCup={revealEmptyCup}
          onShuffleComplete={onShuffleComplete}
          onCupSelect={(cup) => onCupSelect(cup)}
        />
      </div>
      {phase === 'guess' && (
        <div className="timer-card">
          <Clock size={28} variant="Bulk" color="currentColor" />
          <div className="timer-track"><div className="timer-fill" style={{ width: progressWidth }} /></div>
          <strong>{secondsLeft}</strong>
        </div>
      )}
      {phase === 'ready' && <button className="secondary-btn" onClick={onReady}>I'm Ready</button>}
      {phase === 'ready' && (
        <div className="difficulty-card" aria-label="Round difficulty">
          <span><Speedometer size={18} variant="Bulk" color="currentColor" /> {tempo}</span>
          <span><MagicStar size={18} variant="Bulk" color="currentColor" /> {configSwaps} turns</span>
          <span><Timer size={18} variant="Bulk" color="currentColor" /> {configSeconds}s</span>
        </div>
      )}
      <div className="booster-dock">
        {BOOSTERS.map((booster) => (
          <button
            className={`booster-chip ${activeBoosters.includes(booster.id) ? 'active' : ''}`}
            key={booster.id}
            onClick={() => onToggleBooster(booster.id)}
            disabled={progress.boosters[booster.id] <= 0 && !activeBoosters.includes(booster.id)}
          >
            {boosterIcon(booster.id)}
            x{progress.boosters[booster.id]}
          </button>
        ))}
      </div>
    </section>
  )
}

function ResultScreen({
  won,
  progress,
  nextSwaps,
  nextSpeed,
  scenePhase,
  stoneStart,
  moves,
  correctCup,
  selectedCup,
  shuffleDuration,
  onNext,
}: {
  won: boolean
  progress: Progress
  nextSwaps: number
  nextSpeed: number
  scenePhase: 'idle' | 'reveal' | 'shuffle' | 'guess' | 'result'
  stoneStart: number
  moves: SwapMove[]
  correctCup: number
  selectedCup: number | null
  shuffleDuration: number
  onNext: () => void
}) {
  return (
    <section className="result-card">
      {won && <Confetti />}
      <TopBar progress={progress} />
      <h1 className="result-title">{won ? 'Correct!' : 'So close!'}</h1>
      {won && <div className="level-up-badge"><Award size={18} variant="Bulk" color="currentColor" /> Level {progress.level} unlocked</div>}
      <div className="scene-wrap" style={{ minHeight: 280, height: 300 }}>
        <ThreeCupScene
          phase={scenePhase}
          stonePosition={stoneStart}
          moves={moves}
          selectedCup={selectedCup}
          correctCup={correctCup}
          shuffleDuration={shuffleDuration}
          revealEmptyCup={null}
          onShuffleComplete={() => undefined}
          onCupSelect={() => undefined}
        />
      </div>
      <h3>{won ? 'Great job!' : 'The stone got away.'}</h3>
      <p className="subtitle">{won ? "You're on fire!" : 'Reset your eyes and try again.'}</p>
      <div className={`reward-summary ${won ? 'win' : 'miss'}`}>
        <span><Flash size={18} variant="Bulk" color="currentColor" /> {won ? '+20 lightning' : '+4 lightning'}</span>
        <span><MedalStar size={18} variant="Bulk" color="currentColor" /> Streak {progress.streak}</span>
      </div>
      {won && (
        <div className="next-challenge">
          <span><MagicStar size={17} variant="Bulk" color="currentColor" /> Next: {nextSwaps} turns</span>
          <span><Speedometer size={17} variant="Bulk" color="currentColor" /> {Math.round((1 / nextSpeed) * 100)} speed</span>
        </div>
      )}
      <button className="primary-btn" onClick={onNext}>Next Round</button>
    </section>
  )
}

function ProgressScreen({ progress, accuracy }: { progress: Progress; accuracy: number }) {
  return (
    <>
      <TopBar progress={progress} onBack={() => undefined} />
      <h2>Your Progress</h2>
      <section className="streak-card">
        <p className="row-copy" style={{ color: '#efe9ff' }}>Current Streak</p>
        <h1 style={{ margin: 0 }}><Flash variant="Bulk" color="currentColor" /> {progress.streak} Days</h1>
      </section>
      <div className="stats-grid">
        <div className="stat"><strong>{progress.gamesPlayed}</strong><span>Games Played</span></div>
        <div className="stat"><strong>{progress.gamesWon}</strong><span>Games Won</span></div>
        <div className="stat"><strong>{accuracy}%</strong><span>Accuracy</span></div>
      </div>
      <h3>Recent Activity</h3>
      <div className="chart">
        {progress.recentResults.slice(-7).map((won, index) => (
          <div className={`bar ${won ? '' : 'miss'}`} style={{ height: `${won ? 64 + index * 5 : 32 + index * 4}%` }} key={`${won}-${index}`} />
        ))}
      </div>
    </>
  )
}

function ShopScreen({ progress, onBuy }: { progress: Progress; onBuy: (id: BoosterId) => void }) {
  return (
    <>
      <TopBar progress={progress} onBack={() => undefined} />
      <h2>Shop</h2>
      <div className="tabs">
        <button className="tab active">Boosters</button>
        <button className="tab">Themes</button>
        <button className="tab">Coins</button>
      </div>
      <div className="howto-list" style={{ gap: 10 }}>
        {BOOSTERS.map((booster) => (
          <div className="shop-row" key={booster.id}>
            <span className="booster-icon">{boosterIcon(booster.id)}</span>
            <div>
              <p className="row-title">{booster.name}</p>
              <p className="row-copy">{booster.description} · Owned {progress.boosters[booster.id]}</p>
            </div>
            <button className="price" onClick={() => onBuy(booster.id)} disabled={progress.lightning < booster.price}>
              {booster.price}
            </button>
          </div>
        ))}
      </div>
    </>
  )
}

function SettingsScreen({
  progress,
  onToggle,
  onReset,
}: {
  progress: Progress
  onToggle: (key: keyof Progress['settings']) => void
  onReset: () => void
}) {
  const rows: Array<[keyof Progress['settings'], string, React.ReactNode]> = [
    ['sound', 'Sound', <VolumeHigh size={20} variant="Bulk" color="currentColor" />],
    ['haptics', 'Haptics', <Flash size={20} variant="Bulk" color="currentColor" />],
    ['music', 'Music', <Music size={20} variant="Bulk" color="currentColor" />],
    ['darkMode', 'Dark Mode', <Pause size={20} variant="Bulk" color="currentColor" />],
    ['reduceMotion', 'Reduce Motion', <Speedometer size={20} variant="Bulk" color="currentColor" />],
    ['largeText', 'Large Text', <MagicStar size={20} variant="Bulk" color="currentColor" />],
  ]
  return (
    <>
      <TopBar progress={progress} onBack={() => undefined} />
      <h2>Settings</h2>
      <div className="howto-list" style={{ gap: 10 }}>
        {rows.map(([key, label, icon]) => (
          <div className="setting-row" key={key}>
            <span style={{ color: 'var(--primary)' }}>{icon}</span>
            <p className="row-title">{label}</p>
            <button className={`switch ${progress.settings[key] ? 'on' : ''}`} onClick={() => onToggle(key)} aria-label={`Toggle ${label}`} />
          </div>
        ))}
        {['Language  English', 'Help & Support', 'About Cup Chase'].map((label) => (
          <div className="setting-row" key={label}>
            <span />
            <p className="row-title">{label}</p>
            <ArrowRight2 size={21} color="currentColor" />
          </div>
        ))}
      </div>
      <button className="danger-btn" onClick={onReset}>Reset Progress</button>
    </>
  )
}

function BottomNav({ phase, onNavigate }: { phase: Phase; onNavigate: (phase: Phase) => void }) {
  return (
    <nav className="bottom-nav" aria-label="Primary navigation">
      {navItems.map((item) => {
        const Icon = item.icon
        const active = phase === item.phase || (item.phase === 'home' && ['ready', 'reveal', 'shuffle', 'guess', 'result', 'howto'].includes(phase))
        return (
          <button className={`nav-item ${active ? 'active' : ''}`} key={item.phase} onClick={() => onNavigate(item.phase)}>
            <Icon size={23} variant={active ? 'Bulk' : 'Linear'} color="currentColor" />
            <span>{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

function Confetti() {
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: 22 }).map((_, index) => (
        <span
          key={index}
          style={{
            left: `${8 + ((index * 13) % 84)}%`,
            animationDelay: `${(index % 8) * 0.12}s`,
          }}
        />
      ))}
    </div>
  )
}

export default App
