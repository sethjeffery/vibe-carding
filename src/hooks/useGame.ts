import { useCallback, useEffect, useRef, useState } from 'react'
import {
  gameRequest,
  GameError,
  supabase,
  type GameRequest,
  type GameResponse,
} from '../lib/api'
import { playSound } from '../lib/sound'

export function useGame() {
  const initialCode =
    new URLSearchParams(location.search).get('game')?.toUpperCase() ?? ''
  const [room, setRoom] = useState<GameResponse | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [restoring, setRestoring] = useState(Boolean(initialCode))
  const [connected, setConnected] = useState(false)
  const roomRef = useRef<GameResponse | null>(null)
  const lock = useRef(false)
  const mounted = useRef(true)
  const generation = useRef(0)

  const accept = useCallback((next: GameResponse) => {
    if (!mounted.current) return
    const previous = roomRef.current
    if (
      previous?.gameId === next.gameId &&
      previous.game.revision > next.game.revision
    )
      return
    if (
      previous?.gameId === next.gameId &&
      next.game.revision > previous.game.revision
    ) {
      if (next.game.status === 'finished') playSound('win')
      else if (next.game.turn !== previous.game.turn) playSound('turn')
      else if (next.game.events[0]?.cardId) playSound('card')
    }
    roomRef.current = next
    setRoom(next)
    const url = new URL(location.href)
    url.searchParams.set('game', next.code)
    history.replaceState(null, '', url)
  }, [])

  const refresh = useCallback(
    async (code: string) => {
      const startedAt = generation.current
      const next = await gameRequest({ op: 'state', code })
      if (startedAt === generation.current) accept(next)
    },
    [accept],
  )

  useEffect(() => {
    mounted.current = true
    let cancelled = false
    async function restore() {
      try {
        if (initialCode && supabase) {
          const {
            data: { session },
          } = await supabase.auth.getSession()
          if (session && !cancelled) await refresh(initialCode)
        }
      } catch {
        /* An invite for a new player opens the join form. */
      } finally {
        if (!cancelled) setRestoring(false)
      }
    }
    void restore()
    return () => {
      cancelled = true
      mounted.current = false
    }
  }, [initialCode, refresh])

  const gameId = room?.gameId
  const meId = room?.game.meId
  const code = room?.code
  useEffect(() => {
    if (!gameId || !meId || !code || !supabase) return
    let live = true
    const sync = () => {
      void refresh(code).catch(() => {
        if (live) setConnected(false)
      })
    }
    const channel = supabase
      .channel(`game:${gameId}:${meId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'game_updates',
          filter: `game_id=eq.${gameId}`,
        },
        sync,
      )
      .subscribe((status) => {
        if (live) setConnected(status === 'SUBSCRIBED')
        if (status === 'SUBSCRIBED') sync()
      })
    const interval = window.setInterval(sync, 15_000)
    window.addEventListener('online', sync)
    const onVisible = () => {
      if (document.visibilityState === 'visible') sync()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      live = false
      void supabase!.removeChannel(channel)
      clearInterval(interval)
      window.removeEventListener('online', sync)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [gameId, meId, code, refresh])

  const send = useCallback(
    async (body: GameRequest) => {
      if (lock.current) return
      lock.current = true
      setBusy(true)
      setError('')
      const startedAt = generation.current
      try {
        const next = await gameRequest(body)
        if (startedAt === generation.current) accept(next)
      } catch (cause) {
        if (cause instanceof GameError && cause.stale && body.code) {
          await refresh(body.code).catch(() => undefined)
        }
        setError(
          cause instanceof Error
            ? cause.message
            : 'Something caught fire. Try again.',
        )
      } finally {
        lock.current = false
        setBusy(false)
      }
    },
    [accept, refresh],
  )

  function leave() {
    generation.current++
    roomRef.current = null
    setRoom(null)
    setError('')
    history.replaceState(null, '', location.pathname)
  }
  return {
    room,
    error,
    busy,
    restoring,
    connected,
    initialCode,
    send,
    leave,
    clearError: () => setError(''),
  }
}
