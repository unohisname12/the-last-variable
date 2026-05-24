import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Crosshair,
  DoorOpen,
  Flame,
  Gauge,
  HeartPulse,
  Lock,
  Play,
  RotateCcw,
  Shield,
  Zap
} from "lucide-react";
import "./styles.css";
import { breakers, glitches, problemDecks, skillNames } from "./gameData.js";
import { checkAnswer, drawProblem, initialPlayers, shortestPathDistance, shortestPathStep } from "./rules.js";

const nodeNames = {
  start: "Start",
  cache: "Cache",
  fracGen: "Fraction Generator",
  bridge: "Data Bridge",
  algGen: "Algebra Generator",
  firewall: "Firewall",
  geoGen: "Geometry Generator",
  exit: "Exit Node",
  archive: "Archive",
  mirror: "Mirror Port",
  medbay: "Medbay",
  trap: "Trap Node"
};

const nodes = [
  { id: "start", x: 10, y: 50, type: "start" },
  { id: "cache", x: 24, y: 25 },
  { id: "fracGen", x: 38, y: 17, type: "generator", skill: "fractions" },
  { id: "bridge", x: 45, y: 48 },
  { id: "algGen", x: 63, y: 28, type: "generator", skill: "algebra" },
  { id: "firewall", x: 74, y: 52 },
  { id: "geoGen", x: 54, y: 77, type: "generator", skill: "geometry" },
  { id: "exit", x: 90, y: 50, type: "exit" },
  { id: "archive", x: 24, y: 74 },
  { id: "mirror", x: 70, y: 82 },
  { id: "medbay", x: 39, y: 57 },
  { id: "trap", x: 58, y: 8 }
];

const edges = [
  ["start", "cache"],
  ["start", "archive"],
  ["cache", "fracGen"],
  ["cache", "bridge"],
  ["archive", "medbay"],
  ["archive", "geoGen"],
  ["fracGen", "bridge"],
  ["bridge", "algGen"],
  ["bridge", "medbay"],
  ["bridge", "geoGen"],
  ["algGen", "firewall"],
  ["algGen", "trap"],
  ["firewall", "exit"],
  ["firewall", "mirror"],
  ["geoGen", "mirror"],
  ["mirror", "exit"],
  ["trap", "algGen"]
];

const maxRounds = 12;

function freshGame(config) {
  const players = initialPlayers(config.breakerIds, config.glitchId, config.tiers);
  return {
    phase: "playing",
    round: 1,
    active: 0,
    moved: 0,
    generators: { fracGen: false, algGen: false, geoGen: false },
    barriers: [],
    decoy: null,
    extraTurnFor: null,
    log: ["The mainframe is collapsing. Breakers move first."],
    players
  };
}

