// NightOfNinja.jsx
// Mobile-first cyber-shinobi UI. True-black ground, neon house accents,
// angular cards, slash animations on kills, slow ink-smoke background.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { HOUSES, RANKS, RANK_ORDER } from './CardDefinitions';

const SERVER_URL = process.env.REACT_APP_SERVER_URL || 'http://localhost:3001';

// ---------------------------------------------------------------------------
// SVG silhouettes — minimal, angular, evocative. One per rank.
// All draw inside a 100x140 viewBox to compose with card frames.
// ---------------------------------------------------------------------------
function Silhouette({ rank, color }) {
  const stroke = color;
  const fill = color + '22'; // soft fill
  const common = { stroke, fill, strokeWidth: 1.2, strokeLinejoin: 'miter' };
  switch (rank) {
    case 1: // Mystic — figure with halo of dots
      return (
        <g {...common}>
          <circle cx="50" cy="40" r="14" />
          <path d="M36 56 L64 56 L70 110 L30 110 Z" />
          <circle cx="50" cy="22" r="2" fill={stroke} />
          <circle cx="30" cy="32" r="1.5" fill={stroke} />
          <circle cx="70" cy="32" r="1.5" fill={stroke} />
          <circle cx="22" cy="50" r="1.5" fill={stroke} />
          <circle cx="78" cy="50" r="1.5" fill={stroke} />
        </g>
      );
    case 2: // Blind Assassin — hooded figure with crossed line over eyes
      return (
        <g {...common}>
          <path d="M50 22 L72 42 L72 60 L60 70 L60 110 L40 110 L40 70 L28 60 L28 42 Z" />
          <line x1="32" y1="44" x2="68" y2="44" stroke={stroke} strokeWidth="2" />
        </g>
      );
    case 3: // Shinobi — crouched, blade in hand
      return (
        <g {...common}>
          <circle cx="50" cy="36" r="11" />
          <path d="M40 47 L60 47 L66 80 L62 110 L38 110 L34 80 Z" />
          <line x1="62" y1="60" x2="86" y2="44" stroke={stroke} strokeWidth="2" />
          <line x1="80" y1="38" x2="92" y2="38" stroke={stroke} strokeWidth="3" />
        </g>
      );
    case 4: // Spy — figure with monocle/scope
      return (
        <g {...common}>
          <circle cx="50" cy="38" r="12" />
          <circle cx="56" cy="38" r="5" fill="none" strokeWidth="2" />
          <path d="M38 50 L62 50 L66 110 L34 110 Z" />
        </g>
      );
    case 5: // Bodyguard — broad figure, shield
      return (
        <g {...common}>
          <circle cx="50" cy="32" r="10" />
          <path d="M30 44 L70 44 L74 110 L26 110 Z" />
          <path d="M44 60 L56 60 L58 90 L50 96 L42 90 Z" fill={stroke} opacity="0.5" />
        </g>
      );
    case 6: // Diplomat — figure with scroll
      return (
        <g {...common}>
          <circle cx="50" cy="36" r="11" />
          <path d="M38 48 L62 48 L66 110 L34 110 Z" />
          <rect x="56" y="62" width="22" height="6" fill={stroke} opacity="0.5" />
          <rect x="56" y="74" width="22" height="6" fill={stroke} opacity="0.5" />
        </g>
      );
    case 7: // Samurai — armored, katana
      return (
        <g {...common}>
          <path d="M40 22 L60 22 L66 32 L60 38 L40 38 L34 32 Z" />
          <path d="M36 40 L64 40 L70 110 L30 110 Z" />
          <line x1="68" y1="46" x2="92" y2="22" stroke={stroke} strokeWidth="2.5" />
        </g>
      );
    case 8: // Daimyo — tall hat, formal
      return (
        <g {...common}>
          <path d="M30 18 L70 18 L66 36 L34 36 Z" />
          <circle cx="50" cy="44" r="9" />
          <path d="M34 54 L66 54 L72 110 L28 110 Z" />
        </g>
      );
    case 9: // Oracle — flowing robes, third eye
      return (
        <g {...common}>
          <circle cx="50" cy="36" r="11" />
          <circle cx="50" cy="34" r="2" fill={stroke} />
          <path d="M30 48 L70 48 L78 110 L22 110 Z" />
        </g>
      );
    case 10: // Shogun — crown of horns/helm
      return (
        <g {...common}>
          <path d="M30 24 L40 12 L50 22 L60 12 L70 24 L70 38 L30 38 Z" />
          <path d="M34 40 L66 40 L72 110 L28 110 Z" />
        </g>
      );
    case 11: // Shinobi Spirit — wisp / fragmented
      return (
        <g {...common} opacity="0.85">
          <circle cx="50" cy="36" r="10" strokeDasharray="3 2" />
          <path d="M36 48 L64 48 L68 90 L60 110 L40 110 L32 90 Z" strokeDasharray="3 2" />
          <circle cx="20" cy="60" r="1.5" fill={stroke} />
          <circle cx="82" cy="80" r="1.5" fill={stroke} />
          <circle cx="78" cy="30" r="1.5" fill={stroke} />
        </g>
      );
    default:
      return null;
  }
}

