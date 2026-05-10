// App.js — Night of the Ninja (single-file client)
// All game UI + card definitions + socket logic in one file for easy deploy.
// Connects to the Render backend URL hardcoded below; override via REACT_APP_SERVER_URL.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { Swords, Eye, Shield, Skull, Sparkles, Crown, Scroll, Search, Users } from 'lucide-react';

// ===========================================================================
// CONFIG
// ===========================================================================
const SERVER_URL =
  process.env.REACT_APP_SERVER_URL || 'https://ninja-server-backend.onrender.com';

// ===========================================================================
// HOUSES & RANKS
// ===========================================================================
const HOUSES = {
  CRANE: {
    id: 'CRANE',
    name: 'House Crane',
    motto: 'Honor sharper than steel.',
    accent: '#7DF9FF',
    sigil: '鶴',
  },
  LOTUS: {
    id: 'LOTUS',
    name: 'House Lotus',
    motto: 'Beauty drowned in blood.',
    accent: '#FF3D5A',
    sigil: '蓮',
  },
};

const RANKS = {
  1:  { rank: 1,  name: 'Mystic',         tagline: 'Sees the unseen.',        ability: 'Reveal the House (Lotus or Crane) of any one player. The information is yours alone.', targets: 'one_player', icon: Sparkles, glyph: '✦' },
  2:  { rank: 2,  name: 'Blind Assassin', tagline: 'A trap dressed as a blade.', ability: 'If your target played a Shinobi (Rank 3) this turn, the Shinobi dies instead. Otherwise, no effect.', targets: 'one_player', icon: Skull, glyph: '⌖' },
  3:  { rank: 3,  name: 'Shinobi',        tagline: 'Silent. Swift. Sudden.',     ability: 'Assassinate any one player. Vulnerable to the Blind Assassin.', targets: 'one_player', icon: Swords, glyph: '刃' },
  4:  { rank: 4,  name: 'Spy',            tagline: 'Secrets are the sharpest weapon.', ability: 'Peek at the unrevealed card of any one player.', targets: 'one_player', icon: Search, glyph: '◉' },
  5:  { rank: 5,  name: 'Bodyguard',      tagline: 'A shield of muscle and oath.',  ability: 'Protect any one player from death this turn.', targets: 'one_player', icon: Shield, glyph: '盾' },
  6:  { rank: 6,  name: 'Diplomat',       tagline: 'Words bend the world.',          ability: 'Force any one player to swap one of their unplayed cards with one of yours.', targets: 'one_player', icon: Scroll, glyph: '巻' },
  7:  { rank: 7,  name: 'Samurai',        tagline: 'Steel that does not waver.',    ability: 'Duel any one player. Lower-ranked card-holder dies. Ties: both survive.', targets: 'one_player', icon: Swords, glyph: '士' },
  8:  { rank: 8,  name: 'Daimyo',         tagline: 'The hand that signs the order.', ability: "Redirect another player's chosen target.", targets: 'one_player', icon: Crown, glyph: '主' },
  9:  { rank: 9,  name: 'Oracle',         tagline: 'Tomorrow whispers tonight.',     ability: 'Look at the top 3 cards of the draw deck.', targets: 'self', icon: Eye, glyph: '占' },
  10: { rank: 10, name: 'Shogun',         tagline: 'The crown beneath the helm.',   ability: 'If you survive the round, your House gains +2 Honor.', targets: 'self', icon: Crown, glyph: '将' },
  11: { rank: 11, name: 'Shinobi Spirit', tagline: 'Death is merely a doorway.',     ability: 'Triggers AFTER your death (or end of round). Kill any one player. Cannot be blocked by Bodyguard.', targets: 'one_player', icon: Skull, glyph: '霊' },
};

// ===========================================================================
// STYLE TOKENS (inline — no Tailwind dependency)
// ===========================================================================
const S = {
  shell: {
    minHeight: '100vh',
    background: '#000',
    color: '#f4f4f5',
    fontFamily: "'Oswald', system-ui, sans-serif",
    position: 'relative',
    overflow: 'hidden',
  },
  layer: { position: 'relative', zIndex: 10 },
  centerCol: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '24px' },
  title: { fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 0.95, margin: 0 },
  kicker: (color) => ({ fontSize: 10, letterSpacing: '0.5em', color, marginBottom: 16 }),
  tagline: { color: '#71717a', fontSize: 14, fontStyle: 'italic', marginTop: 24, textAlign: 'center' },
  divider: { display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0' },
  hr: (color) => ({ height: 1, flex: 1, background: color }),
  panel: (accent) => ({
    border: `1px solid ${accent}`,
    background: '#000',
    padding: 16,
    boxShadow: `0 0 12px ${accent}33, inset 0 0 12px ${accent}11`,
    position: 'relative',
  }),
};