function App() {
  const [screen, setScreen] = useState("setup");
  const [config, setConfig] = useState({
    breakerIds: ["hacker", "medic", "engineer"],
    tiers: { hacker: 1, medic: 2, engineer: 3 },
    glitchId: "corruptor"
  });
  const [game, setGame] = useState(() => freshGame(config));
  const [challenge, setChallenge] = useState(null);
  const [answer, setAnswer] = useState("");

  const activePlayer = game.players[game.active];
  const activeCard = getCard(activePlayer);
  const winner = getWinner(game);

  function start() {
    const next = freshGame(config);
    setGame(next);
    setChallenge(null);
    setAnswer("");
    setScreen("game");
  }

  function updateGame(updater) {
    setGame((current) => {
      if (getWinner(current)) return current;
      return updater(current);
    });
  }

  function addLog(current, line) {
    return { ...current, log: [line, ...current.log].slice(0, 8) };
  }

  function movePlayer(nodeId) {
    updateGame((current) => {
      const player = current.players[current.active];
      if (player.frozen) return addLog(current, `${player.name} is frozen and cannot move.`);
      if (!canMoveTo(current, player, nodeId)) return current;
      const players = current.players.map((p, index) =>
        index === current.active ? { ...p, node: nodeId } : p
      );
      let next = { ...current, players, moved: current.moved + 1 };
      if (player.role === "glitch") {
        const victims = players.filter((p) => p.role === "breaker" && p.node === nodeId && !p.frozen);
        if (victims.length) {
          next.players = players.map((p) =>
            p.role === "breaker" && p.node === nodeId
              ? p.shielded ? { ...p, shielded: false } : { ...p, frozen: true }
              : p
          );
          const frozen = victims.filter((v) => !v.shielded);
          const blocked = victims.filter((v) => v.shielded);
          if (frozen.length) next = addLog(next, `The Glitch froze ${frozen.map((v) => v.name).join(", ")}.`);
          if (blocked.length) next = addLog(next, `${blocked.map((v) => v.name).join(", ")} blocked the freeze.`);
        }
      }
      return next;
    });
  }

  function beginChallenge(kind, payload = {}) {
    const player = activePlayer;
    if (player.frozen) return;
    const skill = payload.skill || activeCard.skill || "mixed";
    const deckSkill = skill === "mixed" || skill === "any" ? pickMixedSkill() : skill;
    const tier = player.role === "glitch" ? 3 : player.tier;
    const problem = drawProblem(problemDecks[deckSkill][tier]);
    setChallenge({ kind, payload, playerId: player.id, deckSkill, tier, problem });
    setAnswer("");
  }

  function submitAnswer() {
    if (!challenge) return;
    const correct = checkAnswer(answer, challenge.problem.answers);
    updateGame((current) => {
      const player = current.players[current.active];
      if (!correct) {
        return endTurn(addLog(current, `${player.name}'s solve fizzled. Correct answer: ${challenge.problem.answers[0]}.`));
      }
      let next = applyChallengeSuccess(current, challenge);
      next = addLog(next, `${player.name} solved ${skillNames[challenge.deckSkill]}: ${challenge.problem.prompt}`);
      return next;
    });
    setChallenge(null);
    setAnswer("");
  }

  function applyChallengeSuccess(current, item) {
    const player = current.players[current.active];
    if (item.kind === "generator") {
      return {
        ...current,
        generators: { ...current.generators, [item.payload.nodeId]: true }
      };
    }
    if (item.kind === "revive") {
      return {
        ...current,
        players: current.players.map((p) => (p.id === item.payload.targetId ? { ...p, frozen: false } : p))
      };
    }
    if (item.kind === "power") {
      return applyPower(current, player, item.payload);
    }
    return current;
  }

  function applyPower(current, player, payload) {
    const cooldown = activeCard.cooldown || 0;
    const markPower = (next) => ({
      ...next,
      players: next.players.map((p) =>
        p.id === player.id
          ? { ...p, cooldown: cooldown || p.cooldown, used: activeCard.once ? true : p.used }
          : p
      )
    });
    if (player.cardId === "hacker") {
      const generator = nodes.find((node) => node.type === "generator" && !current.generators[node.id]);
      return markPower(generator ? { ...current, generators: { ...current.generators, [generator.id]: true } } : current);
    }
    if (player.cardId === "medic") {
      const target = current.players.find((p) => p.role === "breaker" && p.frozen);
      return markPower(target ? { ...current, players: current.players.map((p) => p.id === target.id ? { ...p, frozen: false } : p) } : current);
    }
    if (player.cardId === "scout") {
      const glitch = current.players.find((p) => p.role === "glitch");
      return markPower(addLog(current, `Ping locates The Glitch at ${nodeNames[glitch.node]}.`));
    }
    if (player.cardId === "engineer") {
      const barrier = availableEdges(current, player.node)[0];
      return markPower(barrier ? { ...current, barriers: [...current.barriers, { edge: barrier.sort().join("-"), rounds: 2 }] } : current);
    }
    if (player.cardId === "runner") {
      return markPower({ ...current, moved: Math.max(0, current.moved - 3) });
    }
    if (player.cardId === "decoder") {
      return markPower(addLog(current, "Translate is spent. The table may share one hidden clue out loud."));
    }
    if (player.cardId === "guardian") {
      return markPower({ ...current, players: current.players.map((p) => p.id === player.id ? { ...p, shielded: true } : p) });
    }
    if (player.cardId === "trickster") {
      return markPower({ ...current, decoy: "trap" });
    }
    if (player.cardId === "corruptor") {
      return markPower({ ...current, barriers: [...current.barriers, { edge: "firewall-exit", rounds: 2 }] });
    }
    if (player.cardId === "stalker") {
      const target = nearestBreaker(current, player.node);
      const nextNode = target ? shortestPathStep(player.node, target.node, edges, current.barriers) : player.node;
      return markPower({
        ...current,
        players: current.players.map((p) => p.id === player.id ? { ...p, node: nextNode } : p)
      });
    }
    if (player.cardId === "overclock") {
      return markPower(addLog({ ...current, extraTurnFor: player.id }, "Surge armed. The Overclock will act again immediately after this turn."));
    }
    return current;
  }

  function finishTurn() {
    updateGame((current) => endTurn(current));
  }

  function endTurn(current) {
    const atEnd = current.active === current.players.length - 1;
    const active = current.players[current.active];
    if (current.extraTurnFor === active.id) {
      return addLog({ ...current, moved: 0, extraTurnFor: null }, `${active.name} surges into an extra turn.`);
    }
    const players = atEnd
      ? current.players.map((p) => ({ ...p, cooldown: Math.max(0, p.cooldown - 1), shielded: false }))
      : current.players;
    return {
      ...current,
      active: atEnd ? 0 : current.active + 1,
      round: atEnd ? current.round + 1 : current.round,
      moved: 0,
      barriers: atEnd ? current.barriers.map((b) => ({ ...b, rounds: b.rounds - 1 })).filter((b) => b.rounds > 0) : current.barriers,
      players,
      decoy: atEnd ? null : current.decoy
    };
  }

  const neighbors = game.decoy && activePlayer.role === "glitch"
    ? [shortestPathStep(activePlayer.node, game.decoy, edges, game.barriers)].filter((id) => id && id !== activePlayer.node)
    : availableEdges(game, activePlayer.node).flat().filter((id) => id !== activePlayer.node);
  const currentNode = nodes.find((node) => node.id === activePlayer.node);
  const frozenBreakers = game.players.filter((p) => p.role === "breaker" && p.frozen);

  return (
    <main>
      {screen === "setup" ? (
        <Setup config={config} setConfig={setConfig} start={start} />
      ) : (
        <>
          <header className="topbar">
            <div>
              <p className="eyebrow">The Last Variable</p>
              <h1>Mainframe Escape</h1>
            </div>
            <div className="statusStrip">
              <span>Round {Math.min(game.round, maxRounds)} / {maxRounds}</span>
              <span>{winner || `${activePlayer.name}'s turn`}</span>
              <button className="iconButton" onClick={start} title="Restart"><RotateCcw size={18} /></button>
            </div>
          </header>

          <section className="gameShell">
            <aside className="panel roster">
              {game.players.map((player, index) => (
                <PlayerCard key={player.id} player={player} active={index === game.active} />
              ))}
            </aside>

            <Board
              game={game}
              activePlayer={activePlayer}
              neighbors={neighbors}
              movePlayer={movePlayer}
            />

            <aside className="panel controls">
              <h2>{activeCard.name}</h2>
              <p className="small">{activeCard.power}: {activeCard.effect}</p>
              <div className="meter">
                <span>Move</span>
                <strong>{game.moved} / {activePlayer.role === "glitch" ? 4 : 3}</strong>
              </div>
              <button disabled={!!winner || activePlayer.frozen || activePlayer.cooldown > 0 || activePlayer.used} onClick={() => beginChallenge("power")}><Zap size={18} /> Use Power</button>
              {currentNode?.type === "generator" && !game.generators[currentNode.id] && activePlayer.role === "breaker" && !activePlayer.frozen && (
                <button onClick={() => beginChallenge("generator", { nodeId: currentNode.id, skill: currentNode.skill })}><Activity size={18} /> Bring Generator Online</button>
              )}
              {activePlayer.role === "breaker" && !activePlayer.frozen && frozenBreakers.some((p) => p.node === activePlayer.node && p.id !== activePlayer.id) && (
                <button onClick={() => beginChallenge("revive", { targetId: frozenBreakers.find((p) => p.node === activePlayer.node).id, skill: "percentages" })}><HeartPulse size={18} /> Revive Teammate</button>
              )}
              <button onClick={finishTurn}><ArrowRight size={18} /> End Turn</button>
              <ObjectivePanel game={game} winner={winner} />
              <Log lines={game.log} />
            </aside>
          </section>

          {challenge && (
            <ChallengeModal challenge={challenge} answer={answer} setAnswer={setAnswer} submitAnswer={submitAnswer} close={() => setChallenge(null)} />
          )}
        </>
      )}
    </main>
  );
}