// Geometric back pattern per house
function CardBack({ house }) {
  const h = HOUSES[house] || HOUSES.CRANE;
  return (
    <svg viewBox="0 0 100 140" className="w-full h-full">
      <rect width="100" height="140" fill="#000" />
      <g stroke={h.accent} fill="none" strokeWidth="0.6" opacity="0.7">
        {[20, 40, 60, 80].map((r) => (
          <circle key={r} cx="50" cy="70" r={r} />
        ))}
        <line x1="0" y1="70" x2="100" y2="70" />
        <line x1="50" y1="0" x2="50" y2="140" />
        <line x1="10" y1="20" x2="90" y2="120" />
        <line x1="90" y1="20" x2="10" y2="120" />
      </g>
      <text
        x="50"
        y="78"
        textAnchor="middle"
        fill={h.accent}
        fontSize="20"
        fontFamily="serif"
        style={{ filter: `drop-shadow(0 0 4px ${h.accent})` }}
      >
        {house === 'CRANE' ? '鶴' : '蓮'}
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Card component — front shows rank, glyph, silhouette; selectable
// ---------------------------------------------------------------------------
function Card({ card, house, selected, onClick, faceDown, dimmed, small }) {
  const h = HOUSES[house] || HOUSES.CRANE;
  const r = RANKS[card?.rank];
  const accent = h.accent;
  const size = small ? 'w-20 h-28' : 'w-28 h-40 sm:w-32 sm:h-44';

  if (faceDown) {
    return (
      <div className={`${size} relative`}>
        <div
          className="absolute inset-0 border"
          style={{
            borderColor: accent,
            background: '#000',
            boxShadow: `0 0 12px ${accent}33, inset 0 0 12px ${accent}22`,
          }}
        >
          <CardBack house={house} />
        </div>
      </div>
    );
  }

  if (!r) return null;

  return (
    <button
      onClick={onClick}
      className={`${size} relative group transition-all duration-200 ${
        selected ? 'translate-y-[-8px]' : ''
      } ${dimmed ? 'opacity-40' : ''}`}
      style={{
        filter: selected ? `drop-shadow(0 0 14px ${accent})` : 'none',
      }}
    >
      <div
        className="absolute inset-0 border"
        style={{
          borderColor: accent,
          background: 'linear-gradient(180deg, #000 0%, #0a0a0a 100%)',
          boxShadow: selected
            ? `0 0 20px ${accent}, inset 0 0 20px ${accent}33`
            : `0 0 8px ${accent}22, inset 0 0 8px ${accent}11`,
        }}
      >
        {/* Top strip with rank */}
        <div
          className="flex items-center justify-between px-2 py-1 border-b"
          style={{ borderColor: accent + '55' }}
        >
          <span
            className="text-xl font-black tracking-tight"
            style={{ color: accent, fontFamily: 'Oswald, sans-serif' }}
          >
            {r.rank.toString().padStart(2, '0')}
          </span>
          <span
            className="text-lg"
            style={{ color: accent, filter: `drop-shadow(0 0 3px ${accent})` }}
          >
            {r.glyph}
          </span>
        </div>
        {/* Silhouette */}
        <div className="px-2">
          <svg viewBox="0 0 100 110" className="w-full">
            <Silhouette rank={r.rank} color={accent} />
          </svg>
        </div>
        {/* Name */}
        <div
          className="absolute bottom-0 left-0 right-0 text-center py-1 border-t"
          style={{
            borderColor: accent + '55',
            background: '#000',
          }}
        >
          <div
            className="text-[10px] tracking-[0.2em] uppercase"
            style={{ color: accent, fontFamily: 'Oswald, sans-serif' }}
          >
            {r.name}
          </div>
        </div>
        {/* Corner notches */}
        <div
          className="absolute top-0 left-0 w-2 h-2"
          style={{ borderTop: `2px solid ${accent}`, borderLeft: `2px solid ${accent}` }}
        />
        <div
          className="absolute top-0 right-0 w-2 h-2"
          style={{ borderTop: `2px solid ${accent}`, borderRight: `2px solid ${accent}` }}
        />
        <div
          className="absolute bottom-0 left-0 w-2 h-2"
          style={{ borderBottom: `2px solid ${accent}`, borderLeft: `2px solid ${accent}` }}
        />
        <div
          className="absolute bottom-0 right-0 w-2 h-2"
          style={{ borderBottom: `2px solid ${accent}`, borderRight: `2px solid ${accent}` }}
        />
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Slow ink-particle background (CSS-only, GPU-friendly)
// ---------------------------------------------------------------------------
function InkBackground() {
  const particles = useMemo(
    () =>
      Array.from({ length: 14 }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        size: 200 + Math.random() * 300,
        delay: Math.random() * 30,
        duration: 40 + Math.random() * 40,
        opacity: 0.04 + Math.random() * 0.06,
      })),
    []
  );
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.left}%`,
            bottom: `-${p.size}px`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            background:
              'radial-gradient(circle, rgba(125,249,255,0.3) 0%, rgba(255,61,90,0.15) 40%, transparent 70%)',
            opacity: p.opacity,
            filter: 'blur(40px)',
            animation: `inkrise ${p.duration}s ease-in ${p.delay}s infinite`,
          }}
        />
      ))}
      {/* Grid overlay */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(125,249,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(125,249,255,0.03) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Player avatar — minimal, with kill slash overlay when dead
// ---------------------------------------------------------------------------
function PlayerChip({ player, isMe, selectable, onClick, selected, accent }) {
  const dead = !player.alive;
  return (
    <button
      onClick={onClick}
      disabled={!selectable}
      className={`relative flex flex-col items-center gap-1 p-2 transition-all ${
        selectable ? 'cursor-pointer hover:scale-105' : 'cursor-default'
      } ${selected ? 'scale-110' : ''}`}
      style={{
        filter: selected ? `drop-shadow(0 0 8px ${accent || '#fff'})` : 'none',
      }}
    >
      <div
        className="w-12 h-12 sm:w-14 sm:h-14 border flex items-center justify-center relative"
        style={{
          borderColor: dead ? '#444' : accent || '#fff',
          background: '#000',
          boxShadow: dead ? 'none' : `0 0 8px ${(accent || '#fff') + '44'}`,
        }}
      >
        <span
          className="text-lg font-black"
          style={{
            color: dead ? '#444' : accent || '#fff',
            fontFamily: 'Oswald, sans-serif',
          }}
        >
          {player.name?.[0]?.toUpperCase() || '?'}
        </span>
        {dead && (
          <>
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  'linear-gradient(135deg, transparent 47%, #FF3D5A 49%, #FF3D5A 51%, transparent 53%)',
                animation: 'slash 0.6s ease-out',
              }}
            />
            <div className="absolute inset-0 bg-black/50" />
          </>
        )}
        {isMe && (
          <div
            className="absolute -top-1 -right-1 w-2 h-2 rounded-full"
            style={{ background: accent || '#fff', boxShadow: `0 0 4px ${accent}` }}
          />
        )}
      </div>
      <div className="text-[10px] uppercase tracking-widest text-zinc-400 max-w-[60px] truncate">
        {player.name}
      </div>
      {player.honorKills > 0 && (
        <div className="text-[9px] text-amber-400">⚔ {player.honorKills}</div>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// MAIN COMPONENT
// ---------------------------------------------------------------------------
export default function NightOfNinja() {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [screen, setScreen] = useState('home'); // home | game
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');

  const [pub, setPub] = useState(null);
  const [priv, setPriv] = useState(null);
  const [playerId, setPlayerId] = useState(null);

  // Local UI selections
  const [selectedCard, setSelectedCard] = useState(null);
  const [selectedTarget, setSelectedTarget] = useState(null);

  // Connect socket once
  useEffect(() => {
    const s = io(SERVER_URL, { transports: ['websocket', 'polling'] });
    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));
    s.on('state:public', (st) => setPub(st));
    s.on('state:private', (st) => setPriv(st));
    setSocket(s);
    return () => s.close();
  }, []);

  // Reset selections when phase shifts
  useEffect(() => {
    setSelectedCard(null);
    setSelectedTarget(null);
  }, [pub?.phase, pub?.turn]);

  const me = pub?.players.find((p) => p.id === playerId);
  const myHouse = priv?.house;
  const houseTheme = HOUSES[myHouse] || HOUSES.CRANE;

  function createRoom() {
    if (!name.trim()) return setError('Choose a name.');
    socket.emit('room:create', { name: name.trim() }, (res) => {
      if (res.ok) {
        setPlayerId(res.playerId);
        setScreen('game');
      } else setError(res.error);
    });
  }
  function joinRoom() {
    if (!name.trim()) return setError('Choose a name.');
    if (!joinCode.trim()) return setError('Enter a room code.');
    socket.emit(
      'room:join',
      { name: name.trim(), code: joinCode.trim().toUpperCase() },
      (res) => {
        if (res.ok) {
          setPlayerId(res.playerId);
          setScreen('game');
        } else setError(res.error);
      }
    );
  }

  // ---------------------------- HOME ----------------------------
  if (screen === 'home') {
    return (
      <Shell>
        <InkBackground />
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6">
          <div className="text-center mb-12 max-w-md">
            <div
              className="text-[10px] tracking-[0.5em] mb-4"
              style={{ color: HOUSES.CRANE.accent }}
            >
              ANTHRO·SHADOWWARE · v1.0
            </div>
            <h1
              className="text-6xl sm:text-7xl font-black leading-none tracking-tight"
              style={{
                fontFamily: 'Oswald, sans-serif',
                background: `linear-gradient(180deg, ${HOUSES.CRANE.accent} 0%, ${HOUSES.LOTUS.accent} 100%)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              NIGHT
              <br />
              OF THE
              <br />
              NINJA
            </h1>
            <div className="flex items-center justify-center gap-2 mt-4">
              <div
                className="h-px flex-1"
                style={{ background: HOUSES.CRANE.accent }}
              />
              <span className="text-zinc-500 text-xs tracking-[0.4em]">
                忍 の 夜
              </span>
              <div
                className="h-px flex-1"
                style={{ background: HOUSES.LOTUS.accent }}
              />
            </div>
            <p className="text-zinc-500 text-sm mt-6 italic">
              Two houses. Eleven blades. One night decides who is remembered.
            </p>
          </div>

          <div className="w-full max-w-sm space-y-4">
            <Input
              label="Your shadow name"
              value={name}
              onChange={setName}
              placeholder="e.g. Hatori"
              accent={HOUSES.CRANE.accent}
            />
            <NeonButton
              accent={HOUSES.CRANE.accent}
              onClick={createRoom}
              disabled={!connected}
            >
              {connected ? 'Forge a New Room' : 'Connecting…'}
            </NeonButton>

            <div className="flex items-center gap-3 my-6">
              <div className="h-px flex-1 bg-zinc-800" />
              <span className="text-zinc-600 text-xs tracking-[0.3em]">OR</span>
              <div className="h-px flex-1 bg-zinc-800" />
            </div>

            <Input
              label="Room code"
              value={joinCode}
              onChange={(v) => setJoinCode(v.toUpperCase())}
              placeholder="4-LETTER CODE"
              maxLength={4}
              accent={HOUSES.LOTUS.accent}
            />
            <NeonButton
              accent={HOUSES.LOTUS.accent}
              onClick={joinRoom}
              disabled={!connected}
              variant="secondary"
            >
              Slip Into a Room
            </NeonButton>

            {error && (
              <div className="text-center text-sm" style={{ color: HOUSES.LOTUS.accent }}>
                {error}
              </div>
            )}
          </div>
        </div>
      </Shell>
    );
  }

  // ---------------------------- GAME ----------------------------
  if (!pub) {
    return (
      <Shell>
        <InkBackground />
        <div className="relative z-10 min-h-screen flex items-center justify-center text-zinc-500">
          Awaiting the night…
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <InkBackground />
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* HEADER */}
        <header className="px-4 sm:px-6 py-4 border-b border-zinc-900 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <div className="text-[10px] tracking-[0.4em] text-zinc-500">ROOM</div>
              <div
                className="text-2xl font-black tracking-[0.2em]"
                style={{ fontFamily: 'Oswald, sans-serif', color: '#fff' }}
              >
                {pub.code}
              </div>
            </div>
            <div className="hidden sm:block">
              <div className="text-[10px] tracking-[0.4em] text-zinc-500">ROUND</div>
              <div className="text-2xl font-black" style={{ fontFamily: 'Oswald, sans-serif' }}>
                {pub.round || '—'}
              </div>
            </div>
          </div>
          <div className="flex gap-4">
            <ScoreBadge house="CRANE" score={pub.houseScores.CRANE} />
            <ScoreBadge house="LOTUS" score={pub.houseScores.LOTUS} />
          </div>
        </header>

        {/* PLAYER STRIP */}
        <div className="px-2 py-3 overflow-x-auto border-b border-zinc-900">
          <div className="flex gap-1 justify-center min-w-max">
            {pub.players.map((p) => {
              const isMe = p.id === playerId;
              // Show the player's house only at round/game end OR if it's me
              const playerHouse = isMe ? myHouse : p.house;
              const accent = playerHouse
                ? HOUSES[playerHouse].accent
                : '#888';
              const selectable =
                pub.phase === 'BATTLE' &&
                me?.alive &&
                selectedCard &&
                p.alive;
              return (
                <PlayerChip
                  key={p.id}
                  player={p}
                  isMe={isMe}
                  accent={accent}
                  selectable={selectable}
                  selected={selectedTarget === p.id}
                  onClick={() => selectable && setSelectedTarget(p.id)}
                />
              );
            })}
          </div>
        </div>

        {/* MAIN STAGE */}
        <main className="flex-1 px-4 sm:px-6 py-6 flex flex-col items-center">
          {pub.phase === 'LOBBY' && (
            <LobbyView
              pub={pub}
              me={me}
              onStart={() => socket.emit('room:start')}
            />
          )}

          {(pub.phase === 'DRAFT_1' || pub.phase === 'DRAFT_2') && (
            <DraftView
              pub={pub}
              priv={priv}
              houseTheme={houseTheme}
              selectedCard={selectedCard}
              setSelectedCard={setSelectedCard}
              onConfirm={() => {
                if (!selectedCard) return;
                socket.emit('draft:pick', { cardId: selectedCard });
                setSelectedCard(null);
              }}
            />
          )}

          {pub.phase === 'BATTLE' && (
            <BattleView
              pub={pub}
              priv={priv}
              me={me}
              houseTheme={houseTheme}
              selectedCard={selectedCard}
              setSelectedCard={setSelectedCard}
              selectedTarget={selectedTarget}
              setSelectedTarget={setSelectedTarget}
              onConfirm={() => {
                if (!selectedCard) return;
                const card = priv?.hand.find((c) => c.id === selectedCard);
                const needsTarget = RANKS[card.rank].targets === 'one_player';
                if (needsTarget && !selectedTarget) return;
                socket.emit('battle:play', {
                  cardId: selectedCard,
                  targetId: selectedTarget,
                });
              }}
            />
          )}

          {pub.phase === 'RESOLVE' && (
            <ResolveView pub={pub} houseTheme={houseTheme} />
          )}

          {pub.phase === 'ROUND_END' && (
            <RoundEndView
              pub={pub}
              me={me}
              onNext={() => socket.emit('round:next')}
            />
          )}

          {pub.phase === 'GAME_END' && <GameEndView pub={pub} />}
        </main>

        {/* PRIVATE INFO PANEL */}
        {priv?.privateInfo?.length > 0 && (
          <PrivatePanel info={priv.privateInfo} />
        )}

        {/* LOG */}
        <LogStrip log={pub.log} />
      </div>

      <GlobalStyles />
    </Shell>
  );
}

