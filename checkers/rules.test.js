const assert = require('node:assert/strict');
const {
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
} = require('./rules');

const boardKeys = createBoardKeys();
assert.equal(boardKeys.size, 121);

const standardPieces = createStandardPieces();
assert.equal(standardPieces.size, 30);
assert.equal([...standardPieces.values()].filter(({ color }) => color === 'red').length, 10);
assert.equal([...standardPieces.values()].filter(({ color }) => color === 'green').length, 10);
assert.equal([...standardPieces.values()].filter(({ color }) => color === 'purple').length, 10);
assert.equal([...standardPieces.keys()].every((pieceKey) => boardKeys.has(pieceKey)), true);

for (const color of ['red', 'green', 'purple']) {
  const targetKeys = createTargetCampKeys(color);
  assert.equal(targetKeys.size, 10);
  assert.equal([...targetKeys].every((targetKey) => boardKeys.has(targetKey)), true);
  assert.equal(hasPlayerWon({ pieces: standardPieces, color }), false);

  const winningPieces = new Map(
    [...targetKeys].map((targetKey, index) => [
      targetKey,
      { color, id: `${color}-${index + 1}` },
    ]),
  );
  assert.equal(hasPlayerWon({ pieces: winningPieces, color }), true);
  winningPieces.delete([...targetKeys][0]);
  assert.equal(hasPlayerWon({ pieces: winningPieces, color }), false);
}
assert.throws(() => createTargetCampKeys('blue'), /Unknown player color/);

const redTargetKeys = createTargetCampKeys('red');
const nearWinningRedPieces = new Map();
let nearWinningIndex = 1;
for (const targetKey of redTargetKeys) {
  if (targetKey === '-1,5') continue;
  nearWinningRedPieces.set(targetKey, {
    color: 'red',
    id: `R-${String(nearWinningIndex).padStart(2, '0')}`,
  });
  nearWinningIndex += 1;
}
nearWinningRedPieces.set('0,4', { color: 'red', id: 'R-10' });
const redFinalMoves = calculateLegalMoves({
  boardKeys,
  pieces: nearWinningRedPieces,
  q: 0,
  r: 4,
});
assert.deepEqual(redFinalMoves.get('-1,5'), { type: 'step', distance: 1 });
const completedRedPieces = movePiece({
  pieces: nearWinningRedPieces,
  fromKey: '0,4',
  toKey: '-1,5',
});
assert.equal(hasPlayerWon({ pieces: completedRedPieces, color: 'red' }), true);
const openingPieces = new Map([
  ['-8,4', { id: 'G-01' }],
  ['-7,3', { id: 'G-02' }],
  ['-7,4', { id: 'G-03' }],
  ['-6,2', { id: 'G-04' }],
]);
const g02Moves = calculateLegalMoves({ boardKeys, pieces: openingPieces, q: -7, r: 3 });

assert.deepEqual([...g02Moves.keys()].sort(), ['-5,1', '-6,3']);
assert.deepEqual(g02Moves.get('-6,3'), { type: 'step', distance: 1 });
assert.deepEqual(g02Moves.get('-5,1'), { type: 'jump', distance: 1, pivotId: 'G-04' });

const distantPieces = new Map([
  ['-4,0', { id: 'S-01' }],
  ['-1,0', { id: 'T-01' }],
]);
const distantMoves = calculateLegalMoves({ boardKeys, pieces: distantPieces, q: -4, r: 0 });
assert.deepEqual(distantMoves.get('2,0'), { type: 'jump', distance: 3, pivotId: 'T-01' });

const blockedPieces = new Map(distantPieces);
blockedPieces.set('0,0', { id: 'X-01' });
const blockedMoves = calculateLegalMoves({ boardKeys, pieces: blockedPieces, q: -4, r: 0 });
assert.equal(blockedMoves.has('2,0'), false);

const movedPieces = movePiece({ pieces: openingPieces, fromKey: '-7,3', toKey: '-5,1' });
assert.equal(movedPieces.has('-7,3'), false);
assert.equal(movedPieces.get('-5,1').id, 'G-02');
assert.equal(openingPieces.get('-7,3').id, 'G-02');
assert.throws(
  () => movePiece({ pieces: openingPieces, fromKey: '-7,3', toKey: '-6,2' }),
  /Destination occupied/,
);

assert.equal(nextPlayerIndex(0), 1);
assert.equal(nextPlayerIndex(1), 2);
assert.equal(nextPlayerIndex(2), 0);
assert.equal(canSelectPiece({ piece: { color: 'red', id: 'R-01' }, currentColor: 'red' }), true);
assert.equal(canSelectPiece({ piece: { color: 'green', id: 'G-01' }, currentColor: 'red' }), false);
assert.equal(canSelectPiece({ piece: { color: 'red', id: 'R-01' }, currentColor: 'red', lockedPieceId: 'R-02' }), false);
assert.equal(canSelectPiece({ piece: { color: 'red', id: 'R-02' }, currentColor: 'red', lockedPieceId: 'R-02' }), true);

const randomPieces = createSeededRandomPieces({ boardKeys, count: 5, seed: 20260716 });
assert.equal(randomPieces.size, 5);
assert.equal(new Set(randomPieces.keys()).size, 5);
assert.equal([...randomPieces.keys()].every((pieceKey) => boardKeys.has(pieceKey)), true);

let randomMoveCount = 0;
for (const pieceKey of randomPieces.keys()) {
  const [q, r] = pieceKey.split(',').map(Number);
  const moves = calculateLegalMoves({ boardKeys, pieces: randomPieces, q, r });
  randomMoveCount += moves.size;
  for (const landingKey of moves.keys()) {
    assert.equal(boardKeys.has(landingKey), true);
    assert.equal(randomPieces.has(landingKey), false);
  }
}
assert.equal(randomMoveCount > 0, true);

console.log(`checkers rules: all tests passed; random pieces=${[...randomPieces.keys()].join(' | ')}; legal moves=${randomMoveCount}`);
