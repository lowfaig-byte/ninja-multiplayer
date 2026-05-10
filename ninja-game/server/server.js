// server.js
// Night of the Ninja — authoritative game server.
// Handles room creation, draft phase, battle resolution in strict rank order,
// scoring, and multi-round play to 10 Honor.
//
// Critical invariant: the server is the ONLY source of truth for hidden info
// (House assignments + each player's hand). The server never broadcasts hidden
// state to other players' sockets — only to the owner's socket.

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuid } = require('uuid');

// Mirror minimal card data on the server side.
// (In a real monorepo these would be a shared package.)
const RANK_ORDER = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

const HONOR_TOKEN_VALUES = [2, 2, 3, 3, 3, 4, 4];
const POINTS_TO_WIN_GAME = 10;

function buildDeck(playerCount) {
  const distribution = {
    1: 2, 2: 3, 3: 4, 4: 3, 5: 3, 6: 2, 7: 3, 8: 1, 9: 2, 10: 1, 11: 2,
  };
  const deck = [];
  let id = 0;
  Object.entries(distribution).forEach(([rank, count]) => {
    const r = Number(rank);
    const copies = playerCount >= 8 ? count + 1 : count;
    for (let i = 0; i < copies; i++) deck.push({ id: `c${id++}`, rank: r });
  });
  return deck;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------------------------------------------------------------------------
// Express + Socket.io bootstrap
// ---------------------------------------------------------------------------
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.get('/', (_, res) => res.send('Night of the Ninja — server alive.'));
app.get('/health', (_, res) => res.json({ ok: true, rooms: rooms.size }));

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`🥷  listening on ${PORT}`));

// ---------------------------------------------------------------------------
// Room registry
// ---------------------------------------------------------------------------
const rooms = new Map(); // code -> Room

function makeRoomCode() {
  // 4-char A–Z (no I/O to avoid confusion)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code;
  do {
    code = Array.from({ length: 4 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join('');
  } while (rooms.has(code));
  return code;
}

function newRoom(hostName, hostSocket) {
  const code = makeRoomCode();
  const room = {
    code,
    hostId: hostSocket.id,
    phase: 'LOBBY', // LOBBY | DRAFT_1 | DRAFT_2 | BATTLE | RESOLVE | ROUND_END | GAME_END
    players: [],   // { id, name, socketId, alive, house, hand, played, honorKills }
    deck: [],
    discard: [],
    round: 0,
    log: [],
    houseScores: { CRANE: 0, LOTUS: 0 },
    // Battle turn state
    turn: 0, // 0 or 1 (two cards played per round)
    pending: {}, // playerId -> { cardId, targetId, resolved }
    revealed: [], // resolution log entries for current turn
    privateInfo: {}, // playerId -> arbitrary peek results, cleared each round
  };
  rooms.set(code, room);
  return room;
}

function publicState(room) {
  // Client-safe view: hides houses, hands, deck.
  return {
    code: room.code,
    phase: room.phase,
    round: room.round,
    hostId: room.hostId,
    houseScores: room.houseScores,
    log: room.log.slice(-20),
    turn: room.turn,
    revealed: room.revealed,
    deckSize: room.deck.length,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      alive: p.alive,
      // House revealed only at round end; otherwise hidden
      house: room.phase === 'ROUND_END' || room.phase === 'GAME_END' ? p.house : null,
      handSize: p.hand?.length ?? 0,
      playedCount: p.played?.length ?? 0,
      honorKills: p.honorKills || 0,
      isHost: p.id === room.hostId,
    })),
  };
}

function privateState(room, playerId) {
  const me = room.players.find((p) => p.id === playerId);
  if (!me) return null;
  return {
    house: me.house,
    hand: me.hand,
    played: me.played,
    privateInfo: room.privateInfo[playerId] || [],
  };
}

function broadcast(room) {
  const pub = publicState(room);
  io.to(room.code).emit('state:public', pub);
  // Per-socket private info
  room.players.forEach((p) => {
    io.to(p.socketId).emit('state:private', privateState(room, p.id));
  });
}

function logEvent(room, msg) {
  room.log.push({ at: Date.now(), msg });
  if (room.log.length > 200) room.log.shift();
}

