import {
  type CSSProperties,
  Fragment,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import {
  FiActivity,
  FiArrowRight,
  FiAward,
  FiCpu,
  FiAlertTriangle,
  FiRepeat,
  FiFastForward,
  FiLayers,
  FiLoader,
  FiZap,
} from 'react-icons/fi'
import {
  CARDS,
  ECONOMY,
  canPlay,
  type GameAction,
  type PlayerView,
} from '../../supabase/functions/_shared/engine'
import type { GameResponse } from '../lib/api'
import { Card } from './Card'
import { PairProgramming } from './PairProgramming'
import { TokenScore } from './TokenScore'

function format(value: number) {
  return value.toLocaleString()
}
function PlayerTile({
  player,
  active,
  winner,
  me,
  target,
}: {
  player: PlayerView
  active: boolean
  winner: boolean
  me: boolean
  target: number
}) {
  const pendingLabels = player.pending.map((effect) =>
    typeof effect === 'string'
      ? CARDS[effect].name
      : effect.skipTurn
        ? 'Rate Limited'
        : effect.disableCredits
          ? 'Budget Freeze'
          : effect.disableModels
            ? 'API Outage'
            : 'Next-turn effect',
  )
  return (
    <div
      className={`player-tile seat-${player.seat} ${active ? 'player-active' : ''} ${winner ? 'player-winner' : ''}`}
    >
      <div className="player-tile-top">
        <span className="player-avatar">
          {player.name.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0">
          <h2>
            <span className="player-name" title={player.name}>
              {player.name}
            </span>
            {me ? <small>YOU</small> : player.isAI ? <small>AI</small> : null}
          </h2>
          <div className="player-resources">
            <span>
              <FiZap />
              {format(player.credits)}
            </span>
            <span>
              <FiLayers />
              {player.handCount}
            </span>
            {player.pending.length ? (
              <span
                className="pending-chip"
                title={`Next turn: ${pendingLabels.join(', ')}`}
              >
                ! {pendingLabels.join(' · ')}
              </span>
            ) : null}
          </div>
        </div>
        {active ? (
          <span className="turn-indicator">
            <span className="status-dot" />
            LIVE
          </span>
        ) : null}
      </div>
      <div className="player-score">
        <TokenScore tokens={player.tokens} />
        <span>
          / {format(target)} <FiCpu aria-label="tokens" />
        </span>
      </div>
      <div className="score-track">
        <div
          style={{ width: `${Math.min(100, (player.tokens / target) * 100)}%` }}
        />
      </div>
    </div>
  )
}

export function GameTable({
  room,
  busy,
  onAction,
  onHome,
}: {
  room: GameResponse
  busy: boolean
  onAction: (action: GameAction) => void
  onHome: () => void
}) {
  const { game } = room
  const me = game.players.find((player) => player.id === game.meId)!
  const active = game.players.find(
    (player) => player.id === game.activePlayerId,
  )
  const winner = game.players.find((player) => player.id === game.winnerId)
  const isTurn =
    active?.id === me.id && game.status === 'playing' && !game.replenishing
  const remaining = active
    ? Math.max(0, active.actionLimit - active.actionsUsed)
    : 0
  const ownRemaining = Math.max(0, me.actionLimit - me.actionsUsed)
  const playersRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const row = playersRef.current
    const tile = row?.querySelector<HTMLElement>('.player-active')
    if (row && tile)
      row.scrollTo({
        left:
          tile.offsetLeft -
          row.offsetLeft -
          (row.clientWidth - tile.clientWidth) / 2,
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth',
      })
  }, [game.activePlayerId])
  const handRef = useRef<HTMLDivElement>(null)
  const playedRef = useRef<HTMLDivElement>(null)
  const discardRef = useRef<HTMLDivElement>(null)
  const previousTurn = useRef(game.turn)
  const previousDiscard = useRef<HTMLElement | null>(null)
  const cardPositions = useRef(
    new Map<
      HTMLElement,
      {
        left: number
        top: number
        width: number
        height: number
        viewportLeft: number
        viewportTop: number
        animation?: Animation
      }
    >(),
  )
  useLayoutEffect(() => {
    const next: typeof cardPositions.current = new Map()
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
    for (const container of [handRef.current, playedRef.current]) {
      for (const card of container?.querySelectorAll<HTMLElement>(
        '.hand-card, .played-card:not(.board-leaving)',
      ) ?? []) {
        const offset = parseFloat(getComputedStyle(card).left) || 0
        const left = card.offsetLeft - offset
        const previous = cardPositions.current.get(card)
        let animation = previous?.animation
        if (previous && Math.abs(previous.left - left) > 1) {
          animation?.cancel()
          if (!reducedMotion)
            animation = card.animate(
              [{ left: `${previous.left + offset - left}px` }, { left: '0px' }],
              { duration: 180, easing: 'ease-out' },
            )
        }
        next.set(card, {
          left,
          top: card.offsetTop,
          width: card.offsetWidth,
          height: card.offsetHeight,
          viewportLeft: card.getBoundingClientRect().left,
          viewportTop: card.getBoundingClientRect().top,
          animation,
        })
      }
    }
    const pile = discardRef.current
    const pileSnapshot = pile?.cloneNode(true) as HTMLElement | undefined
    pileSnapshot?.querySelector('[data-discard-overlay]')?.remove()
    for (const card of Array.from(
      pileSnapshot?.children ?? [],
    ) as HTMLElement[])
      card.style.visibility = ''
    const landingCards = Array.from(pile?.children ?? []).filter(
      (card) => !card.hasAttribute('data-discard-overlay'),
    ) as HTMLElement[]
    let flights = 0
    let oldPile: HTMLElement | null = null
    for (const [card, previous] of cardPositions.current) {
      if (next.has(card)) continue
      previous.animation?.cancel()
      if (!reducedMotion && card.matches('.played-card') && playedRef.current) {
        const destination =
          previousTurn.current !== game.turn
            ? discardRef.current?.getBoundingClientRect()
            : undefined
        if (destination) {
          if (flights === 0 && pile) {
            for (const landing of landingCards)
              landing.style.visibility = 'hidden'
            oldPile = previousDiscard.current
            if (oldPile) {
              oldPile.setAttribute('data-discard-overlay', '')
              oldPile.setAttribute('aria-hidden', 'true')
              oldPile.inert = true
              Object.assign(oldPile.style, {
                position: 'absolute',
                inset: '0',
                width: '100%',
                height: '100%',
                border: '0',
                pointerEvents: 'none',
              })
              pile.append(oldPile)
            }
          }
          flights++
        }
        const leaving = card.cloneNode(true) as HTMLElement
        leaving.classList.add('board-leaving')
        leaving.setAttribute('aria-hidden', 'true')
        leaving.inert = true
        Object.assign(leaving.style, {
          left: `${previous.left}px`,
          top: `${previous.top}px`,
          width: `${previous.width}px`,
          height: `${previous.height}px`,
        })
        if (destination)
          Object.assign(leaving.style, {
            position: 'fixed',
            left: `${previous.viewportLeft}px`,
            top: `${previous.viewportTop}px`,
            margin: '0',
            transformOrigin: 'top left',
          })
        const flightContainer = destination
          ? playedRef.current.closest('.play-surface')!
          : playedRef.current
        flightContainer.append(leaving)
        leaving.animate(
          [
            { opacity: 1, transform: 'translateY(0)' },
            destination
              ? {
                  opacity: 1,
                  transform: `translate(${destination.left - previous.viewportLeft}px, ${destination.top - previous.viewportTop}px) scale(${destination.width / previous.width}, ${destination.height / previous.height})`,
                }
              : { opacity: 0, transform: 'translateY(30px) scale(.96)' },
          ],
          {
            duration: destination ? 260 : 160,
            delay: destination ? (flights - 1) * 35 : 0,
            easing: 'ease-in-out',
            fill: 'both',
          },
        ).onfinish = () => {
          if (destination && --flights === 0) {
            for (const landing of landingCards) landing.style.visibility = ''
            oldPile?.remove()
          }
          leaving.remove()
        }
      }
    }
    previousDiscard.current = pileSnapshot ?? null
    cardPositions.current = next
    previousTurn.current = game.turn
  }, [me.hand, game.events, remaining, game.turn])
  const [motion, setMotion] = useState({
    revision: game.revision,
    hand: me.hand,
    arriving: me.hand?.map((card) => card.instanceId) ?? [],
    stolen: [] as NonNullable<typeof me.hand>,
  })
  if (motion.revision !== game.revision) {
    const stolenIds = new Set(
      game.events
        .filter(
          (event) =>
            event.stolenFromId === me.id &&
            event.id > 0 &&
            event.cardInstanceId &&
            !me.hand?.some((c) => c.instanceId === event.cardInstanceId),
        )
        .map((event) => event.cardInstanceId),
    )
    setMotion({
      revision: game.revision,
      hand: me.hand,
      arriving: (me.hand ?? [])
        .filter(
          (card) =>
            !motion.hand?.some(
              (previous) => previous.instanceId === card.instanceId,
            ),
        )
        .map((card) => card.instanceId),
      stolen: (motion.hand ?? []).filter((c) => stolenIds.has(c.instanceId)),
    })
  }
  const refill =
    active?.id === me.id &&
    game.events.find(
      (event) =>
        event.turn === game.turn &&
        event.playerId === game.activePlayerId &&
        event.creditRefill !== undefined,
    )
  const turnPlays = game.events
    .filter(
      (event) =>
        event.cardId && !event.stolenFromId && event.turn === game.turn,
    )
    .reverse()

  const previousPlays = game.events.filter(
    (event) => event.cardId && !event.stolenFromId && event.turn < game.turn,
  )
  const discardPlays = previousPlays
    .filter((event) => event.turn === previousPlays[0]?.turn)
    .reverse()

  return (
    <main className="game-view">
      <section
        ref={playersRef}
        className={`players-row ${winner ? 'players-celebrating' : ''}`}
        aria-label="Players"
        tabIndex={0}
      >
        {game.players.map((player, index) => (
          <Fragment key={player.id}>
            {index > 0 ? (
              <span
                className="player-join"
                role="img"
                aria-label={
                  game.direction === -1 ? 'Play moves left' : 'Play moves right'
                }
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 18 18"
                  fill="none"
                  aria-hidden="true"
                  style={{ scale: game.direction === -1 ? '-1 1' : '1 1' }}
                >
                  <path d="M6 2l6 8-6 8" />
                </svg>
              </span>
            ) : null}
            <PlayerTile
              player={player}
              active={active?.id === player.id}
              winner={winner?.id === player.id}
              me={player.id === me.id}
              target={game.victoryTarget}
            />
          </Fragment>
        ))}
      </section>
      <div className="board-layout">
        <section
          className={`table-space ${isTurn ? 'table-active' : 'table-waiting'}`}
          aria-label="Play area"
        >
          <div className="table-topline">
            <span className="turn-announcement">
              {winner
                ? null
                : isTurn
                  ? 'Your move.'
                  : `${active?.name} is cooking.`}
            </span>
            <div className="active-effects">
              {active?.costMultiplier !== undefined &&
              active.costMultiplier !== 1 ? (
                <span
                  title={`Credit cost ×${active.costMultiplier}`}
                  aria-label={`Credit cost ×${active.costMultiplier}`}
                >
                  <FiZap /> Credit cost ×{active.costMultiplier}
                </span>
              ) : null}
              {active?.yieldMultiplier !== undefined &&
              active.yieldMultiplier !== 1 ? (
                <span
                  title={`Token yield ×${active.yieldMultiplier}`}
                  aria-label={`Token yield ×${active.yieldMultiplier}`}
                >
                  <FiCpu /> Token yield ×{active.yieldMultiplier}
                </span>
              ) : null}
              {active?.modelBlocked ? (
                <span
                  className="effect-danger"
                  title="Models blocked"
                  aria-label="Models blocked"
                >
                  <FiAlertTriangle /> Models blocked
                </span>
              ) : null}
              {active?.unlimitedEngineering ? (
                <span
                  title="Engineering uses no actions"
                  aria-label="Engineering uses no actions"
                >
                  <FiFastForward /> Engineering uses no actions
                </span>
              ) : null}
              {active?.mustEmptyHand ? (
                <span
                  title="Play your entire hand"
                  aria-label="Play your entire hand"
                >
                  <FiRepeat /> Play your entire hand
                </span>
              ) : null}
            </div>
          </div>
          {winner ? (
            <div className="victory-panel">
              <span className="winner-icon">
                <FiAward />
              </span>
              <h1>
                {winner.id === me.id
                  ? 'You shipped it.'
                  : `${winner.name} shipped it.`}
              </h1>
              <p>
                {format(winner.tokens)} tokens. Unmeasurable technical debt.
              </p>
              <button className="button-primary" onClick={onHome}>
                Run it back
                <FiArrowRight />
              </button>
            </div>
          ) : (
            <div className="play-surface">
              <div className="card-piles">
                <div
                  className="deck-stack"
                  aria-label={`${game.deckCount} cards left in the deck`}
                >
                  <FiLayers aria-hidden="true" />
                  <strong>{game.deckCount}</strong>
                  <span>cards left</span>
                </div>
                <div
                  className="discard-pile"
                  ref={discardRef}
                  role="group"
                  tabIndex={0}
                  aria-label={
                    discardPlays.length
                      ? `Previous turn: ${discardPlays.map((event) => CARDS[event.cardId!].name).join(', ')}`
                      : 'Discard pile, empty'
                  }
                >
                  {discardPlays.map((event, index) => (
                    <div
                      className="discard-card played-card"
                      key={event.cardInstanceId ?? event.id}
                      style={
                        {
                          '--discard-index': index,
                          '--discard-count': discardPlays.length,
                        } as CSSProperties
                      }
                    >
                      <Card
                        card={CARDS[event.cardId!]}
                        compact
                        discarded={
                          event.discarded ??
                          event.text.endsWith(
                            ` binned ${CARDS[event.cardId!].name}.`,
                          )
                        }
                        economics={event.economics}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div
                className="played-cards"
                style={
                  {
                    '--play-count': turnPlays.length + remaining,
                    gridTemplateColumns:
                      turnPlays.length + remaining <= 1
                        ? 'var(--played-card-width)'
                        : undefined,
                  } as CSSProperties
                }
                ref={playedRef}
                role="group"
                aria-label={`Cards played this turn, ${remaining} normal actions remaining`}
              >
                {turnPlays.map((event, index) => {
                  const card = CARDS[event.cardId!]
                  const discarded =
                    event.discarded ??
                    event.text.endsWith(` binned ${card.name}.`)
                  const canUndo =
                    isTurn &&
                    Boolean(event.cardInstanceId) &&
                    event.cardInstanceId === game.undoCardInstanceId
                  const content = (
                    <>
                      <Card
                        card={card}
                        compact
                        discarded={discarded}
                        economics={event.economics}
                      />
                      <span className="play-number">{index + 1}</span>
                    </>
                  )
                  const className = `played-card action-space ${!discarded && (card.kind === 'mode' || card.kind === 'model') ? 'status-card' : ''}`
                  return (
                    <button
                      type="button"
                      className={`${className} undo-card`}
                      key={event.cardInstanceId ?? event.id}
                      disabled={!canUndo || busy}
                      onClick={() => onAction({ type: 'undo' })}
                      aria-label={`${canUndo ? 'Undo' : discarded ? 'Discarded' : 'Played'} ${card.name}`}
                      data-card-id={card.id}
                    >
                      {content}
                    </button>
                  )
                })}
                {Array.from({ length: remaining }, (_, index) => (
                  <div
                    key={`space-${turnPlays.length + index}`}
                    className="action-space empty-action-space"
                    aria-hidden="true"
                  />
                ))}
              </div>
              <div className="play-controls">
                <button
                  className="button-primary end-turn"
                  disabled={
                    !isTurn || busy || (me.mustEmptyHand && me.handCount > 0)
                  }
                  onClick={() => onAction({ type: 'end-turn' })}
                >
                  End turn
                  {busy ? <FiLoader className="spin" /> : <FiArrowRight />}
                </button>
              </div>
            </div>
          )}
        </section>
        <aside className="activity-panel">
          <div className="activity-heading">
            <FiActivity />
            <h2>The changelog</h2>
            <span className="status-dot" />
          </div>
          <div
            className="activity-list"
            aria-live="polite"
            aria-relevant="additions"
          >
            {game.events.slice(0, 12).map((event) => (
              <div
                className={`activity-event event-${event.tone}`}
                key={event.id}
              >
                <span className="event-marker" />
                <p>{event.text}</p>
              </div>
            ))}
          </div>
        </aside>
      </div>
      <section className="hand-section" aria-label="Your hand">
        <div
          className="credits-meter"
          role="meter"
          aria-label="Available credits"
          aria-valuemin={0}
          aria-valuemax={ECONOMY.creditCap}
          aria-valuenow={me.credits}
        >
          {refill && refill.creditRefill! > 0 ? (
            <div
              key={refill.id}
              className="credit-particles"
              aria-hidden="true"
            >
              {Array.from({ length: 12 }, (_, index) => (
                <i
                  key={index}
                  style={{
                    left: `${25 + (index % 4) * 16}%`,
                    top: `${20 + (index % 5) * 14}%`,
                    animationDelay: `${index * 25}ms`,
                    rotate: `${index * 137}deg`,
                  }}
                />
              ))}
            </div>
          ) : null}
          <div className="credits-track">
            <div
              className="credits-fill"
              style={{
                height: `${Math.max(0, Math.min(1, me.credits / ECONOMY.creditCap)) * 100}%`,
              }}
            />
          </div>
          <strong>{format(me.credits)}</strong>
          <span>credits</span>
        </div>
        {motion.stolen.map((instance) => (
          <div
            key={`stolen-${instance.instanceId}`}
            className="snatched-card"
            onAnimationEnd={() =>
              setMotion((current) => ({ ...current, stolen: [] }))
            }
            role="status"
            aria-label={`${instance.card.name} was taken by Pair Programming`}
          >
            <Card card={instance.card} />
          </div>
        ))}

        <div className="hand-cards" ref={handRef}>
          {me.hand?.map((instance, index, hand) => {
            const angle =
              hand.length > 1 ? -2 + (index * 4) / (hand.length - 1) : 0
            const playable = canPlay(game, me, instance.card)
            const slotCost =
              instance.card.kind === 'engineering'
                ? (me.engineeringCardsSlotCost ??
                  (me.unlimitedEngineering ? 0 : 1))
                : 1
            const free = slotCost === 0
            const allowed =
              isTurn && !busy && (ownRemaining >= slotCost || me.mustEmptyHand)
            const action = playable ? 'Play' : 'Discard'
            const arrivalIndex = motion.arriving.indexOf(instance.instanceId)
            return (
              <button
                key={instance.instanceId}
                className={`hand-card ${arrivalIndex >= 0 ? 'hand-card-enter' : ''} ${!playable ? 'unplayable' : ''}`}
                style={{
                  rotate: `${angle}deg`,
                  translate: `0 ${angle ** 2 * 1.5}px`,
                  animationDelay:
                    arrivalIndex >= 0 ? `${arrivalIndex * 55}ms` : undefined,
                }}
                disabled={!allowed}
                onClick={() =>
                  onAction({
                    type: playable ? 'play' : 'discard',
                    cardInstanceId: instance.instanceId,
                  })
                }
                aria-label={`${action} ${instance.card.name}${free ? ', bonus play' : ''}`}
                title={
                  !isTurn
                    ? 'Waiting for your turn'
                    : `${action} ${instance.card.name}${!playable ? ' — no legal effect' : ''}`
                }
                data-card-id={instance.instanceId}
              >
                <Card
                  card={instance.card}
                  player={me}
                  className={
                    !playable && instance.card.effect.replenishFromPlayers
                      ? 'card-unavailable'
                      : ''
                  }
                />
              </button>
            )
          })}
        </div>
      </section>
      {game.replenishing && active?.id === me.id ? (
        <PairProgramming
          players={game.players.filter(
            (p) => p.id === game.pairProgrammingTargetId,
          )}
          remaining={7 - me.handCount}
          busy={busy}
          onTake={(cardInstanceId) =>
            onAction({ type: 'take-card', cardInstanceId })
          }
          onFinish={() => onAction({ type: 'finish-replenishing' })}
        />
      ) : null}
    </main>
  )
}
