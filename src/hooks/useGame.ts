import { useCallback, useEffect, useRef, useState } from 'react'
import {
  gameRequest,
  GameError,
  supabase,
  type GameRequest,
  type GameResponse,
} from '../lib/api'
import { playCardSound, playSound } from '../lib/sound'
import { chooseAIAction } from '../lib/ai'
import { optimisticCardAction } from '../lib/optimistic'

export function useGame() {
  const initialCode =
    new URLSearchParams(location.search).get('game')?.toUpperCase() ?? ''
  const [room, setRoom] = useState<GameResponse | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [restoring, setRestoring] = useState(Boolean(initialCode))
  const roomRef = useRef<GameResponse | null>(null)
  const optimistic = useRef<GameResponse | null>(null)
  const lock = useRef(false)
  const mounted = useRef(true)
  const generation = useRef(0)

  const accept = useCallback((next: GameResponse) => {
    if (!mounted.current) return
    const confirmed = roomRef.current
    if (
      confirmed?.gameId === next.gameId &&
      (confirmed.game.revision > next.game.revision ||
        (optimistic.current && confirmed.game.revision === next.game.revision))
    )
      return
    const previous = optimistic.current ?? confirmed
    optimistic.current = null
    if (
      previous?.gameId === next.gameId &&
      next.game.revision > previous.game.revision
    ) {
      if (next.game.status === 'finished') playSound('win')
      else if (next.game.turn !== previous.game.turn) playSound('turn')
      else if (next.game.events[0]?.cardId) {
        const event = next.game.events[0]
        playCardSound(event.cardId!, event.discarded)
      }
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
    const sync = () => {
      void refresh(code).catch(() => undefined)
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
        if (status === 'SUBSCRIBED') sync()
      })
    const interval = window.setInterval(sync, 15_000)
    window.addEventListener('online', sync)
    const onVisible = () => {
      if (document.visibilityState === 'visible') sync()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
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
      const current = roomRef.current
      if (
        current &&
        body.op === 'action' &&
        body.code === current.code &&
        body.expectedRevision === current.game.revision &&
        !body.aiPlayerId &&
        body.action
      ) {
        const game = optimisticCardAction(current.game, body.action)
        if (game) {
          optimistic.current = { ...current, game }
          setRoom(optimistic.current)
          if (game.status === 'finished') playSound('win')
          else playCardSound(game.events[0].cardId!, game.events[0].discarded)
        }
      }
      try {
        const next = await gameRequest(body)
        if (startedAt === generation.current) accept(next)
      } catch (cause) {
        if (startedAt !== generation.current || !mounted.current) return
        if (optimistic.current) {
          optimistic.current = null
          setRoom(roomRef.current)
        }
        if (
          body.code &&
          (body.op === 'action' || (cause instanceof GameError && cause.stale))
        ) {
          await refresh(body.code).catch(() => undefined)
        }
        if (startedAt !== generation.current || !mounted.current) return
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

  useEffect(() => {
    if (
      !room ||
      busy ||
      room.game.meId !== room.game.hostId ||
      !room.game.aiHand
    )
      return
    const timer = window.setTimeout(() => {
      const action = chooseAIAction(room.game)
      if (action)
        void send({
          op: 'action',
          code: room.code,
          expectedRevision: room.game.revision,
          aiPlayerId: room.game.activePlayerId,
          action,
        })
    }, 750)
    return () => window.clearTimeout(timer)
  }, [room, busy, send])

  function leave() {
    generation.current++
    optimistic.current = null
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
    initialCode,
    send,
    leave,
    clearError: () => setError(''),
  }
}