// ===========================================================================
// MAIN APP
// ===========================================================================
export default function App() {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [screen, setScreen] = useState('home');
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');

  const [pub, setPub] = useState(null);
  const [priv, setPriv] = useState(null);
  const [playerId, setPlayerId] = useState(null);

  const [selectedCard, setSelectedCard] = useState(null);
  const [selectedTarget, setSelectedTarget] = useState(null);

  // Connect socket
  useEffect(() => {
    const s = io(SERVER_URL, { transports: ['websocket', 'polling'] });
    s.on('connect', () => { setConnected(true); setError(''); });
    s.on('disconnect', () => setConnected(false));
    s.on('connect_error', (err) => setError(`Server waking up… (${err.message})`));
    s.on('state:public', setPub);
    s.on('state:private', setPriv);
    setSocket(s);
    return () => s.close();
  }, []);

  // Reset selections when phase shifts
  useEffect(() => {
    setSelectedCard(null);
    setSelectedTarget(null);
  }, [pub?.phase, pub?.turn]);

  const me = pub?.players?.find((p) => p.id === playerId);
  const myHouse = priv?.house;
  const houseTheme = HOUSES[myHouse] || HOUSES.CRANE;

  function createRoom() {
    if (!name.trim()) return setError('Choose a name.');
    socket.emit('room:create', { name: name.trim() }, (res) => {
      if (res?.ok) { setPlayerId(res.playerId); setScreen('game'); setError(''); }
      else setError(res?.error || 'Could not create room.');
    });
  }
  function joinRoom() {
    if (!name.trim()) return setError('Choose a name.');
    if (!joinCode.trim()) return setError('Enter a room code.');
    socket.emit('room:join', { name: name.trim(), code: joinCode.trim().toUpperCase() }, (res) => {
      if (res?.ok) { setPlayerId(res.playerId); setScreen('game'); setError(''); }
      else setError(res?.error || 'Could not join.');
    });
  }

  // ============================================================ HOME
  if (screen === 'home') {
    return (
      <Shell>
        <InkBackground />
        <div style={{ ...S.layer, ...S.centerCol }}>
          <div style={{ textAlign: 'center', maxWidth: 480, marginBottom: 40 }}>
            <div style={S.kicker(HOUSES.CRANE.accent)}>ANTHRO·SHADOWWARE · v1.0</div>
            <h1
              style={{
                ...S.title,
                fontSize: 'clamp(48px, 12vw, 96px)',
                background: `linear-gradient(180deg, ${HOUSES.CRANE.accent} 0%, ${HOUSES.LOTUS.accent} 100%)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              NIGHT<br />OF THE<br />NINJA
            </h1>
            <div style={S.divider}>
              <div style={S.hr(HOUSES.CRANE.accent)} />
              <span style={{ color: '#71717a', fontSize: 12, letterSpacing: '0.4em' }}>忍 の 夜</span>
              <div style={S.hr(HOUSES.LOTUS.accent)} />
            </div>
            <p style={S.tagline}>Two houses. Eleven blades. One night decides who is remembered.</p>
          </div>

          <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Input label="Your shadow name" value={name} onChange={setName} placeholder="e.g. Hatori" accent={HOUSES.CRANE.accent} />
            <NeonButton accent={HOUSES.CRANE.accent} onClick={createRoom} disabled={!connected}>
              {connected ? 'Forge a New Room' : 'Connecting…'}
            </NeonButton>

            <div style={S.divider}>
              <div style={{ height: 1, flex: 1, background: '#27272a' }} />
              <span style={{ color: '#52525b', fontSize: 11, letterSpacing: '0.3em' }}>OR</span>
              <div style={{ height: 1, flex: 1, background: '#27272a' }} />
            </div>

            <Input label="Room code" value={joinCode} onChange={(v) => setJoinCode(v.toUpperCase())} placeholder="4-LETTER CODE" maxLength={4} accent={HOUSES.LOTUS.accent} />
            <NeonButton accent={HOUSES.LOTUS.accent} onClick={joinRoom} disabled={!connected}>
              Slip Into a Room
            </NeonButton>

            {error && <div style={{ textAlign: 'center', fontSize: 14, color: HOUSES.LOTUS.accent }}>{error}</div>}
            <div style={{ textAlign: 'center', fontSize: 10, color: '#3f3f46', letterSpacing: '0.2em', marginTop: 8 }}>
              {connected ? `◉ CONNECTED · ${SERVER_URL.replace(/^https?:\/\//, '')}` : '◯ DISCONNECTED'}
            </div>
          </div>
        </div>
        <GlobalKeyframes />
      </Shell>
    );
  }

  // ============================================================ GAME (loading)
  if (!pub) {
    return (
      <Shell>
        <InkBackground />
        <div style={{ ...S.layer, ...S.centerCol }}>
          <div style={{ color: '#52525b' }}>Awaiting the night…</div>
        </div>
        <GlobalKeyframes />
      </Shell>
    );
  }

  // ============================================================ GAME
  return (
    <Shell>
      <InkBackground />
      <div style={{ ...S.layer, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Header pub={pub} />
        <PlayerStrip pub={pub} playerId={playerId} myHouse={myHouse} selectedCard={selectedCard} selectedTarget={selectedTarget} setSelectedTarget={setSelectedTarget} me={me} />

        <main style={{ flex: 1, padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {pub.phase === 'LOBBY' && <LobbyView pub={pub} me={me} onStart={() => socket.emit('room:start')} />}
          {(pub.phase === 'DRAFT_1' || pub.phase === 'DRAFT_2') && (
            <DraftView pub={pub} priv={priv} houseTheme={houseTheme} selectedCard={selectedCard} setSelectedCard={setSelectedCard}
              onConfirm={() => { if (selectedCard) { socket.emit('draft:pick', { cardId: selectedCard }); setSelectedCard(null); } }} />
          )}
          {pub.phase === 'BATTLE' && (
            <BattleView pub={pub} priv={priv} me={me} houseTheme={houseTheme}
              selectedCard={selectedCard} setSelectedCard={setSelectedCard}
              selectedTarget={selectedTarget}
              onConfirm={() => {
                if (!selectedCard) return;
                const card = priv?.hand?.find((c) => c.id === selectedCard);
                if (!card) return;
                const needsTarget = RANKS[card.rank].targets === 'one_player';
                if (needsTarget && !selectedTarget) return;
                socket.emit('battle:play', { cardId: selectedCard, targetId: selectedTarget });
              }} />
          )}
          {pub.phase === 'RESOLVE' && <ResolveView pub={pub} houseTheme={houseTheme} />}
          {pub.phase === 'ROUND_END' && <RoundEndView pub={pub} me={me} onNext={() => socket.emit('round:next')} />}
          {pub.phase === 'GAME_END' && <GameEndView pub={pub} />}
        </main>

        {priv?.privateInfo?.length > 0 && <PrivatePanel info={priv.privateInfo} />}
        <LogStrip log={pub.log || []} />
      </div>
      <GlobalKeyframes />
    </Shell>
  );
}

// ===========================================================================
// CARD COMPONENT
// ===========================================================================
function Silhouette({ rank, color }) {
  const fill = color + '22';
  const c = { stroke: color, fill, strokeWidth: 1.2 };
  switch (rank) {
    case 1: return <g {...c}><circle cx="50" cy="40" r="14" /><path d="M36 56 L64 56 L70 110 L30 110 Z" /><circle cx="50" cy="22" r="2" fill={color} /><circle cx="30" cy="32" r="1.5" fill={color} /><circle cx="70" cy="32" r="1.5" fill={color} /></g>;
    case 2: return <g {...c}><path d="M50 22 L72 42 L72 60 L60 70 L60 110 L40 110 L40 70 L28 60 L28 42 Z" /><line x1="32" y1="44" x2="68" y2="44" stroke={color} strokeWidth="2" /></g>;
    case 3: return <g {...c}><circle cx="50" cy="36" r="11" /><path d="M40 47 L60 47 L66 80 L62 110 L38 110 L34 80 Z" /><line x1="62" y1="60" x2="86" y2="44" stroke={color} strokeWidth="2" /></g>;
    case 4: return <g {...c}><circle cx="50" cy="38" r="12" /><circle cx="56" cy="38" r="5" fill="none" strokeWidth="2" /><path d="M38 50 L62 50 L66 110 L34 110 Z" /></g>;
    case 5: return <g {...c}><circle cx="50" cy="32" r="10" /><path d="M30 44 L70 44 L74 110 L26 110 Z" /><path d="M44 60 L56 60 L58 90 L50 96 L42 90 Z" fill={color} opacity="0.5" /></g>;
    case 6: return <g {...c}><circle cx="50" cy="36" r="11" /><path d="M38 48 L62 48 L66 110 L34 110 Z" /><rect x="56" y="62" width="22" height="6" fill={color} opacity="0.5" /><rect x="56" y="74" width="22" height="6" fill={color} opacity="0.5" /></g>;
    case 7: return <g {...c}><path d="M40 22 L60 22 L66 32 L60 38 L40 38 L34 32 Z" /><path d="M36 40 L64 40 L70 110 L30 110 Z" /><line x1="68" y1="46" x2="92" y2="22" stroke={color} strokeWidth="2.5" /></g>;
    case 8: return <g {...c}><path d="M30 18 L70 18 L66 36 L34 36 Z" /><circle cx="50" cy="44" r="9" /><path d="M34 54 L66 54 L72 110 L28 110 Z" /></g>;
    case 9: return <g {...c}><circle cx="50" cy="36" r="11" /><circle cx="50" cy="34" r="2" fill={color} /><path d="M30 48 L70 48 L78 110 L22 110 Z" /></g>;
    case 10: return <g {...c}><path d="M30 24 L40 12 L50 22 L60 12 L70 24 L70 38 L30 38 Z" /><path d="M34 40 L66 40 L72 110 L28 110 Z" /></g>;
    case 11: return <g {...c} opacity="0.85"><circle cx="50" cy="36" r="10" strokeDasharray="3 2" /><path d="M36 48 L64 48 L68 90 L60 110 L40 110 L32 90 Z" strokeDasharray="3 2" /></g>;
    default: return null;
  }
}

function Card({ card, house, selected, onClick }) {
  const accent = (HOUSES[house] || HOUSES.CRANE).accent;
  const r = RANKS[card?.rank];
  if (!r) return null;
  return (
    <button
      onClick={onClick}
      style={{
        width: 112, height: 168, position: 'relative', padding: 0, border: 'none',
        background: 'transparent', cursor: 'pointer',
        transform: selected ? 'translateY(-8px)' : 'none',
        filter: selected ? `drop-shadow(0 0 14px ${accent})` : 'none',
        transition: 'all 200ms',
      }}
    >
      <div style={{
        position: 'absolute', inset: 0, border: `1px solid ${accent}`,
        background: 'linear-gradient(180deg, #000 0%, #0a0a0a 100%)',
        boxShadow: selected ? `0 0 20px ${accent}, inset 0 0 20px ${accent}33` : `0 0 8px ${accent}22, inset 0 0 8px ${accent}11`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', borderBottom: `1px solid ${accent}55` }}>
          <span style={{ fontSize: 20, fontWeight: 900, color: accent }}>
            {String(r.rank).padStart(2, '0')}
          </span>
          <span style={{ fontSize: 16, color: accent, filter: `drop-shadow(0 0 3px ${accent})` }}>{r.glyph}</span>
        </div>
        <div style={{ padding: '0 6px' }}>
          <svg viewBox="0 0 100 110" width="100%"><Silhouette rank={r.rank} color={accent} /></svg>
        </div>
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          textAlign: 'center', padding: '4px 0', borderTop: `1px solid ${accent}55`, background: '#000',
        }}>
          <div style={{ fontSize: 10, letterSpacing: '0.2em', color: accent, textTransform: 'uppercase' }}>{r.name}</div>
        </div>
        {/* Corner notches */}
        <CornerNotches accent={accent} />
      </div>
    </button>
  );
}

function CornerNotches({ accent }) {
  return (
    <>
      <div style={{ position: 'absolute', top: 0, left: 0, width: 8, height: 8, borderTop: `2px solid ${accent}`, borderLeft: `2px solid ${accent}` }} />
      <div style={{ position: 'absolute', top: 0, right: 0, width: 8, height: 8, borderTop: `2px solid ${accent}`, borderRight: `2px solid ${accent}` }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, width: 8, height: 8, borderBottom: `2px solid ${accent}`, borderLeft: `2px solid ${accent}` }} />
      <div style={{ position: 'absolute', bottom: 0, right: 0, width: 8, height: 8, borderBottom: `2px solid ${accent}`, borderRight: `2px solid ${accent}` }} />
    </>
  );
}

// ===========================================================================
// LAYOUT PIECES
// ===========================================================================
function Shell({ children }) {
  return <div style={S.shell}>{children}</div>;
}

function InkBackground() {
  const particles = useMemo(() =>
    Array.from({ length: 12 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      size: 200 + Math.random() * 300,
      delay: Math.random() * 30,
      duration: 40 + Math.random() * 40,
      opacity: 0.04 + Math.random() * 0.06,
    })), []);
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0 }}>
      {particles.map((p) => (
        <div key={p.id} style={{
          position: 'absolute', left: `${p.left}%`, bottom: `-${p.size}px`,
          width: p.size, height: p.size, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(125,249,255,0.3) 0%, rgba(255,61,90,0.15) 40%, transparent 70%)',
          opacity: p.opacity, filter: 'blur(40px)',
          animation: `inkrise ${p.duration}s ease-in ${p.delay}s infinite`,
        }} />
      ))}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(rgba(125,249,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(125,249,255,0.03) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }} />
    </div>
  );
}

function Header({ pub }) {
  return (
    <header style={{ padding: '16px 24px', borderBottom: '1px solid #18181b', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.4em', color: '#71717a' }}>ROOM</div>
          <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: '0.2em', color: '#fff' }}>{pub.code}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.4em', color: '#71717a' }}>ROUND</div>
          <div style={{ fontSize: 24, fontWeight: 900 }}>{pub.round || '—'}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 16 }}>
        <ScoreBadge house="CRANE" score={pub.houseScores?.CRANE || 0} />
        <ScoreBadge house="LOTUS" score={pub.houseScores?.LOTUS || 0} />
      </div>
    </header>
  );
}