// ---------------------------------------------------------------------------
// SUBVIEWS
// ---------------------------------------------------------------------------
function LobbyView({ pub, me, onStart }) {
  const isHost = me?.id === pub.hostId;
  const enough = pub.players.length >= 4;
  return (
    <div className="text-center max-w-lg w-full">
      <h2
        className="text-3xl tracking-[0.2em] mb-2"
        style={{ fontFamily: 'Oswald, sans-serif' }}
      >
        ASSEMBLY
      </h2>
      <p className="text-zinc-500 text-sm mb-6">
        Share the code <span className="text-white font-bold">{pub.code}</span>.
        Begin when {Math.max(0, 4 - pub.players.length)} more arrive.
      </p>
      <div className="text-zinc-400 text-sm mb-6">
        {pub.players.length} / 8 souls present
      </div>
      {isHost ? (
        <NeonButton
          accent={HOUSES.CRANE.accent}
          onClick={onStart}
          disabled={!enough}
        >
          {enough ? 'Begin the Night' : 'Awaiting blood…'}
        </NeonButton>
      ) : (
        <p className="text-zinc-600 italic">
          The host will sound the gong when ready.
        </p>
      )}
    </div>
  );
}

function DraftView({ pub, priv, houseTheme, selectedCard, setSelectedCard, onConfirm }) {
  const phase = pub.phase;
  const stage = phase === 'DRAFT_1' ? 1 : 2;
  return (
    <div className="w-full max-w-3xl text-center">
      <h2
        className="text-2xl sm:text-3xl tracking-[0.2em] mb-2"
        style={{ fontFamily: 'Oswald, sans-serif', color: houseTheme.accent }}
      >
        DRAFT · STAGE {stage}/2
      </h2>
      <p className="text-zinc-500 text-sm mb-6">
        Choose ONE card to keep. The rest pass to your left.
      </p>
      <HouseBanner house={priv?.house} />
      <div className="flex flex-wrap justify-center gap-3 sm:gap-4 mt-6">
        {(priv?.hand || []).map((card) => (
          <Card
            key={card.id}
            card={card}
            house={priv?.house}
            selected={selectedCard === card.id}
            onClick={() => setSelectedCard(card.id)}
          />
        ))}
      </div>
      {selectedCard && (
        <div className="mt-6 max-w-md mx-auto">
          <AbilityText card={priv.hand.find((c) => c.id === selectedCard)} accent={houseTheme.accent} />
          <div className="mt-4">
            <NeonButton accent={houseTheme.accent} onClick={onConfirm}>
              Lock in this blade
            </NeonButton>
          </div>
        </div>
      )}
    </div>
  );
}

