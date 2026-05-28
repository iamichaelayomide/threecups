import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import * as THREE from 'three'
import type { SwapMove } from '../lib/game'

type ScenePhase = 'idle' | 'reveal' | 'shuffle' | 'guess' | 'result'

type ThreeCupSceneProps = {
  phase: ScenePhase
  stonePosition: number
  moves: SwapMove[]
  selectedCup: number | null
  correctCup: number
  shuffleDuration: number
  revealEmptyCup: number | null
  onShuffleComplete: () => void
  onCupSelect: (cupIndex: number) => void
}

const CUP_X = [-1.72, 0, 1.72]
const CUP_Y = 0.8
const CUP_RADIUS = 0.54

export function ThreeCupScene({
  phase,
  stonePosition,
  moves,
  selectedCup,
  correctCup,
  shuffleDuration,
  revealEmptyCup,
  onShuffleComplete,
  onCupSelect,
}: ThreeCupSceneProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const cupsRef = useRef<THREE.Group[]>([])
  const stoneRef = useRef<THREE.Mesh | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const raycasterRef = useRef(new THREE.Raycaster())
  const pointerRef = useRef(new THREE.Vector2())
  const timelineRef = useRef<gsap.core.Timeline | null>(null)
  const onShuffleCompleteRef = useRef(onShuffleComplete)
  const onCupSelectRef = useRef(onCupSelect)
  const phaseRef = useRef(phase)

  useEffect(() => {
    onShuffleCompleteRef.current = onShuffleComplete
    onCupSelectRef.current = onCupSelect
    phaseRef.current = phase
  }, [onCupSelect, onShuffleComplete, phase])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const scene = new THREE.Scene()
    scene.background = null

    const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 100)
    camera.position.set(0, 4.8, 9.2)
    camera.lookAt(0, 0.45, 0)
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    host.appendChild(renderer.domElement)
    rendererRef.current = renderer

    const ambient = new THREE.HemisphereLight(0xffffff, 0xd8ceff, 2.1)
    scene.add(ambient)

    const key = new THREE.DirectionalLight(0xffffff, 2.6)
    key.position.set(-3, 6, 4)
    key.castShadow = true
    scene.add(key)

    const fill = new THREE.PointLight(0x9c6cff, 4, 9)
    fill.position.set(3, 3, 4)
    scene.add(fill)

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(4.4, 64),
      new THREE.ShadowMaterial({ color: 0x7756db, opacity: 0.13 }),
    )
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -0.05
    floor.receiveShadow = true
    scene.add(floor)

    const cupMaterial = new THREE.MeshStandardMaterial({
      color: 0x7c4df1,
      roughness: 0.34,
      metalness: 0.08,
      emissive: 0x241157,
      emissiveIntensity: 0.08,
    })
    const rimMaterial = new THREE.MeshStandardMaterial({
      color: 0xa98eff,
      roughness: 0.24,
      metalness: 0.12,
    })
    const stoneMaterial = new THREE.MeshStandardMaterial({
      color: 0xb8bcc6,
      roughness: 0.18,
      metalness: 0.55,
    })

    cupsRef.current = CUP_X.map((x, index) => {
      const group = new THREE.Group()
      group.position.set(x, CUP_Y, 0)
      group.userData.cupIndex = index

      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, CUP_RADIUS, 1.32, 48, 1, true), cupMaterial)
      body.castShadow = true
      body.receiveShadow = true
      body.userData.cupIndex = index
      group.add(body)

      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.45, 0.08, 48), rimMaterial)
      top.position.y = 0.67
      top.castShadow = true
      top.userData.cupIndex = index
      group.add(top)

      const lip = new THREE.Mesh(new THREE.TorusGeometry(CUP_RADIUS, 0.055, 12, 48), rimMaterial)
      lip.position.y = -0.68
      lip.rotation.x = Math.PI / 2
      lip.castShadow = true
      lip.userData.cupIndex = index
      group.add(lip)

      const shine = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.24, 1.02, 18, 1, true, 0, Math.PI / 3),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18 }),
      )
      shine.position.set(-0.22, 0.03, 0.47)
      shine.rotation.y = -0.28
      group.add(shine)

      scene.add(group)
      return group
    })

    const stone = new THREE.Mesh(new THREE.SphereGeometry(0.24, 48, 32), stoneMaterial)
    stone.position.set(CUP_X[1], 0.22, 0.52)
    stone.castShadow = true
    scene.add(stone)
    stoneRef.current = stone

    const resize = () => {
      const rect = host.getBoundingClientRect()
      renderer.setSize(rect.width, rect.height)
      camera.aspect = rect.width / Math.max(1, rect.height)
      camera.updateProjectionMatrix()
    }

    const animate = () => {
      cupsRef.current.forEach((cup, index) => {
        cup.rotation.y += 0.002 + index * 0.0004
      })
      renderer.render(scene, camera)
    }

    const onPointerUp = (event: PointerEvent) => {
      if (phaseRef.current !== 'guess') return
      const rect = renderer.domElement.getBoundingClientRect()
      pointerRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointerRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      raycasterRef.current.setFromCamera(pointerRef.current, camera)
      const hits = raycasterRef.current.intersectObjects(cupsRef.current, true)
      const hit = hits.find((item) => typeof item.object.userData.cupIndex === 'number')
      if (hit) onCupSelectRef.current(hit.object.userData.cupIndex)
    }

    resize()
    renderer.setAnimationLoop(animate)
    renderer.domElement.addEventListener('pointerup', onPointerUp)
    window.addEventListener('resize', resize)

    return () => {
      timelineRef.current?.kill()
      renderer.setAnimationLoop(null)
      renderer.domElement.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('resize', resize)
      host.removeChild(renderer.domElement)
      renderer.dispose()
      scene.traverse((object: THREE.Object3D) => {
        const mesh = object as THREE.Mesh
        mesh.geometry?.dispose()
        const material = mesh.material
        if (Array.isArray(material)) {
          material.forEach((item) => item.dispose())
        } else {
          material?.dispose()
        }
      })
    }
  }, [])

  useEffect(() => {
    if (stoneRef.current) {
      stoneRef.current.position.x = CUP_X[stonePosition]
      stoneRef.current.visible = phase === 'idle' || phase === 'reveal' || phase === 'result'
    }
  }, [phase, stonePosition])

  useEffect(() => {
    timelineRef.current?.kill()
    const cups = cupsRef.current
    if (!cups.length) return
    const tl = gsap.timeline()
    timelineRef.current = tl

    if (phase === 'idle') {
      cups.forEach((cup, index) => {
        tl.to(cup.position, { x: CUP_X[index], y: CUP_Y, duration: 0.25, ease: 'power2.out' }, 0)
        tl.to(cup.rotation, { z: 0, x: 0, duration: 0.25 }, 0)
      })
    }

    if (phase === 'reveal') {
      cups.forEach((cup, index) => {
        const lift = index === stonePosition ? 1.32 : 0
        tl.to(cup.position, { y: CUP_Y + lift, duration: 0.45, ease: 'back.out(1.8)' }, 0)
      })
    }

    if (phase === 'shuffle') {
      const positions = [0, 1, 2]
      tl.to(cups.map((cup) => cup.position), { y: CUP_Y, duration: 0.24, ease: 'power2.inOut' })
      moves.forEach((move) => {
        const cupA = cups[positions[move.a]]
        const cupB = cups[positions[move.b]]
        const xA = CUP_X[move.a]
        const xB = CUP_X[move.b]
        tl.to(cupA.position, { x: xB, z: -0.34, duration: shuffleDuration, ease: 'power2.inOut' }, 'swap')
        tl.to(cupB.position, { x: xA, z: 0.34, duration: shuffleDuration, ease: 'power2.inOut' }, 'swap')
        tl.to(cupA.position, { z: 0, duration: 0.16, ease: 'sine.out' })
        tl.to(cupB.position, { z: 0, duration: 0.16, ease: 'sine.out' }, '<')
        const temp = positions[move.a]
        positions[move.a] = positions[move.b]
        positions[move.b] = temp
      })
      tl.call(() => onShuffleCompleteRef.current())
    }

    if (phase === 'guess') {
      cups.forEach((cup, index) => {
        const shouldPeek = revealEmptyCup === index
        tl.to(cup.position, { y: CUP_Y + (shouldPeek ? 0.7 : 0), duration: 0.3, ease: 'power2.out' }, 0)
      })
    }

    if (phase === 'result') {
      cups.forEach((cup, index) => {
        const shouldLift = index === correctCup || index === selectedCup
        tl.to(cup.position, { y: CUP_Y + (shouldLift ? 1.32 : 0), duration: 0.45, ease: 'back.out(1.7)' }, 0)
        tl.to(cup.rotation, { z: shouldLift ? (index === correctCup ? -0.18 : 0.18) : 0, duration: 0.45 }, 0)
      })
    }

    return () => {
      tl.kill()
    }
  }, [correctCup, moves, phase, revealEmptyCup, selectedCup, shuffleDuration, stonePosition])

  return <div className="three-scene" ref={hostRef} aria-label="3D cup shuffle game board" />
}