function ScoreBadge({ house, score }) {
  const h = HOUSES[house];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
      <div style={{ fontSize: 9, letterSpacing: '0.3em', color: h.accent }}>{house}</div>
      <div style={{ fontSize: 20, fontWeight: 900, color: h.accent, textShadow: `0 0 6px ${h.accent}66` }}>
        {score}<span style={{ color: '#3f3f46', fontSize: 14 }}>/10</span>
      </div>
    </div>
  );
}

function PlayerStrip({ pub, playerId, myHouse, selectedCard, selectedTarget, setSelectedTarget, me }) {
  return (
    <div style={{ padding: '12px 8px', overflowX: 'auto', borderBottom: '1px solid #18181b' }}>
      <div style={{ display: 'flex', gap: 4, justifyContent: 'center', minWidth: 'max-content' }}>
        {pub.players.map((p) => {
          const isMe = p.id === playerId;
          const playerHouse = isMe ? myHouse : p.house;
          const accent = playerHouse ? HOUSES[playerHouse].accent : '#71717a';
          const selectable = pub.phase === 'BATTLE' && me?.alive && selectedCard && p.alive;
          return <PlayerChip key={p.id} player={p} isMe={isMe} accent={accent}
            selectable={selectable} selected={selectedTarget === p.id}
            onClick={() => selectable && setSelectedTarget(p.id)} />;
        })}
      </div>
    </div>
  );
}