function BattleView({
  pub, priv, me, houseTheme,
  selectedCard, setSelectedCard, selectedTarget, setSelectedTarget,
  onConfirm,
}) {
  if (!me?.alive) {
    return (
      <div className="text-center text-zinc-400 italic max-w-md">
        <h2
          className="text-2xl tracking-[0.2em] mb-2"
          style={{ fontFamily: 'Oswald, sans-serif', color: HOUSES.LOTUS.accent }}
        >
          YOU ARE A GHOST
        </h2>
        <p className="text-sm">Watch the night play out from the void.</p>
      </div>
    );
  }
  const selected = priv?.hand?.find((c) => c.id === selectedCard);
  const needsTarget = selected ? RANKS[selected.rank].targets === 'one_player' : false;
  const ready = selected && (!needsTarget || selectedTarget);

  return (
    <div className="w-full max-w-3xl text-center">
      <h2
        className="text-2xl sm:text-3xl tracking-[0.2em] mb-2"
        style={{ fontFamily: 'Oswald, sans-serif', color: houseTheme.accent }}
      >
        TURN {pub.turn + 1} / 2
      </h2>
      <p className="text-zinc-500 text-sm mb-6">
        Select a card. {needsTarget ? 'Then choose a target above.' : ''}
      </p>
      <HouseBanner house={priv?.house} />
      <div className="flex justify-center gap-4 mt-6">
        {(priv?.hand || []).map((card) => (
          <Card
            key={card.id}
            card={card}
            house={priv?.house}
            selected={selectedCard === card.id}
            onClick={() => setSelectedCard(card.id)}
          />
        ))}
      </div>
      {selected && (
        <div className="mt-6 max-w-md mx-auto">
          <AbilityText card={selected} accent={houseTheme.accent} />
          {needsTarget && (
            <div className="mt-3 text-zinc-400 text-sm">
              {selectedTarget
                ? `Target: ${pub.players.find((p) => p.id === selectedTarget)?.name}`
                : '◇ Select a target above ◇'}
            </div>
          )}
          <div className="mt-4">
            <NeonButton accent={houseTheme.accent} onClick={onConfirm} disabled={!ready}>
              Strike
            </NeonButton>
          </div>
        </div>
      )}
    </div>
  );
}

