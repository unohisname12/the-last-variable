import { breakers, glitches } from "./gameData.js";

export function initialPlayers(breakerIds, glitchId, tiers = {}) {
  const chosenBreakers = breakerIds.map((id, index) => {
    const card = breakers.find((item) => item.id === id);
    return {
      id: `breaker-${id}`,
      cardId: id,
      name: card.name,
      role: "breaker",
      tier: tiers[id] || (index % 3) + 1,
      node: "start",
      frozen: false,
      cooldown: 0,
      used: false,
      shielded: false
    };
  });
  const glitch = glitches.find((item) => item.id === glitchId);
  return [
    ...chosenBreakers,
    {
      id: `glitch-${glitchId}`,
      cardId: glitchId,
      name: glitch.name,
      role: "glitch",
      tier: 3,
      node: "start",
      frozen: false,
      cooldown: 0,
      used: false,
      shielded: false
    }
  ];
}

export function drawProblem(deck) {
  return deck[Math.floor(Math.random() * deck.length)];
}

export function checkAnswer(input, answers) {
  const typed = normalize(input);
  return answers.some((answer) => normalize(answer) === typed || closeEnough(typed, normalize(answer)));
}

export function shortestPathStep(from, to, edges, barriers) {
  const blocked = new Set(barriers.map((barrier) => barrier.edge));
  const queue = [[from]];
  const seen = new Set([from]);
  while (queue.length) {
    const path = queue.shift();
    const here = path[path.length - 1];
    if (here === to) return path[1] || from;
    edges.forEach(([a, b]) => {
      if (blocked.has([a, b].sort().join("-"))) return;
      const next = a === here ? b : b === here ? a : "";
      if (next && !seen.has(next)) {
        seen.add(next);
        queue.push([...path, next]);
      }
    });
  }
  return from;
}

export function shortestPathDistance(from, to, edges, barriers) {
  if (from === to) return 0;
  const blocked = new Set(barriers.map((barrier) => barrier.edge));
  const queue = [[from, 0]];
  const seen = new Set([from]);
  while (queue.length) {
    const [here, distance] = queue.shift();
    for (const [a, b] of edges) {
      if (blocked.has([a, b].sort().join("-"))) continue;
      const next = a === here ? b : b === here ? a : "";
      if (!next || seen.has(next)) continue;
      if (next === to) return distance + 1;
      seen.add(next);
      queue.push([next, distance + 1]);
    }
  }
  return Infinity;
}

function normalize(value) {
  return String(value)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\$/g, "")
    .replace(/x\s*=/g, "")
    .replace(/−/g, "-")
    .trim();
}

function closeEnough(a, b) {
  const left = Number(a.replace("%", ""));
  const right = Number(b.replace("%", ""));
  if (Number.isNaN(left) || Number.isNaN(right)) return false;
  return Math.abs(left - right) <= 0.01;
}