// ---------------------------------------------------------------------------
// Game flow
// ---------------------------------------------------------------------------
function startRound(room) {
  if (room.players.length < 4) return; // safety
  room.round += 1;
  room.deck = shuffle(buildDeck(room.players.length));
  room.discard = [];
  room.revealed = [];
  room.turn = 0;
  room.privateInfo = {};

  // Assign houses ~50/50, slight Crane bias on odd counts
  const n = room.players.length;
  const half = Math.floor(n / 2);
  const houses = [
    ...Array(half).fill('LOTUS'),
    ...Array(n - half).fill('CRANE'),
  ];
  const shuffled = shuffle(houses);
  room.players.forEach((p, i) => {
    p.house = shuffled[i];
    p.alive = true;
    p.played = [];
    p.honorKills = 0;
    // Deal 3 cards each for the draft
    p.hand = room.deck.splice(0, 3);
  });

  room.phase = 'DRAFT_1';
  logEvent(room, `Round ${room.round} begins. Houses are sworn in shadow.`);
  broadcast(room);
}

// Draft phase: each player keeps 1 of 3, passes 2 left.
// Then keeps 1 of 2, passes 1 left. Final card discarded.
// We implement draft as: each player picks ONE card to KEEP. Remaining is passed.
function handleDraftPick(room, playerId, cardId) {
  const p = room.players.find((x) => x.id === playerId);
  if (!p || !p.hand.some((c) => c.id === cardId)) return;
  if (p._draftKeeping) return; // already chose this round
  p._draftKeeping = cardId;

  // When EVERYONE has chosen, resolve the pass.
  if (room.players.every((x) => x._draftKeeping)) {
    const passes = room.players.map((x) => {
      const kept = x.hand.find((c) => c.id === x._draftKeeping);
      const passed = x.hand.filter((c) => c.id !== x._draftKeeping);
      return { player: x, kept, passed };
    });

    // Pass LEFT (next index)
    const n = room.players.length;
    passes.forEach((entry, i) => {
      const leftIdx = (i + 1) % n;
      room.players[leftIdx]._incomingPass = entry.passed;
      // Stash kept card as "secured"
      entry.player._secured = entry.player._secured || [];
      entry.player._secured.push(entry.kept);
    });

    // Move incoming pass into hand
    room.players.forEach((x) => {
      x.hand = x._incomingPass || [];
      delete x._incomingPass;
      delete x._draftKeeping;
    });

    if (room.phase === 'DRAFT_1') {
      // Now hands are size 2 — second pick begins
      room.phase = 'DRAFT_2';
      logEvent(room, 'First pass complete. Choose your second card.');
    } else {
      // After DRAFT_2: each player keeps 1, the last card is discarded.
      room.players.forEach((x) => {
        const kept = x.hand[0]; // only 1 card left to "pick" — auto-secure
        x._secured.push(kept);
        room.discard.push(...x.hand.slice(1));
        x.hand = x._secured; // final 2-card hand for the battle
        delete x._secured;
      });
      room.phase = 'BATTLE';
      logEvent(room, 'The draft ends. Two blades remain in every hand.');
    }
  }
  broadcast(room);
}

// Battle: each player picks 1 of their 2 cards to play this turn + a target.
// When all alive players have committed, resolve in rank order.
function handleBattlePlay(room, playerId, cardId, targetId) {
  const p = room.players.find((x) => x.id === playerId);
  if (!p || !p.alive) return;
  if (room.pending[playerId]) return;
  if (!p.hand.some((c) => c.id === cardId)) return;
  room.pending[playerId] = { cardId, targetId };

  const allCommitted = room.players
    .filter((x) => x.alive)
    .every((x) => room.pending[x.id]);
  if (allCommitted) resolveTurn(room);
  else broadcast(room);
}

