import { useEffect, useRef, useState } from 'react'
import type { ReactNode, TouchEvent } from 'react'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  children: ReactNode
}

const CLOSE_DRAG_DISTANCE = 80

const BottomSheet = ({ open, onClose, children }: BottomSheetProps) => {
  const [dragY, setDragY] = useState(0)
  const startY = useRef<number | null>(null)
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const onTouchStart = (e: TouchEvent) => {
    // Only start a drag when the sheet isn't scrolled, so inner scrolling still works
    if ((sheetRef.current?.scrollTop ?? 0) > 0) return
    startY.current = e.touches[0].clientY
  }

  const onTouchMove = (e: TouchEvent) => {
    if (startY.current === null) return
    setDragY(Math.max(0, e.touches[0].clientY - startY.current))
  }

  const onTouchEnd = () => {
    if (startY.current === null) return
    startY.current = null
    if (dragY > CLOSE_DRAG_DISTANCE) onClose()
    setDragY(0)
  }

  return (
    <>
      {/* Clicks on the backdrop are ignored, so the sheet only closes from inside it */}
      <div className="absolute inset-0 w-full bg-black/60 z-40"></div>
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ transform: `translateY(${dragY}px)` }}
        className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-[16px] z-50 flex flex-col px-[20px] pt-[16px] pb-[24px] gap-[16px] max-h-[90%] overflow-auto ${
          dragY === 0 ? 'transition-transform duration-200' : ''
        }`}
      >
        {children}
      </div>
    </>
  )
}

export default BottomSheet
