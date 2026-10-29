import { useEffect, useRef, useState, type CSSProperties } from 'react'

export function TokenScore({ tokens }: { tokens: number }) {
  const [display, setDisplay] = useState(tokens)
  const [burst, setBurst] = useState({ id: 0, delta: 0 })
  const current = useRef(tokens)
  const previous = useRef(tokens)

  useEffect(() => {
    const delta = tokens - previous.current
    previous.current = tokens
    if (!delta) return
    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
    const from = current.current
    const start = performance.now()
    let frame: number
    let first = true
    const tick = (now: number) => {
      if (first && !reduced) setBurst((value) => ({ id: value.id + 1, delta }))
      first = false
      const progress = reduced ? 1 : Math.min(1, (now - start) / 650)
      current.current = Math.round(
        from + (tokens - from) * (1 - (1 - progress) ** 3),
      )
      setDisplay(current.current)
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [tokens])

  return (
    <span
      className="token-score"
      aria-label={`${tokens.toLocaleString()} tokens`}
    >
      <strong aria-hidden="true">{display.toLocaleString()}</strong>
      {burst.id > 0 ? (
        <span
          key={burst.id}
          className={`token-burst ${burst.delta < 0 ? 'token-loss' : 'token-gain'}`}
          aria-hidden="true"
        >
          {Array.from({ length: 10 }, (_, i) => (
            <i
              key={i}
              style={
                {
                  '--angle': `${i * 36}deg`,
                  '--distance': `${30 + (i % 3) * 12}px`,
                } as CSSProperties
              }
            />
          ))}
          <b>
            {burst.delta > 0 ? '+' : '−'}
            {Math.abs(burst.delta).toLocaleString()}
          </b>
        </span>
      ) : null}
    </span>
  )
}