function resolveTurn(room) {
  room.phase = 'RESOLVE';
  const events = [];

  // Build resolution list, sorted by rank ascending
  const plays = [];
  Object.entries(room.pending).forEach(([pid, action]) => {
    const p = room.players.find((x) => x.id === pid);
    const card = p.hand.find((c) => c.id === action.cardId);
    if (!card) return;
    plays.push({ player: p, card, target: action.targetId });
  });
  plays.sort((a, b) => a.card.rank - b.card.rank);

  // State for resolution
  const dyingThisTurn = new Set();
  const protectedBy = {}; // wardId -> guardianId
  const spiritKills = []; // resolved last regardless of death

  for (const play of plays) {
    const { player: actor, card, target } = play;
    // Skip if actor already dying from earlier resolution AND card isn't 11
    if (!actor.alive && card.rank !== 11) continue;
    if (dyingThisTurn.has(actor.id) && card.rank !== 11) continue;

    const targetPlayer = room.players.find((x) => x.id === target);

    switch (card.rank) {
      case 1: { // Mystic — peek house
        if (targetPlayer) {
          room.privateInfo[actor.id] = room.privateInfo[actor.id] || [];
          room.privateInfo[actor.id].push({
            kind: 'house_peek',
            of: targetPlayer.name,
            house: targetPlayer.house,
          });
          events.push({ rank: 1, msg: `${actor.name} (Mystic) divines a soul.` });
        }
        break;
      }
      case 2: { // Blind Assassin — trap targeting Shinobi
        if (!targetPlayer) break;
        const tPlay = plays.find((p) => p.player.id === targetPlayer.id);
        if (tPlay && tPlay.card.rank === 3) {
          dyingThisTurn.add(targetPlayer.id);
          actor.honorKills = (actor.honorKills || 0) + 1;
          events.push({
            rank: 2,
            msg: `${actor.name}'s Blind Assassin springs the trap on ${targetPlayer.name} (Shinobi). They fall.`,
          });
        } else {
          events.push({
            rank: 2,
            msg: `${actor.name}'s trap closes on empty air.`,
          });
        }
        break;
      }
      case 3: { // Shinobi — kill, unless trapped (handled above) or guarded
        if (!targetPlayer) break;
        if (dyingThisTurn.has(actor.id)) break; // trapped
        if (protectedBy[targetPlayer.id]) {
          events.push({
            rank: 3,
            msg: `${actor.name}'s Shinobi strike at ${targetPlayer.name} is parried by their guardian.`,
          });
          break;
        }
        dyingThisTurn.add(targetPlayer.id);
        actor.honorKills = (actor.honorKills || 0) + 1;
        events.push({
          rank: 3,
          msg: `${actor.name} (Shinobi) cuts down ${targetPlayer.name}.`,
        });
        break;
      }
      case 4: { // Spy — peek unrevealed card
        if (!targetPlayer) break;
        const otherCard = targetPlayer.hand.find(
          (c) => c.id !== room.pending[targetPlayer.id]?.cardId
        );
        if (otherCard) {
          room.privateInfo[actor.id] = room.privateInfo[actor.id] || [];
          room.privateInfo[actor.id].push({
            kind: 'card_peek',
            of: targetPlayer.name,
            rank: otherCard.rank,
          });
          events.push({ rank: 4, msg: `${actor.name} (Spy) reads a hidden hand.` });
        }
        break;
      }
      case 5: { // Bodyguard
        if (!targetPlayer) break;
        protectedBy[targetPlayer.id] = actor.id;
        events.push({
          rank: 5,
          msg: `${actor.name} (Bodyguard) shields ${targetPlayer.name}.`,
        });
        break;
      }
      case 6: { // Diplomat — swap unplayed cards
        if (!targetPlayer) break;
        const myUnplayed = actor.hand.find(
          (c) => c.id !== room.pending[actor.id]?.cardId
        );
        const theirUnplayed = targetPlayer.hand.find(
          (c) => c.id !== room.pending[targetPlayer.id]?.cardId
        );
        if (myUnplayed && theirUnplayed) {
          actor.hand = actor.hand.map((c) => (c.id === myUnplayed.id ? theirUnplayed : c));
          targetPlayer.hand = targetPlayer.hand.map((c) =>
            c.id === theirUnplayed.id ? myUnplayed : c
          );
          events.push({
            rank: 6,
            msg: `${actor.name} (Diplomat) trades fates with ${targetPlayer.name}.`,
          });
        }
        break;
      }
      case 7: { // Samurai — duel
        if (!targetPlayer) break;
        const tPlay = plays.find((p) => p.player.id === targetPlayer.id);
        const myRank = card.rank;
        const theirRank = tPlay?.card?.rank ?? 0;
        if (theirRank === 0) {
          // Target didn't play (dead?). Auto-kill.
          if (!protectedBy[targetPlayer.id]) {
            dyingThisTurn.add(targetPlayer.id);
            actor.honorKills = (actor.honorKills || 0) + 1;
            events.push({
              rank: 7,
              msg: `${actor.name} (Samurai) duels ${targetPlayer.name} unopposed.`,
            });
          }
        } else if (myRank > theirRank) {
          if (!protectedBy[targetPlayer.id]) {
            dyingThisTurn.add(targetPlayer.id);
            actor.honorKills = (actor.honorKills || 0) + 1;
            events.push({
              rank: 7,
              msg: `${actor.name} (Samurai) prevails over ${targetPlayer.name}.`,
            });
          }
        } else if (myRank < theirRank) {
          dyingThisTurn.add(actor.id);
          targetPlayer.honorKills = (targetPlayer.honorKills || 0) + 1;
          events.push({
            rank: 7,
            msg: `${actor.name} (Samurai) is undone by ${targetPlayer.name}.`,
          });
        } else {
          events.push({
            rank: 7,
            msg: `${actor.name} and ${targetPlayer.name} cross blades. Steel rings, neither falls.`,
          });
        }
        break;
      }
      case 8: { // Daimyo — change a target (simplified: re-route attacker)
        if (!targetPlayer) break;
        // Find a play by the targetPlayer; redirect its target to a new random alive enemy
        const tPlay = plays.find((p) => p.player.id === targetPlayer.id);
        if (tPlay && tPlay.card.rank !== 8) {
          const candidates = room.players.filter(
            (x) => x.alive && x.id !== targetPlayer.id && !dyingThisTurn.has(x.id)
          );
          if (candidates.length) {
            const newTarget = candidates[Math.floor(Math.random() * candidates.length)];
            tPlay.target = newTarget.id;
            events.push({
              rank: 8,
              msg: `${actor.name} (Daimyo) redirects ${targetPlayer.name}'s blade to ${newTarget.name}.`,
            });
          }
        }
        break;
      }
      case 9: { // Oracle — peek deck top 3 (privately)
        const top = room.deck.slice(0, 3);
        room.privateInfo[actor.id] = room.privateInfo[actor.id] || [];
        room.privateInfo[actor.id].push({
          kind: 'deck_peek',
          ranks: top.map((c) => c.rank),
        });
        events.push({ rank: 9, msg: `${actor.name} (Oracle) reads the unwritten.` });
        break;
      }
      case 10: { // Shogun — bonus if survives, applied at round end
        actor._shogunBonus = true;
        events.push({
          rank: 10,
          msg: `${actor.name} reveals the Shogun. The court holds its breath.`,
        });
        break;
      }
      case 11: { // Shinobi Spirit — queue for after death
        spiritKills.push({ actor, target });
        break;
      }
    }
  }

  // Apply deaths from this turn before spirits act
  dyingThisTurn.forEach((id) => {
    const dead = room.players.find((x) => x.id === id);
    if (dead) dead.alive = false;
  });

  // Resolve Shinobi Spirits LAST — they fire even from death
  spiritKills.forEach(({ actor, target }) => {
    const t = room.players.find((x) => x.id === target);
    if (!t || !t.alive) return;
    // Spirit cannot be blocked by Bodyguard
    t.alive = false;
    actor.honorKills = (actor.honorKills || 0) + 1;
    events.push({
      rank: 11,
      msg: `${actor.name}'s Shinobi Spirit reaches from the void and takes ${t.name}.`,
    });
  });

  // Move played cards to discard, remove from hand
  Object.entries(room.pending).forEach(([pid, action]) => {
    const p = room.players.find((x) => x.id === pid);
    const idx = p.hand.findIndex((c) => c.id === action.cardId);
    if (idx >= 0) {
      const [played] = p.hand.splice(idx, 1);
      p.played = p.played || [];
      p.played.push(played);
      room.discard.push(played);
    }
  });

  room.revealed = [...(room.revealed || []), ...events];
  events.forEach((e) => logEvent(room, `[R${e.rank}] ${e.msg}`));
  room.pending = {};
  room.turn += 1;

  // After turn 1, go to second turn. After turn 2, end the round.
  if (room.turn < 2 && room.players.some((p) => p.alive && p.hand.length > 0)) {
    room.phase = 'BATTLE';
  } else {
    endRound(room);
    return;
  }
  broadcast(room);
}

