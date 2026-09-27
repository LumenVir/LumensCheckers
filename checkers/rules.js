const DIRECTIONS = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1],
];

function coordinateKey(q, r) {
  return `${q},${r}`;
}

function pointId(q, r) {
  return `P-${q + 8}-${r + 8}`;
}

function createBoardKeys() {
  const boardKeys = new Set();
  const add = (q, r) => boardKeys.add(coordinateKey(q, r));

  for (let q = -4; q <= 4; q += 1) {
    for (let r = -4; r <= 4; r += 1) {
      if (Math.abs(q + r) <= 4) add(q, r);
    }
  }
  for (let t = 1; t <= 4; t += 1) {
    for (let i = t; i <= 4; i += 1) {
      add(i, -4 - t);
      add(4 + t, -i);
      add(i, 4 + t - i);
      add(-i, 4 + t);
      add(-4 - t, i);
      add(-4 - t + i, -i);
    }
  }
  return boardKeys;
}

function createStandardPieces() {
  const pieces = new Map();
  const counters = { red: 0, green: 0, purple: 0 };
  const prefixes = { red: 'R', green: 'G', purple: 'P' };
  const addPiece = (q, r, color) => {
    counters[color] += 1;
    pieces.set(coordinateKey(q, r), {
      color,
      id: `${prefixes[color]}-${String(counters[color]).padStart(2, '0')}`,
    });
  };

  for (let t = 4; t >= 1; t -= 1) {
    for (let i = t; i <= 4; i += 1) {
      addPiece(i, -4 - t, 'red');
      addPiece(i, 4 + t - i, 'green');
      addPiece(-4 - t, i, 'purple');
    }
  }
  return pieces;
}

function createTargetCampKeys(color) {
  const targetKeys = new Set();
  const add = (q, r) => targetKeys.add(coordinateKey(q, r));

  if (!['red', 'green', 'purple'].includes(color)) {
    throw new Error(`Unknown player color: ${color}`);
  }

  for (let t = 1; t <= 4; t += 1) {
    for (let i = t; i <= 4; i += 1) {
      if (color === 'red') add(-i, 4 + t);
      if (color === 'green') add(-4 - t + i, -i);
      if (color === 'purple') add(4 + t, -i);
    }
  }
  return targetKeys;
}

function hasPlayerWon({ pieces, color, requiredPieces = 10 }) {
  const targetKeys = createTargetCampKeys(color);
  const playerPositions = [...pieces.entries()]
    .filter(([, piece]) => piece.color === color)
    .map(([pieceKey]) => pieceKey);

  return playerPositions.length === requiredPieces
    && playerPositions.every((pieceKey) => targetKeys.has(pieceKey));
}

function createSeededRandomPieces({ boardKeys, count = 5, seed = 20260716 }) {
  let state = seed >>> 0;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const available = [...boardKeys];
  const pieces = new Map();

  for (let index = 0; index < count && available.length > 0; index += 1) {
    const chosenIndex = Math.floor(random() * available.length);
    const [chosenKey] = available.splice(chosenIndex, 1);
    pieces.set(chosenKey, {
      color: ['red', 'green', 'purple'][index % 3],
      id: `T-${String(index + 1).padStart(2, '0')}`,
    });
  }
  return pieces;
}

function calculateLegalMoves({ boardKeys, pieces, q, r }) {
  const moves = new Map();

  for (const [dq, dr] of DIRECTIONS) {
    const adjacentKey = coordinateKey(q + dq, r + dr);
    if (boardKeys.has(adjacentKey) && !pieces.has(adjacentKey)) {
      moves.set(adjacentKey, { type: 'step', distance: 1 });
    }

    let distance = 1;
    while (boardKeys.has(coordinateKey(q + dq * distance, r + dr * distance))) {
      const scanKey = coordinateKey(q + dq * distance, r + dr * distance);
      const pivot = pieces.get(scanKey);

      if (pivot) {
        let clear = true;
        for (let n = distance + 1; n < distance * 2; n += 1) {
          const betweenKey = coordinateKey(q + dq * n, r + dr * n);
          if (!boardKeys.has(betweenKey) || pieces.has(betweenKey)) {
            clear = false;
            break;
          }
        }

        const landingKey = coordinateKey(
          q + dq * distance * 2,
          r + dr * distance * 2,
        );
        if (clear && boardKeys.has(landingKey) && !pieces.has(landingKey)) {
          moves.set(landingKey, {
            type: 'jump',
            distance,
            pivotId: pivot.id,
          });
        }
        break;
      }

      distance += 1;
    }
  }

  return moves;
}

function movePiece({ pieces, fromKey, toKey }) {
  const piece = pieces.get(fromKey);
  if (!piece) throw new Error(`No piece at ${fromKey}`);
  if (pieces.has(toKey)) throw new Error(`Destination occupied: ${toKey}`);

  const nextPieces = new Map(pieces);
  nextPieces.delete(fromKey);
  nextPieces.set(toKey, piece);
  return nextPieces;
}

function nextPlayerIndex(currentIndex, playerCount = 3) {
  if (!Number.isInteger(playerCount) || playerCount < 1) {
    throw new Error('playerCount must be a positive integer');
  }
  return (currentIndex + 1) % playerCount;
}

function canSelectPiece({ piece, currentColor, lockedPieceId = null }) {
  if (!piece || piece.color !== currentColor) return false;
  return lockedPieceId === null || piece.id === lockedPieceId;
}

module.exports = {
  DIRECTIONS,
  canSelectPiece,
  calculateLegalMoves,
  coordinateKey,
  createBoardKeys,
  createSeededRandomPieces,
  createStandardPieces,
  createTargetCampKeys,
  hasPlayerWon,
  movePiece,
  nextPlayerIndex,
  pointId,
};