function PlayerChip({ player, isMe, selectable, onClick, selected, accent }) {
  const dead = !player.alive;
  return (
    <button onClick={onClick} disabled={!selectable} style={{
      position: 'relative', padding: 8, background: 'transparent', border: 'none',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      cursor: selectable ? 'pointer' : 'default',
      transform: selected ? 'scale(1.1)' : 'none',
      filter: selected ? `drop-shadow(0 0 8px ${accent})` : 'none',
      transition: 'all 200ms',
    }}>
      <div style={{
        width: 48, height: 48, border: `1px solid ${dead ? '#3f3f46' : accent}`,
        background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', boxShadow: dead ? 'none' : `0 0 8px ${accent}44`,
      }}>
        <span style={{ fontSize: 18, fontWeight: 900, color: dead ? '#3f3f46' : accent }}>
          {(player.name || '?')[0].toUpperCase()}
        </span>
        {dead && (
          <>
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(135deg, transparent 47%, #FF3D5A 49%, #FF3D5A 51%, transparent 53%)',
              animation: 'slash 0.6s ease-out',
            }} />
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />
          </>
        )}
        {isMe && <div style={{ position: 'absolute', top: -4, right: -4, width: 8, height: 8, borderRadius: '50%', background: accent, boxShadow: `0 0 4px ${accent}` }} />}
      </div>
      <div style={{ fontSize: 10, letterSpacing: '0.15em', color: '#a1a1aa', textTransform: 'uppercase', maxWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {player.name}
      </div>
      {player.honorKills > 0 && <div style={{ fontSize: 9, color: '#fbbf24' }}>⚔ {player.honorKills}</div>}
    </button>
  );
}

// ===========================================================================
// FORMS & BUTTONS
// ===========================================================================
function NeonButton({ children, accent, onClick, disabled }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%', padding: '12px 24px', position: 'relative',
        letterSpacing: '0.3em', fontSize: 13,
        fontFamily: "'Oswald', sans-serif",
        color: accent, background: '#000', border: `1px solid ${accent}`,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        boxShadow: disabled ? 'none' : `0 0 ${hover ? 18 : 10}px ${accent}33, inset 0 0 10px ${accent}11`,
        transform: hover && !disabled ? 'scale(1.02)' : 'none',
        transition: 'all 200ms',
      }}
    >
      <CornerNotches accent={accent} />
      {children}
    </button>
  );
}