function Setup({ config, setConfig, start }) {
  function toggleBreaker(id) {
    const ids = config.breakerIds.includes(id)
      ? config.breakerIds.filter((item) => item !== id)
      : [...config.breakerIds, id].slice(0, 4);
    if (ids.length >= 3) {
      setConfig({ ...config, breakerIds: ids, tiers: { ...config.tiers, [id]: config.tiers[id] || 2 } });
    }
  }
  function setTier(id, tier) {
    setConfig({ ...config, tiers: { ...config.tiers, [id]: tier } });
  }
  return (
    <section className="setup">
      <div className="cover">
        <img src="/art/img/cover.png" alt="The Last Variable cover" />
      </div>
      <div className="setupPanel">
        <p className="eyebrow">Middle-school math escape game</p>
        <h1>The Last Variable</h1>
        <p>Pick 3-4 Circuit Breakers and one Glitch. Every power is fueled by differentiated math.</p>
        <h2>Circuit Breakers</h2>
        <div className="pickerGrid">
          {breakers.map((card) => (
            <button key={card.id} className={config.breakerIds.includes(card.id) ? "selected pick" : "pick"} onClick={() => toggleBreaker(card.id)}>
              <img src={card.img} alt="" />
              <span>{card.name}</span>
            </button>
          ))}
        </div>
        <h2>Private Tiers</h2>
        <div className="tierRows">
          {config.breakerIds.map((id) => {
            const card = breakers.find((item) => item.id === id);
            return (
              <div className="tierRow" key={id}>
                <span>{card.name}</span>
                {[1, 2, 3].map((tier) => (
                  <button key={tier} className={config.tiers[id] === tier ? "selected" : ""} onClick={() => setTier(id, tier)}>T{tier}</button>
                ))}
              </div>
            );
          })}
        </div>
        <h2>The Glitch</h2>
        <div className="pickerGrid three">
          {glitches.map((card) => (
            <button key={card.id} className={config.glitchId === card.id ? "selected pick" : "pick"} onClick={() => setConfig({ ...config, glitchId: card.id })}>
              <img src={card.img} alt="" />
              <span>{card.name}</span>
            </button>
          ))}
        </div>
        <button className="startButton" onClick={start}><Play size={20} /> Start Game</button>
      </div>
    </section>
  );
}

