const assert = require('node:assert/strict');
const {
  CAMP_ORDER,
  OPPOSITE_CAMP,
  applyCoinEarnings,
  chooseSimpleComputerRoute,
  calculateJumpReward,
  calculateLegalMoves,
  calculateRankReward,
  calculateTargetReward,
  createBoardKeys,
  createPiecesForCamps,
  createPlayerCampLayout,
  createRandomPieces,
  createStandardPieces,
  createTwoPlayerPieces,
  createTargetCampKeys,
  createTargetRewardMap,
  enumerateSimpleComputerRoutes,
  formatClockSeconds,
  formatCoinUnits,
  hasPlayerWon,
  isFreshTurnLanding,
  roundTurnSeconds,
  settleRankRewards,
  settleTurnReward,
} = require('./rules');

const boardKeys = createBoardKeys();
const standardPieces = createStandardPieces();
const twoPlayerPieces = createTwoPlayerPieces();

assert.equal(boardKeys.size, 121);
assert.equal(standardPieces.size, 30);
assert.equal(twoPlayerPieces.size, 20);
assert.deepEqual(CAMP_ORDER, ['red', 'upperLeft', 'purple', 'bottom', 'green', 'upperRight']);
assert.deepEqual(createPlayerCampLayout(2), ['red', 'bottom']);
assert.deepEqual(createPlayerCampLayout(3), ['red', 'purple', 'green']);
assert.deepEqual(createPlayerCampLayout(4), ['upperLeft', 'purple', 'green', 'upperRight']);
assert.deepEqual(createPlayerCampLayout(5), ['red', 'upperLeft', 'purple', 'green', 'upperRight']);
assert.deepEqual(createPlayerCampLayout(6), CAMP_ORDER);
assert.throws(() => createPlayerCampLayout(1), /Unsupported player count/);
assert.equal(createPiecesForCamps(CAMP_ORDER).size, 60);
for (let playerCount = 2; playerCount <= 6; playerCount += 1) {
  const camps = CAMP_ORDER.slice(0, playerCount);
  const playerPieces = createPiecesForCamps(camps);
  assert.equal(playerPieces.size, playerCount * 10);
  camps.forEach((camp) => {
    assert.equal([...playerPieces.values()].filter((piece) => piece.color === camp).length, 10);
  });
}
assert.equal([...twoPlayerPieces.values()].filter((piece) => piece.color === 'red').length, 10);
assert.equal([...twoPlayerPieces.values()].filter((piece) => piece.color === 'bottom').length, 10);
assert.equal(
  [...twoPlayerPieces.entries()]
    .filter(([, piece]) => piece.color === 'bottom')
    .every(([pieceKey]) => createTargetCampKeys('red').has(pieceKey)),
  true,
);
assert.equal(
  [...twoPlayerPieces.entries()]
    .filter(([, piece]) => piece.color === 'red')
    .every(([pieceKey]) => createTargetCampKeys('bottom').has(pieceKey)),
  true,
);
assert.equal(hasPlayerWon({ pieces: twoPlayerPieces, color: 'red' }), false);
assert.equal(hasPlayerWon({ pieces: twoPlayerPieces, color: 'bottom' }), false);
const twoPlayerRandomPieces = createRandomPieces({
  boardKeys,
  count: 5,
  random: () => 0,
  colors: ['red', 'bottom'],
});
assert.deepEqual(
  [...twoPlayerRandomPieces.values()].map((piece) => piece.color),
  ['red', 'bottom', 'red', 'bottom', 'red'],
);
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

for (const color of CAMP_ORDER) {
  const winningPieces = new Map(
    [...createTargetCampKeys(color)].map((key, index) => [
      key,
      { color, id: `${color}-${index + 1}` },
    ]),
  );
  assert.equal(hasPlayerWon({ pieces: winningPieces, color }), true);

  const targetRewards = createTargetRewardMap(color);
  assert.equal(targetRewards.size, 10);
  assert.equal([...targetRewards.values()].reduce((sum, value) => sum + value, 0), 52);
  const startingCampKeys = new Set(
    [...createPiecesForCamps([OPPOSITE_CAMP[color]]).keys()],
  );
  assert.deepEqual(createTargetCampKeys(color), startingCampKeys);
  assert.deepEqual(
    Object.fromEntries([2, 4, 8, 16].map((value) => [
      value,
      [...targetRewards.values()].filter((reward) => reward === value).length,
    ])),
    { 2: 4, 4: 3, 8: 2, 16: 1 },
  );
  const deepestTarget = [...targetRewards].find(([, reward]) => reward === 16)[0];
  assert.equal(calculateTargetReward({ targetRewardMap: targetRewards, position: deepestTarget, claimedKeys: new Set() }), 16);
  assert.equal(calculateTargetReward({ targetRewardMap: targetRewards, position: deepestTarget, claimedKeys: new Set([deepestTarget]) }), 0);
}