function Input({ label, value, onChange, placeholder, accent, maxLength }) {
  const [focus, setFocus] = useState(false);
  return (
    <div>
      <label style={{ display: 'block', fontSize: 10, letterSpacing: '0.3em', marginBottom: 8, color: accent, textTransform: 'uppercase' }}>
        {label}
      </label>
      <input
        type="text" value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} maxLength={maxLength}
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        style={{
          width: '100%', background: '#000',
          border: `1px solid ${focus ? accent : accent + '55'}`,
          padding: '12px 16px', color: '#fff', letterSpacing: '0.15em',
          outline: 'none', fontFamily: "'Oswald', sans-serif",
          fontSize: 14, transition: 'all 200ms',
        }}
      />
    </div>
  );
}

// ===========================================================================
// PHASE VIEWS
// ===========================================================================
function LobbyView({ pub, me, onStart }) {
  const isHost = me?.id === pub.hostId;
  const enough = pub.players.length >= 4;
  return (
    <div style={{ textAlign: 'center', maxWidth: 480, width: '100%' }}>
      <h2 style={{ fontSize: 28, letterSpacing: '0.2em', margin: '0 0 8px' }}>ASSEMBLY</h2>
      <p style={{ color: '#71717a', fontSize: 14, marginBottom: 24 }}>
        Share the code <strong style={{ color: '#fff' }}>{pub.code}</strong>.
        {!enough && ` Awaiting ${4 - pub.players.length} more soul(s).`}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#a1a1aa', fontSize: 14, marginBottom: 24 }}>
        <Users size={16} /> {pub.players.length} / 8 present
      </div>
      {isHost ? (
        <NeonButton accent={HOUSES.CRANE.accent} onClick={onStart} disabled={!enough}>
          {enough ? 'Begin the Night' : 'Awaiting blood…'}
        </NeonButton>
      ) : (
        <p style={{ color: '#52525b', fontStyle: 'italic' }}>The host will sound the gong when ready.</p>
      )}
    </div>
  );
}

