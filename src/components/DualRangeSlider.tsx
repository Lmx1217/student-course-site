import { useRef, type PointerEvent as ReactPointerEvent } from "react"

type SliderDragTarget = "none" | "min" | "max" | "pending"

type DualRangeSliderProps = {
  label: string
  range: [number, number]
  maxValue: number
  onMinChange: (nextValue: number) => void
  onMaxChange: (nextValue: number) => void
  onCommit?: () => void
}

function clampValue(value: number, minValue: number, maxValue: number): number {
  return Math.min(maxValue, Math.max(minValue, value))
}

function getRangeOffset(value: number, maxValue: number): number {
  if (maxValue <= 0) {
    return 0
  }

  return (value / maxValue) * 100
}

function getSliderValueFromClientX(
  clientX: number,
  bounds: DOMRect,
  maxValue: number
): number {
  if (maxValue <= 0) {
    return 0
  }

  const ratio = clampValue((clientX - bounds.left) / bounds.width, 0, 1)
  return Math.round(ratio * maxValue)
}

export default function DualRangeSlider({
  label,
  range,
  maxValue,
  onMinChange,
  onMaxChange,
  onCommit,
}: DualRangeSliderProps) {
  const trackRef = useRef<HTMLDivElement | null>(null)
  const pointerIdRef = useRef<number | null>(null)
  const pendingStartXRef = useRef<number | null>(null)
  const dragTargetRef = useRef<SliderDragTarget>("none")
  const startOffset = getRangeOffset(range[0], maxValue)
  const endOffset = getRangeOffset(range[1], maxValue)

  function getTrackBounds(): DOMRect | null {
    return trackRef.current?.getBoundingClientRect() ?? null
  }

  function chooseInitialTarget(clientX: number, bounds: DOMRect): SliderDragTarget {
    const minHandleX = bounds.left + (startOffset / 100) * bounds.width
    const maxHandleX = bounds.left + (endOffset / 100) * bounds.width
    const distanceToMin = Math.abs(clientX - minHandleX)
    const distanceToMax = Math.abs(clientX - maxHandleX)
    const handleHitRadius = 12
    const handlesOverlap = Math.abs(minHandleX - maxHandleX) <= 2
    const onMinHandle = distanceToMin <= handleHitRadius
    const onMaxHandle = distanceToMax <= handleHitRadius

    if (handlesOverlap && onMinHandle && onMaxHandle) {
      return "pending"
    }

    if (onMinHandle && onMaxHandle) {
      return distanceToMin <= distanceToMax ? "min" : "max"
    }

    if (onMinHandle) {
      return "min"
    }

    if (onMaxHandle) {
      return "max"
    }

    if (clientX < minHandleX) {
      return "min"
    }

    if (clientX > maxHandleX) {
      return "max"
    }

    return distanceToMin <= distanceToMax ? "min" : "max"
  }

  function applyDrag(nextTarget: Exclude<SliderDragTarget, "none" | "pending">, clientX: number) {
    const bounds = getTrackBounds()

    if (!bounds) {
      return
    }

    const nextValue = getSliderValueFromClientX(clientX, bounds, maxValue)

    if (nextTarget === "min") {
      onMinChange(Math.min(nextValue, range[1]))
      return
    }

    onMaxChange(Math.max(nextValue, range[0]))
  }

  function completePointerInteraction(
    pointerId: number,
    releaseCapture: boolean,
    currentTarget?: HTMLDivElement | null
  ) {
    if (pointerIdRef.current !== pointerId) {
      return
    }

    pointerIdRef.current = null
    pendingStartXRef.current = null
    dragTargetRef.current = "none"

    if (
      releaseCapture &&
      currentTarget &&
      currentTarget.hasPointerCapture(pointerId)
    ) {
      currentTarget.releasePointerCapture(pointerId)
    }

    onCommit?.()
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.button !== 0) {
      return
    }

    const bounds = getTrackBounds()

    if (!bounds) {
      return
    }

    event.preventDefault()

    const nextTarget = chooseInitialTarget(event.clientX, bounds)
    pointerIdRef.current = event.pointerId
    pendingStartXRef.current = event.clientX
    dragTargetRef.current = nextTarget
    event.currentTarget.setPointerCapture(event.pointerId)

    if (nextTarget === "min" || nextTarget === "max") {
      applyDrag(nextTarget, event.clientX)
    }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (pointerIdRef.current !== event.pointerId) {
      return
    }

    const dragTarget = dragTargetRef.current

    if (dragTarget === "none") {
      return
    }

    if (dragTarget === "pending") {
      const deltaX = event.clientX - (pendingStartXRef.current ?? event.clientX)

      if (Math.abs(deltaX) < 2) {
        return
      }

      const resolvedTarget = deltaX < 0 ? "min" : "max"
      dragTargetRef.current = resolvedTarget
      applyDrag(resolvedTarget, event.clientX)
      return
    }

    applyDrag(dragTarget, event.clientX)
  }

  function finishPointerInteraction(event: ReactPointerEvent<HTMLDivElement>) {
    completePointerInteraction(event.pointerId, true, event.currentTarget)
  }

  function handleLostPointerCapture(event: ReactPointerEvent<HTMLDivElement>) {
    completePointerInteraction(event.pointerId, false)
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-slate-700">{label}</div>
        <div className="text-xs text-slate-500">
          {range[0]} - {range[1]}
        </div>
      </div>

      <div className="mt-4">
        <div className="relative h-8">
          <div
            ref={trackRef}
            className="absolute inset-x-2 top-0 bottom-0 cursor-pointer touch-none select-none"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={finishPointerInteraction}
            onPointerCancel={finishPointerInteraction}
            onLostPointerCapture={handleLostPointerCapture}
          >
            <div className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-slate-200" />
            <div
              className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-slate-900 transition-[left,width] duration-100 ease-out"
              style={{
                left: `${startOffset}%`,
                width: `${Math.max(0, endOffset - startOffset)}%`,
              }}
            />

            <div
              className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-slate-900 bg-white shadow-sm transition-[left,transform,box-shadow] duration-100 ease-out"
              style={{ left: `${startOffset}%` }}
            />
            <div
              className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-slate-900 bg-white shadow-sm transition-[left,transform,box-shadow] duration-100 ease-out"
              style={{ left: `${endOffset}%` }}
            />
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
          <span>0</span>
          <span>{maxValue}</span>
        </div>
      </div>
    </div>
  )
}
