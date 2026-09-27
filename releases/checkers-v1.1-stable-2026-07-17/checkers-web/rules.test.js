const assert = require('node:assert/strict');
const {
  calculateLegalMoves,
  createBoardKeys,
  createStandardPieces,
  createTargetCampKeys,
  hasPlayerWon,
} = require('./rules');

const boardKeys = createBoardKeys();
const standardPieces = createStandardPieces();

assert.equal(boardKeys.size, 121);
assert.equal(standardPieces.size, 30);
assert.deepEqual(
  Object.fromEntries(['red', 'green', 'purple'].map((color) => [
    color,
    [...standardPieces.values()].filter((piece) => piece.color === color).length,
  ])),
  { red: 10, green: 10, purple: 10 },
);

const distantPieces = new Map([
  ['-4,0', { color: 'red', id: 'R-01' }],
  ['-1,0', { color: 'green', id: 'G-01' }],
]);
assert.deepEqual(
  calculateLegalMoves({ boardKeys, pieces: distantPieces, q: -4, r: 0 }).get('2,0'),
  { type: 'jump', distance: 3, pivotId: 'G-01' },
);

for (const color of ['red', 'green', 'purple']) {
  const winningPieces = new Map(
    [...createTargetCampKeys(color)].map((key, index) => [
      key,
      { color, id: `${color}-${index + 1}` },
    ]),
  );
  assert.equal(hasPlayerWon({ pieces: winningPieces, color }), true);
}

console.log('checkers web rules: all tests passed');