function HouseBanner({ house }) {
  if (!house) return null;
  const h = HOUSES[house];
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, padding: '8px 16px', border: `1px solid ${h.accent}` }}>
      <span style={{ fontSize: 24, color: h.accent }}>{h.sigil}</span>
      <div style={{ textAlign: 'left' }}>
        <div style={{ fontSize: 9, letterSpacing: '0.3em', color: '#71717a' }}>YOU SERVE</div>
        <div style={{ fontSize: 13, letterSpacing: '0.2em', color: h.accent }}>{h.name.toUpperCase()}</div>
      </div>
    </div>
  );
}

function AbilityText({ card, accent }) {
  if (!card) return null;
  const r = RANKS[card.rank];
  const Icon = r.icon;
  return (
    <div style={{ border: `1px solid ${accent}66`, padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, letterSpacing: '0.3em', marginBottom: 4, color: accent }}>
        <Icon size={14} /> RANK {String(r.rank).padStart(2, '0')} · {r.name.toUpperCase()}
      </div>
      <div style={{ color: '#d4d4d8', fontSize: 13, fontStyle: 'italic', marginBottom: 8 }}>"{r.tagline}"</div>
      <div style={{ color: '#a1a1aa', fontSize: 12 }}>{r.ability}</div>
    </div>
  );
}