function ResolveView({ pub, houseTheme }) {
  return (
    <div className="w-full max-w-2xl text-center">
      <h2
        className="text-2xl tracking-[0.2em] mb-6 animate-pulse"
        style={{ fontFamily: 'Oswald, sans-serif', color: houseTheme.accent }}
      >
        BLADES FALL · RANK ORDER
      </h2>
      <div className="space-y-2 text-left">
        {pub.revealed?.map((e, i) => (
          <div
            key={i}
            className="border-l-2 pl-4 py-2 text-sm"
            style={{
              borderColor: HOUSES.CRANE.accent,
              animation: `slidein 0.4s ease-out ${i * 0.15}s both`,
            }}
          >
            <span className="text-zinc-500 text-[10px] tracking-widest mr-2">
              R{String(e.rank).padStart(2, '0')}
            </span>
            <span className="text-zinc-200">{e.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RoundEndView({ pub, me, onNext }) {
  const isHost = me?.id === pub.hostId;
  const winner =
    pub.houseScores.CRANE > pub.houseScores.LOTUS ? 'CRANE' : 'LOTUS';
  return (
    <div className="text-center max-w-lg">
      <h2
        className="text-3xl tracking-[0.3em] mb-4"
        style={{ fontFamily: 'Oswald, sans-serif', color: HOUSES[winner].accent }}
      >
        ROUND {pub.round} ENDS
      </h2>
      <div className="grid grid-cols-2 gap-4 mb-6">
        {['CRANE', 'LOTUS'].map((h) => (
          <div
            key={h}
            className="p-4 border"
            style={{ borderColor: HOUSES[h].accent, background: '#000' }}
          >
            <div className="text-xs tracking-[0.3em]" style={{ color: HOUSES[h].accent }}>
              HOUSE {h}
            </div>
            <div className="text-4xl font-black" style={{ fontFamily: 'Oswald, sans-serif' }}>
              {pub.houseScores[h]}
            </div>
            <div className="text-[10px] text-zinc-500">/ 10 honor</div>
          </div>
        ))}
      </div>
      {isHost ? (
        <NeonButton accent={HOUSES.CRANE.accent} onClick={onNext}>
          Begin Next Round
        </NeonButton>
      ) : (
        <p className="text-zinc-500 italic text-sm">The host calls the next round.</p>
      )}
    </div>
  );
}

function GameEndView({ pub }) {
  const winner = pub.houseScores.CRANE > pub.houseScores.LOTUS ? 'CRANE' : 'LOTUS';
  const h = HOUSES[winner];
  return (
    <div className="text-center">
      <div
        className="text-[10px] tracking-[0.5em] mb-4"
        style={{ color: h.accent }}
      >
        VICTORY
      </div>
      <h1
        className="text-5xl sm:text-7xl font-black tracking-tight mb-4"
        style={{
          fontFamily: 'Oswald, sans-serif',
          color: h.accent,
          textShadow: `0 0 30px ${h.accent}`,
        }}
      >
        HOUSE {winner}
      </h1>
      <p className="text-zinc-400 italic max-w-md mx-auto">"{h.motto}"</p>
      <div className="mt-8 text-zinc-600 text-sm">
        Crane {pub.houseScores.CRANE}  ·  Lotus {pub.houseScores.LOTUS}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SMALL COMPONENTS
// ---------------------------------------------------------------------------
function Shell({ children }) {
  return (
    <div className="min-h-screen bg-black text-zinc-100 antialiased relative overflow-hidden">
      {children}
    </div>
  );
}

function NeonButton({ children, accent, onClick, disabled, variant = 'primary' }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full py-3 px-6 relative tracking-[0.3em] text-sm transition-all ${
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:scale-[1.02]'
      }`}
      style={{
        fontFamily: 'Oswald, sans-serif',
        color: accent,
        background: variant === 'primary' ? '#000' : 'transparent',
        border: `1px solid ${accent}`,
        boxShadow: disabled ? 'none' : `0 0 10px ${accent}33, inset 0 0 10px ${accent}11`,
      }}
    >
      {/* Corner notches */}
      <div className="absolute top-0 left-0 w-2 h-2" style={{ borderTop: `2px solid ${accent}`, borderLeft: `2px solid ${accent}` }} />
      <div className="absolute top-0 right-0 w-2 h-2" style={{ borderTop: `2px solid ${accent}`, borderRight: `2px solid ${accent}` }} />
      <div className="absolute bottom-0 left-0 w-2 h-2" style={{ borderBottom: `2px solid ${accent}`, borderLeft: `2px solid ${accent}` }} />
      <div className="absolute bottom-0 right-0 w-2 h-2" style={{ borderBottom: `2px solid ${accent}`, borderRight: `2px solid ${accent}` }} />
      {children}
    </button>
  );
}

function Input({ label, value, onChange, placeholder, accent, maxLength }) {
  return (
    <div>
      <label
        className="block text-[10px] tracking-[0.3em] mb-2 uppercase"
        style={{ color: accent }}
      >
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="w-full bg-black border px-4 py-3 text-white tracking-widest outline-none transition-all"
        style={{
          borderColor: accent + '55',
          fontFamily: 'Oswald, sans-serif',
        }}
        onFocus={(e) => (e.target.style.borderColor = accent)}
        onBlur={(e) => (e.target.style.borderColor = accent + '55')}
      />
    </div>
  );
}

function HouseBanner({ house }) {
  if (!house) return null;
  const h = HOUSES[house];
  return (
    <div className="inline-flex items-center gap-3 px-4 py-2 border" style={{ borderColor: h.accent }}>
      <span className="text-2xl" style={{ color: h.accent }}>{house === 'CRANE' ? '鶴' : '蓮'}</span>
      <div className="text-left">
        <div className="text-[9px] tracking-[0.3em] text-zinc-500">YOU SERVE</div>
        <div className="text-sm tracking-[0.2em]" style={{ color: h.accent, fontFamily: 'Oswald, sans-serif' }}>
          {h.name.toUpperCase()}
        </div>
      </div>
    </div>
  );
}

function ScoreBadge({ house, score }) {
  const h = HOUSES[house];
  return (
    <div className="flex flex-col items-end">
      <div className="text-[9px] tracking-[0.3em]" style={{ color: h.accent }}>
        {house}
      </div>
      <div
        className="text-xl font-black"
        style={{
          fontFamily: 'Oswald, sans-serif',
          color: h.accent,
          textShadow: `0 0 6px ${h.accent}66`,
        }}
      >
        {score}<span className="text-zinc-700 text-sm">/10</span>
      </div>
    </div>
  );
}

function AbilityText({ card, accent }) {
  if (!card) return null;
  const r = RANKS[card.rank];
  return (
    <div className="border p-3" style={{ borderColor: accent + '66' }}>
      <div className="text-[10px] tracking-[0.3em] mb-1" style={{ color: accent }}>
        RANK {String(r.rank).padStart(2, '0')} · {r.name.toUpperCase()}
      </div>
      <div className="text-zinc-300 text-sm italic mb-2">"{r.tagline}"</div>
      <div className="text-zinc-400 text-xs">{r.ability}</div>
    </div>
  );
}

function PrivatePanel({ info }) {
  return (
    <div className="px-4 py-2 border-t border-amber-900/50 bg-amber-950/20 text-amber-200 text-xs">
      <div className="text-[9px] tracking-[0.3em] text-amber-500 mb-1">FOR YOUR EYES ONLY</div>
      {info.map((entry, i) => {
        let text = '';
        if (entry.kind === 'house_peek')
          text = `${entry.of} serves ${HOUSES[entry.house].name}.`;
        if (entry.kind === 'card_peek')
          text = `${entry.of} also holds Rank ${entry.rank} (${RANKS[entry.rank].name}).`;
        if (entry.kind === 'deck_peek')
          text = `Top of deck: ${entry.ranks.map((r) => RANKS[r].name).join(' → ')}.`;
        return <div key={i}>· {text}</div>;
      })}
    </div>
  );
}

function LogStrip({ log }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollLeft = ref.current.scrollWidth;
  }, [log]);
  return (
    <div
      ref={ref}
      className="border-t border-zinc-900 px-4 py-2 overflow-x-auto whitespace-nowrap text-zinc-500 text-xs"
      style={{ scrollbarWidth: 'none' }}
    >
      {log.slice(-8).map((l, i) => (
        <span key={i} className="mr-6">
          ◇ {l.msg}
        </span>
      ))}
    </div>
  );
}

function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;700;900&display=swap');
      body { background: #000; }
      @keyframes inkrise {
        0% { transform: translateY(0) rotate(0deg); opacity: 0; }
        10% { opacity: var(--o, 0.08); }
        100% { transform: translateY(-120vh) rotate(40deg); opacity: 0; }
      }
      @keyframes slash {
        0% { transform: scale(0.5) rotate(-30deg); opacity: 0; }
        50% { opacity: 1; }
        100% { transform: scale(1.2) rotate(0deg); opacity: 0; }
      }
      @keyframes slidein {
        from { opacity: 0; transform: translateX(-12px); }
        to { opacity: 1; transform: translateX(0); }
      }
    `}</style>
  );
}