function endRound(room) {
  // Determine winning house: house with most ALIVE members.
  // Tie-break: house with more total honor kills this round.
  const counts = { CRANE: 0, LOTUS: 0 };
  const kills = { CRANE: 0, LOTUS: 0 };
  room.players.forEach((p) => {
    if (p.alive) counts[p.house]++;
    kills[p.house] += p.honorKills || 0;
  });
  let winner;
  if (counts.CRANE > counts.LOTUS) winner = 'CRANE';
  else if (counts.LOTUS > counts.CRANE) winner = 'LOTUS';
  else winner = kills.CRANE >= kills.LOTUS ? 'CRANE' : 'LOTUS';

  // Honor token: random 2-4
  const tokenValue =
    HONOR_TOKEN_VALUES[Math.floor(Math.random() * HONOR_TOKEN_VALUES.length)];
  room.houseScores[winner] += tokenValue;

  // Survivors of winning house: +1 each
  let survivorBonus = 0;
  room.players.forEach((p) => {
    if (p.alive && p.house === winner) {
      room.houseScores[winner] += 1;
      survivorBonus += 1;
    }
  });

  // Each kill: +1 to the killer's house
  room.players.forEach((p) => {
    if (p.honorKills) room.houseScores[p.house] += p.honorKills;
  });

  // Shogun bonus
  room.players.forEach((p) => {
    if (p._shogunBonus && p.alive) {
      room.houseScores[p.house] += 2;
      logEvent(room, `${p.name}'s Shogun grants +2 Honor to House ${p.house}.`);
    }
    delete p._shogunBonus;
  });

  logEvent(
    room,
    `Round ${room.round} ends. House ${winner} claims ${tokenValue} Honor (+${survivorBonus} survivor honor).`
  );

  // Win condition
  if (
    room.houseScores.CRANE >= POINTS_TO_WIN_GAME ||
    room.houseScores.LOTUS >= POINTS_TO_WIN_GAME
  ) {
    room.phase = 'GAME_END';
    const champ =
      room.houseScores.CRANE > room.houseScores.LOTUS ? 'CRANE' : 'LOTUS';
    logEvent(room, `🏯 House ${champ} ascends. The night belongs to them.`);
  } else {
    room.phase = 'ROUND_END';
  }
  broadcast(room);
}