function DraftView({ pub, priv, houseTheme, selectedCard, setSelectedCard, onConfirm }) {
  const stage = pub.phase === 'DRAFT_1' ? 1 : 2;
  return (
    <div style={{ width: '100%', maxWidth: 720, textAlign: 'center' }}>
      <h2 style={{ fontSize: 24, letterSpacing: '0.2em', color: houseTheme.accent, margin: '0 0 8px' }}>
        DRAFT · STAGE {stage}/2
      </h2>
      <p style={{ color: '#71717a', fontSize: 14, marginBottom: 24 }}>
        Choose ONE card to keep. The rest pass to your left.
      </p>
      <HouseBanner house={priv?.house} />
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 16, marginTop: 24 }}>
        {(priv?.hand || []).map((card) => (
          <Card key={card.id} card={card} house={priv?.house} selected={selectedCard === card.id} onClick={() => setSelectedCard(card.id)} />
        ))}
      </div>
      {selectedCard && (
        <div style={{ marginTop: 24, maxWidth: 420, marginLeft: 'auto', marginRight: 'auto' }}>
          <AbilityText card={priv.hand.find((c) => c.id === selectedCard)} accent={houseTheme.accent} />
          <div style={{ marginTop: 16 }}>
            <NeonButton accent={houseTheme.accent} onClick={onConfirm}>Lock in this blade</NeonButton>
          </div>
        </div>
      )}
    </div>
  );
}

function BattleView({ pub, priv, me, houseTheme, selectedCard, setSelectedCard, selectedTarget, onConfirm }) {
  if (!me?.alive) {
    return (
      <div style={{ textAlign: 'center', color: '#a1a1aa', fontStyle: 'italic', maxWidth: 420 }}>
        <h2 style={{ fontSize: 24, letterSpacing: '0.2em', color: HOUSES.LOTUS.accent, margin: '0 0 8px' }}>YOU ARE A GHOST</h2>
        <p style={{ fontSize: 14 }}>Watch the night play out from the void.</p>
      </div>
    );
  }
  const selected = priv?.hand?.find((c) => c.id === selectedCard);
  const needsTarget = selected ? RANKS[selected.rank].targets === 'one_player' : false;
  const ready = selected && (!needsTarget || selectedTarget);
  return (
    <div style={{ width: '100%', maxWidth: 720, textAlign: 'center' }}>
      <h2 style={{ fontSize: 24, letterSpacing: '0.2em', color: houseTheme.accent, margin: '0 0 8px' }}>
        TURN {pub.turn + 1} / 2
      </h2>
      <p style={{ color: '#71717a', fontSize: 14, marginBottom: 24 }}>
        Select a card. {needsTarget ? 'Then choose a target above.' : ''}
      </p>
      <HouseBanner house={priv?.house} />
      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 24 }}>
        {(priv?.hand || []).map((card) => (
          <Card key={card.id} card={card} house={priv?.house} selected={selectedCard === card.id} onClick={() => setSelectedCard(card.id)} />
        ))}
      </div>
      {selected && (
        <div style={{ marginTop: 24, maxWidth: 420, marginLeft: 'auto', marginRight: 'auto' }}>
          <AbilityText card={selected} accent={houseTheme.accent} />
          {needsTarget && (
            <div style={{ marginTop: 12, color: '#a1a1aa', fontSize: 14 }}>
              {selectedTarget
                ? `Target: ${pub.players.find((p) => p.id === selectedTarget)?.name}`
                : '◇ Select a target above ◇'}
            </div>
          )}
          <div style={{ marginTop: 16 }}>
            <NeonButton accent={houseTheme.accent} onClick={onConfirm} disabled={!ready}>Strike</NeonButton>
          </div>
        </div>
      )}
    </div>
  );
}

