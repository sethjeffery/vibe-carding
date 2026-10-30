import { useState } from 'react'
import {
  FiArrowRight,
  FiCheck,
  FiCode,
  FiCopy,
  FiHelpCircle,
  FiLoader,
  FiLogOut,
  FiPlus,
  FiRadio,
  FiUsers,
  FiVolume2,
  FiVolumeX,
  FiX,
  FiZap,
} from 'react-icons/fi'
import { CARDS } from '../supabase/functions/_shared/engine'
import { Card } from './components/Card'
import { GameTable } from './components/GameTable'
import { Rules } from './components/Rules'
import { useGame } from './hooks/useGame'
import { isSoundEnabled, playSound, setSound } from './lib/sound'

function App() {
  const {
    room,
    error,
    busy,
    restoring,
    connected,
    initialCode,
    send,
    leave,
    clearError,
  } = useGame()
  const [name, setName] = useState(
    () => localStorage.getItem('vibe-name') ?? '',
  )
  const [joinCode, setJoinCode] = useState(initialCode)
  const [joining, setJoining] = useState(Boolean(initialCode))
  const [rules, setRules] = useState(false)
  const [sound, updateSound] = useState(isSoundEnabled)
  const [copied, setCopied] = useState(false)
  const [target, setTarget] = useState(10000)

  function saveName(value: string) {
    setName(value)
    localStorage.setItem('vibe-name', value)
  }
  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }
  return (
    <div
      className={`app-shell ${room?.game.status === 'playing' || room?.game.status === 'finished' ? 'in-game' : ''}`}
    >
      <header className="site-header">
        <a
          className="brand"
          href="/"
          onClick={(event) => {
            if (room) {
              event.preventDefault()
              leave()
              setJoining(false)
            }
          }}
          aria-label="Vibe Carding home"
        >
          <span className="brand-mark">
            <FiCode />
          </span>
          <span>
            vibe<span className="text-lime">carding</span>
            <span className="brand-dot">.</span>
          </span>
        </a>
        <div className="header-actions">
          {room ? (
            <button
              className="room-code"
              onClick={() => void copyInvite()}
              aria-label="Copy game invite"
            >
              <span className="status-dot" />
              {room.code}
              {copied ? <FiCheck /> : <FiCopy />}
            </button>
          ) : (
            <span className="desktop-only header-label">
              <span className="status-dot" />
              MULTIPLAYER / v0.1
            </span>
          )}
          <button
            className="icon-button"
            title="How to play"
            aria-label="How to play"
            onClick={() => setRules(true)}
          >
            <FiHelpCircle />
          </button>
          <button
            className="icon-button"
            title={sound ? 'Mute sound' : 'Enable sound'}
            aria-label={sound ? 'Mute sound' : 'Enable sound'}
            onClick={() => {
              setSound(!sound)
              updateSound(!sound)
              if (!sound) playSound('card')
            }}
          >
            {sound ? <FiVolume2 /> : <FiVolumeX />}
          </button>
          {room ? (
            <button
              className="icon-button"
              aria-label="Leave table"
              title="Leave table"
              onClick={() => {
                leave()
                setJoining(false)
              }}
            >
              <FiLogOut />
            </button>
          ) : null}
        </div>
      </header>

      {restoring ? (
        <main className="loading-view">
          <FiLoader className="spin" />
          <p>Restoring your branch…</p>
        </main>
      ) : !room ? (
        <main className="home-view">
          <section className="hero-copy">
            <div className="hero-tag">
              <FiUsers />
              2–4 PLAYERS
              <span />
              ZERO CODE REVIEWS
            </div>
            <h1>
              VIBE <span className="line-through-title">CODING</span>
              <br />
              <span className="text-lime">CARDING.</span>
            </h1>
            <p className="hero-description">
              Play your cards right.
              <br />
              First player to burn {target.toLocaleString()} tokens wins.
            </p>
            <form
              className="entry-form"
              onSubmit={(event) => {
                event.preventDefault()
                void send({
                  op: joining ? 'join' : 'create',
                  name: name.trim(),
                  code: joining ? joinCode : undefined,
                })
              }}
            >
              <label className="field-label" htmlFor="player-name">
                PLAYER NAME
              </label>
              <div className="name-field">
                <FiCode aria-hidden="true" />
                <input
                  id="player-name"
                  value={name}
                  onChange={(event) => saveName(event.target.value)}
                  placeholder="Vibe Coder CEO"
                  maxLength={20}
                  required
                  autoComplete="nickname"
                />
              </div>
              {joining ? (
                <>
                  <label className="field-label mt-4" htmlFor="game-code">
                    INVITE CODE
                  </label>
                  <input
                    id="game-code"
                    className="code-input"
                    placeholder="ABC123"
                    value={joinCode}
                    onChange={(event) =>
                      setJoinCode(
                        event.target.value
                          .toUpperCase()
                          .replace(/[^A-Z2-9]/g, '')
                          .slice(0, 6),
                      )
                    }
                    minLength={6}
                    maxLength={6}
                    required
                    autoComplete="off"
                  />
                </>
              ) : null}
              <button className="button-primary mt-4 w-full" disabled={busy}>
                {busy ? (
                  <FiLoader className="spin" />
                ) : joining ? (
                  <FiArrowRight />
                ) : (
                  <FiPlus />
                )}
                {joining ? 'Join the chaos' : 'Create a game'}
                {!busy ? <FiArrowRight className="ml-auto" /> : null}
              </button>
              <button
                type="button"
                className="join-toggle"
                onClick={() => {
                  setJoining(!joining)
                  clearError()
                }}
              >
                {joining
                  ? 'Start a fresh game instead'
                  : 'Got an invite code? Join a game'}
                <FiArrowRight />
              </button>
            </form>
          </section>
          <section className="hero-deck" aria-label="A taste of the deck">
            <span className="hero-floating floating-top">
              <span className="status-dot" />
              ALL VIBES. NO QA.
            </span>
            <Card card={CARDS.backend} className="hero-card hero-card-back" />
            <Card card={CARDS.fable} className="hero-card hero-card-middle" />
            <Card card={CARDS.yolo} className="hero-card hero-card-front" />
            <div className="floating-code">
              git push --force <span className="cursor">▊</span>
            </div>
            <span className="hero-sticker">
              <FiZap />
              /shipit
            </span>
          </section>
          <footer className="home-footer">
            <div>
              <strong>7</strong>
              <span>CARDS IN HAND</span>
            </div>
            <div>
              <strong>3</strong>
              <span>ACTIONS PER TURN</span>
            </div>
            <div>
              <strong>∞</strong>
              <span>QUESTIONABLE DECISIONS</span>
            </div>
            <button onClick={() => setRules(true)}>
              Read the README <FiArrowRight />
            </button>
          </footer>
        </main>
      ) : room.game.status === 'lobby' ? (
        <main className="lobby-view">
          <div className="lobby-heading">
            <span className="hero-tag">
              <FiRadio />
              LOBBY OPEN
            </span>
            <h1>
              Gather the
              <br />
              <span className="text-lime">players.</span>
            </h1>
            <p>Or just invite whoever’s online.</p>
          </div>
          <section className="lobby-panel">
            <div className="invite-row">
              <div>
                <span className="field-label">YOUR GAME CODE</span>
                <strong>{room.code}</strong>
              </div>
              <button
                className="button-secondary"
                onClick={() => void copyInvite()}
              >
                {copied ? <FiCheck /> : <FiCopy />}
                {copied ? 'Copied!' : 'Copy invite'}
              </button>
            </div>
            <div className="lobby-seats">
              {Array.from({ length: 4 }, (_, seat) => {
                const player = room.game.players[seat]
                return (
                  <div
                    key={seat}
                    className={`lobby-seat ${player ? `seat-${seat}` : 'empty-seat'}`}
                  >
                    <span className="player-avatar">
                      {player ? (
                        player.name.slice(0, 2).toUpperCase()
                      ) : (
                        <FiPlus />
                      )}
                    </span>
                    <div>
                      <strong>{player?.name ?? 'Open seat'}</strong>
                      <small>
                        {player
                          ? player.id === room.game.hostId
                            ? 'HOST'
                            : 'READY TO SHIP'
                          : 'WAITING FOR A RIVAL'}
                      </small>
                    </div>
                    {player ? <FiCheck className="text-lime ml-auto" /> : null}
                  </div>
                )
              })}
            </div>
            <div className="lobby-settings">
              <label htmlFor="target">TOKEN TARGET</label>
              {room.game.meId === room.game.hostId ? (
                <select
                  id="target"
                  value={target}
                  disabled={room.game.meId !== room.game.hostId}
                  onChange={(event) => setTarget(Number(event.target.value))}
                >
                  <option value={3000}>3,000 · Quick sprint</option>
                  <option value={5000}>5,000 · Regular sprint</option>
                  <option value={10000}>10,000 · Spec edition</option>
                </select>
              ) : (
                <span className="text-xs text-zinc-400">
                  Chosen by the host
                </span>
              )}
            </div>
            {room.game.hostId === room.game.meId ? (
              <button
                className="button-primary w-full"
                disabled={busy || room.game.players.length < 2}
                onClick={() =>
                  void send({
                    op: 'start',
                    code: room.code,
                    expectedRevision: room.game.revision,
                    target,
                  })
                }
              >
                {busy ? <FiLoader className="spin" /> : <FiZap />}Start the
                sprint
                <FiArrowRight className="ml-auto" />
              </button>
            ) : (
              <div className="waiting-host">
                <FiLoader className="spin" />
                Waiting for the host to start…
              </div>
            )}
            <p className="lobby-note">
              {room.game.players.length < 2
                ? 'Invite at least one rival to get started.'
                : `${room.game.players.length} players connected. Let’s make something worse.`}
            </p>
          </section>
          <div className="lobby-connection">
            <span className={`status-dot ${connected ? '' : 'status-amber'}`} />
            {connected ? 'LIVE CONNECTION' : 'CONNECTING…'}
          </div>
        </main>
      ) : (
        <GameTable
          room={room}
          busy={busy}
          onAction={(action) =>
            void send({
              op: 'action',
              code: room.code,
              expectedRevision: room.game.revision,
              action,
            })
          }
          onHome={() => {
            leave()
            setJoining(false)
          }}
        />
      )}

      {error ? (
        <div className="error-toast" role="alert">
          <span>{error}</span>
          <button onClick={clearError} aria-label="Dismiss error">
            <FiX />
          </button>
        </div>
      ) : null}
      {rules ? <Rules onClose={() => setRules(false)} /> : null}
    </div>
  )
}
export default App