assert.deepEqual(
  calculateJumpReward({ jumpNumber: 1, distance: 1 }),
  { continuousUnits: 0, longDistanceUnits: 0, totalUnits: 0 },
);
assert.deepEqual(
  calculateJumpReward({ jumpNumber: 2, distance: 1 }),
  { continuousUnits: 1, longDistanceUnits: 0, totalUnits: 1 },
);
assert.deepEqual(
  calculateJumpReward({ jumpNumber: 3, distance: 3 }),
  { continuousUnits: 1, longDistanceUnits: 2, totalUnits: 3 },
);
assert.equal(calculateJumpReward({ jumpNumber: 6, distance: 1 }).continuousUnits, 1);
assert.equal(calculateJumpReward({ jumpNumber: 7, distance: 1 }).continuousUnits, 0);
assert.equal(formatCoinUnits(100), '10.0');
assert.equal(formatCoinUnits(3, true), '+0.3');
assert.equal(formatCoinUnits(-5, true), '-0.5');
assert.equal(roundTurnSeconds(0), 1);
assert.equal(roundTurnSeconds(1), 1);
assert.equal(roundTurnSeconds(999), 1);
assert.equal(roundTurnSeconds(1000), 1);
assert.equal(roundTurnSeconds(1001), 2);
assert.equal(formatClockSeconds(0), '00:00');
assert.equal(formatClockSeconds(65), '01:05');
assert.equal(formatClockSeconds(3661), '1:01:01');
assert.equal(settleTurnReward({ jumpUnits: 3, targetUnits: 8, undoUsed: false }), 11);
assert.equal(settleTurnReward({ jumpUnits: 3, targetUnits: 8, undoUsed: true }), 6);
assert.equal(settleTurnReward({ jumpUnits: 0, targetUnits: 0, undoUsed: true }), -5);
assert.equal(calculateRankReward(1), 30);
assert.equal(calculateRankReward(2), 20);
assert.equal(calculateRankReward(3), 10);
assert.equal(calculateRankReward(4), 0);
assert.equal(calculateRankReward(0), 0);
const threePlayerRankSettlement = settleRankRewards({
  rankedPlayerIds: ['p1', 'p2', 'p3'],
  earnedUnitsByPlayer: new Map([['p1', 12], ['p2', -5], ['p3', 0]]),
});
assert.deepEqual([...threePlayerRankSettlement.rankRewardUnitsByPlayer], [['p1', 30], ['p2', 20], ['p3', 10]]);
assert.deepEqual([...threePlayerRankSettlement.totalUnitsByPlayer], [['p1', 42], ['p2', 15], ['p3', 10]]);
const twoPlayerRankSettlement = settleRankRewards({
  rankedPlayerIds: ['p1', 'p2'],
  earnedUnitsByPlayer: new Map([['p1', 0], ['p2', 0]]),
});
assert.deepEqual([...twoPlayerRankSettlement.rankRewardUnitsByPlayer], [['p1', 30], ['p2', 20]]);
assert.deepEqual([...twoPlayerRankSettlement.totalUnitsByPlayer], [['p1', 30], ['p2', 20]]);
assert.equal(applyCoinEarnings({ balanceUnits: 100, earnedUnits: 12 }), 112);
assert.equal(applyCoinEarnings({ balanceUnits: 3, earnedUnits: -5 }), 0);
assert.equal(isFreshTurnLanding({ visitedKeys: new Set(['0,0']), position: '1,0' }), true);
assert.equal(isFreshTurnLanding({ visitedKeys: new Set(['0,0']), position: '0,0' }), false);

const simpleComputerRoutes = enumerateSimpleComputerRoutes({
  boardKeys,
  pieces: standardPieces,
  color: 'red',
  maxRoutes: 120,
  maxJumpDepth: 12,
});
assert.equal(simpleComputerRoutes.length > 0, true);
assert.equal(simpleComputerRoutes.length <= 120, true);
assert.equal(simpleComputerRoutes.every(({ moves }) => moves.length <= 12), true);
assert.equal(simpleComputerRoutes.every(({ from, moves }) => {
  const landings = [from, ...moves.map(({ destination }) => destination)];
  return new Set(landings).size === landings.length;
}), true);

const advancingComputerMove = chooseSimpleComputerRoute({
  boardKeys,
  pieces: new Map([['0,0', { color: 'red', id: 'R-01' }]]),
  color: 'red',
  maxRoutes: 120,
  maxJumpDepth: 12,
  random: () => 0,
});
assert.equal(advancingComputerMove.pieceId, 'R-01');
assert.equal(['0,1', '-1,1'].includes(advancingComputerMove.to), true);
assert.equal(advancingComputerMove.moves.length, 1);

const formationComputerRoutes = enumerateSimpleComputerRoutes({
  boardKeys,
  pieces: new Map([
    ['0,-4', { color: 'red', id: 'R-BACK' }],
    ['-2,2', { color: 'red', id: 'R-FRONT' }],
  ]),
  color: 'red',
  maxRoutes: 120,
  maxJumpDepth: 12,
});
const bestFormationScore = (pieceId) => Math.max(
  ...formationComputerRoutes.filter((route) => route.pieceId === pieceId).map(({ score }) => score),
);
assert.equal(bestFormationScore('R-BACK') > bestFormationScore('R-FRONT'), true);
assert.equal(chooseSimpleComputerRoute({
  boardKeys,
  pieces: new Map([
    ['0,-4', { color: 'red', id: 'R-BACK' }],
    ['-2,2', { color: 'red', id: 'R-FRONT' }],
  ]),
  color: 'red',
  maxRoutes: 120,
  maxJumpDepth: 12,
  random: () => 0,
}).pieceId, 'R-BACK');

console.log('checkers web rules: all tests passed');