function Board({ game, activePlayer, neighbors, movePlayer }) {
  return (
    <section className="boardWrap">
      <div className="board">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="edgeLayer">
          {edges.map(([a, b]) => {
            const from = nodes.find((node) => node.id === a);
            const to = nodes.find((node) => node.id === b);
            const blocked = game.barriers.some((barrier) => barrier.edge === [a, b].sort().join("-"));
            return <line key={`${a}-${b}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} className={blocked ? "blockedEdge" : ""} />;
          })}
        </svg>
        {nodes.map((node) => {
          const occupants = game.players.filter((p) => p.node === node.id);
          const canMove = neighbors.includes(node.id) && game.moved < (activePlayer.role === "glitch" ? 4 : 3);
          return (
            <button key={node.id} className={`node ${node.type || ""} ${canMove ? "reachable" : ""}`} style={{ left: `${node.x}%`, top: `${node.y}%` }} onClick={() => canMove && movePlayer(node.id)}>
              {node.type === "generator" && (game.generators[node.id] ? <Flame size={18} /> : <Gauge size={18} />)}
              {node.type === "exit" && <DoorOpen size={18} />}
              {node.type === "start" && <Crosshair size={18} />}
              <span>{nodeNames[node.id]}</span>
              <div className="tokens">
                {occupants.map((player) => <i key={player.id} className={player.role}>{player.name[0]}</i>)}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function PlayerCard({ player, active }) {
  const card = getCard(player);
  return (
    <div className={`miniCard ${active ? "active" : ""}`}>
      <img src={card.img} alt="" />
      <div>
        <strong>{player.name}</strong>
        <span>{player.role === "glitch" ? "Tier 3 timed" : `Tier ${player.tier}`}</span>
        <small>{nodeNames[player.node]} {player.frozen ? "- frozen" : ""}</small>
      </div>
      {player.cooldown > 0 && <b>{player.cooldown}</b>}
      {player.shielded && <Shield size={17} />}
      {player.frozen && <Lock size={17} />}
    </div>
  );
}

function ObjectivePanel({ game, winner }) {
  return (
    <div className="objectives">
      <h3>Objectives</h3>
      {Object.entries(game.generators).map(([id, online]) => (
        <span key={id} className={online ? "done" : ""}>{online ? "Online" : "Offline"}: {nodeNames[id]}</span>
      ))}
      {winner && <strong className="winner"><AlertTriangle size={18} /> {winner}</strong>}
    </div>
  );
}

function ChallengeModal({ challenge, answer, setAnswer, submitAnswer, close }) {
  return (
    <div className="modalBackdrop">
      <div className="modal">
        <p className="eyebrow">{skillNames[challenge.deckSkill]} - Tier {challenge.tier}</p>
        <h2>{challenge.problem.prompt}</h2>
        <input autoFocus value={answer} onChange={(event) => setAnswer(event.target.value)} onKeyDown={(event) => event.key === "Enter" && submitAnswer()} placeholder="Type answer" />
        <div className="modalActions">
          <button onClick={submitAnswer}><Zap size={18} /> Submit Solve</button>
          <button className="secondary" onClick={close}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function Log({ lines }) {
  return (
    <div className="log">
      <h3>System Log</h3>
      {lines.map((line, index) => <p key={`${line}-${index}`}>{line}</p>)}
    </div>
  );
}

function getCard(player) {
  return [...breakers, ...glitches].find((card) => card.id === player.cardId);
}

function pickMixedSkill() {
  return ["fractions", "algebra", "geometry", "percentages"][Math.floor(Math.random() * 4)];
}

function availableEdges(game, nodeId) {
  return edges.filter(([a, b]) => {
    const key = [a, b].sort().join("-");
    return (a === nodeId || b === nodeId) && !game.barriers.some((barrier) => barrier.edge === key);
  });
}

function canMoveTo(game, player, nodeId) {
  const limit = player.role === "glitch" ? 4 : 3;
  if (nodeId === player.node) return false;
  if (game.decoy && player.role === "glitch") {
    return game.moved < limit && nodeId === shortestPathStep(player.node, game.decoy, edges, game.barriers);
  }
  return game.moved < limit && availableEdges(game, player.node).some(([a, b]) => a === nodeId || b === nodeId);
}

function nearestBreaker(game, from) {
  return game.players
    .filter((p) => p.role === "breaker" && !p.frozen && p.node !== from)
    .map((p) => ({ player: p, distance: shortestPathDistance(from, p.node, edges, game.barriers) }))
    .sort((a, b) => a.distance - b.distance)[0]?.player;
}

function getWinner(game) {
  const allGenerators = Object.values(game.generators).every(Boolean);
  const escaped = game.players.some((p) => p.role === "breaker" && p.node === "exit");
  const allFrozen = game.players.filter((p) => p.role === "breaker").every((p) => p.frozen);
  if (allGenerators && escaped) return "Circuit Breakers win";
  if (allFrozen) return "The Glitch wins";
  if (game.round > maxRounds) return "The Glitch wins";
  return "";
}

createRoot(document.getElementById("root")).render(<App />);