// ---------------------------------------------------------------------------
// Socket events
// ---------------------------------------------------------------------------
io.on('connection', (socket) => {
  socket.on('room:create', ({ name }, ack) => {
    const room = newRoom(name, socket);
    const player = {
      id: uuid(),
      name: (name || 'Shadow').slice(0, 16),
      socketId: socket.id,
      alive: true,
      hand: [],
      played: [],
      honorKills: 0,
    };
    room.players.push(player);
    room.hostId = player.id;
    socket.join(room.code);
    socket.data = { roomCode: room.code, playerId: player.id };
    ack?.({ ok: true, code: room.code, playerId: player.id });
    broadcast(room);
  });

  socket.on('room:join', ({ code, name }, ack) => {
    const room = rooms.get((code || '').toUpperCase());
    if (!room) return ack?.({ ok: false, error: 'Room not found.' });
    if (room.phase !== 'LOBBY')
      return ack?.({ ok: false, error: 'Game already in progress.' });
    if (room.players.length >= 8)
      return ack?.({ ok: false, error: 'Room is full (max 8).' });
    const player = {
      id: uuid(),
      name: (name || 'Shadow').slice(0, 16),
      socketId: socket.id,
      alive: true,
      hand: [],
      played: [],
      honorKills: 0,
    };
    room.players.push(player);
    socket.join(room.code);
    socket.data = { roomCode: room.code, playerId: player.id };
    ack?.({ ok: true, code: room.code, playerId: player.id });
    broadcast(room);
  });

  socket.on('room:start', () => {
    const { roomCode, playerId } = socket.data || {};
    const room = rooms.get(roomCode);
    if (!room || playerId !== room.hostId) return;
    if (room.players.length < 4) return;
    startRound(room);
  });

  socket.on('draft:pick', ({ cardId }) => {
    const { roomCode, playerId } = socket.data || {};
    const room = rooms.get(roomCode);
    if (!room) return;
    if (room.phase !== 'DRAFT_1' && room.phase !== 'DRAFT_2') return;
    handleDraftPick(room, playerId, cardId);
  });

  socket.on('battle:play', ({ cardId, targetId }) => {
    const { roomCode, playerId } = socket.data || {};
    const room = rooms.get(roomCode);
    if (!room || room.phase !== 'BATTLE') return;
    handleBattlePlay(room, playerId, cardId, targetId);
  });

  socket.on('round:next', () => {
    const { roomCode, playerId } = socket.data || {};
    const room = rooms.get(roomCode);
    if (!room || playerId !== room.hostId) return;
    if (room.phase !== 'ROUND_END') return;
    startRound(room);
  });

  socket.on('disconnect', () => {
    const { roomCode, playerId } = socket.data || {};
    if (!roomCode) return;
    const room = rooms.get(roomCode);
    if (!room) return;
    const idx = room.players.findIndex((p) => p.id === playerId);
    if (idx >= 0) {
      const [gone] = room.players.splice(idx, 1);
      logEvent(room, `${gone.name} fades into the mist.`);
      if (room.hostId === playerId && room.players.length) {
        room.hostId = room.players[0].id;
      }
      if (room.players.length === 0) {
        rooms.delete(roomCode);
        return;
      }
      broadcast(room);
    }
  });
});