function ResolveView({ pub, houseTheme }) {
  return (
    <div style={{ width: '100%', maxWidth: 600, textAlign: 'center' }}>
      <h2 style={{ fontSize: 22, letterSpacing: '0.2em', color: houseTheme.accent, margin: '0 0 24px', animation: 'pulse 2s infinite' }}>
        BLADES FALL · RANK ORDER
      </h2>
      <div style={{ textAlign: 'left' }}>
        {(pub.revealed || []).map((e, i) => (
          <div key={i} style={{
            borderLeft: `2px solid ${HOUSES.CRANE.accent}`, paddingLeft: 16, padding: '8px 16px',
            fontSize: 13, animation: `slidein 0.4s ease-out ${i * 0.15}s both`,
          }}>
            <span style={{ color: '#71717a', fontSize: 10, letterSpacing: '0.15em', marginRight: 8 }}>
              R{String(e.rank).padStart(2, '0')}
            </span>
            <span style={{ color: '#e4e4e7' }}>{e.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RoundEndView({ pub, me, onNext }) {
  const isHost = me?.id === pub.hostId;
  const winner = (pub.houseScores?.CRANE || 0) > (pub.houseScores?.LOTUS || 0) ? 'CRANE' : 'LOTUS';
  return (
    <div style={{ textAlign: 'center', maxWidth: 480 }}>
      <h2 style={{ fontSize: 28, letterSpacing: '0.3em', color: HOUSES[winner].accent, margin: '0 0 24px' }}>
        ROUND {pub.round} ENDS
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        {['CRANE', 'LOTUS'].map((h) => (
          <div key={h} style={{ padding: 16, border: `1px solid ${HOUSES[h].accent}`, background: '#000' }}>
            <div style={{ fontSize: 11, letterSpacing: '0.3em', color: HOUSES[h].accent }}>HOUSE {h}</div>
            <div style={{ fontSize: 36, fontWeight: 900 }}>{pub.houseScores?.[h] || 0}</div>
            <div style={{ fontSize: 10, color: '#71717a' }}>/ 10 honor</div>
          </div>
        ))}
      </div>
      {isHost
        ? <NeonButton accent={HOUSES.CRANE.accent} onClick={onNext}>Begin Next Round</NeonButton>
        : <p style={{ color: '#71717a', fontStyle: 'italic', fontSize: 14 }}>The host calls the next round.</p>}
    </div>
  );
}

function GameEndView({ pub }) {
  const winner = (pub.houseScores?.CRANE || 0) > (pub.houseScores?.LOTUS || 0) ? 'CRANE' : 'LOTUS';
  const h = HOUSES[winner];
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 11, letterSpacing: '0.5em', color: h.accent, marginBottom: 16 }}>VICTORY</div>
      <h1 style={{ fontSize: 'clamp(48px, 10vw, 96px)', fontWeight: 900, letterSpacing: '-0.02em', color: h.accent, textShadow: `0 0 30px ${h.accent}`, margin: '0 0 16px' }}>
        HOUSE {winner}
      </h1>
      <p style={{ color: '#a1a1aa', fontStyle: 'italic', maxWidth: 420, margin: '0 auto' }}>"{h.motto}"</p>
      <div style={{ marginTop: 32, color: '#52525b', fontSize: 14 }}>
        Crane {pub.houseScores?.CRANE || 0}  ·  Lotus {pub.houseScores?.LOTUS || 0}
      </div>
    </div>
  );
}

function PrivatePanel({ info }) {
  return (
    <div style={{ padding: '8px 16px', borderTop: '1px solid rgba(180, 83, 9, 0.5)', background: 'rgba(120, 53, 15, 0.2)', color: '#fde68a', fontSize: 12 }}>
      <div style={{ fontSize: 9, letterSpacing: '0.3em', color: '#f59e0b', marginBottom: 4 }}>FOR YOUR EYES ONLY</div>
      {info.map((entry, i) => {
        let text = '';
        if (entry.kind === 'house_peek') text = `${entry.of} serves ${HOUSES[entry.house].name}.`;
        if (entry.kind === 'card_peek') text = `${entry.of} also holds Rank ${entry.rank} (${RANKS[entry.rank].name}).`;
        if (entry.kind === 'deck_peek') text = `Top of deck: ${entry.ranks.map((r) => RANKS[r].name).join(' → ')}.`;
        return <div key={i}>· {text}</div>;
      })}
    </div>
  );
}

function LogStrip({ log }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.scrollLeft = ref.current.scrollWidth; }, [log]);
  return (
    <div ref={ref} style={{
      borderTop: '1px solid #18181b', padding: '8px 16px',
      overflowX: 'auto', whiteSpace: 'nowrap', color: '#71717a', fontSize: 12,
    }}>
      {log.slice(-8).map((l, i) => <span key={i} style={{ marginRight: 24 }}>◇ {l.msg}</span>)}
    </div>
  );
}

function GlobalKeyframes() {
  return (
    <style>{`
      @keyframes inkrise {
        0% { transform: translateY(0) rotate(0deg); opacity: 0; }
        10% { opacity: 0.08; }
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
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.6; }
      }
    `}</style>
  );
}
