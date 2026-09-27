const assert = require('node:assert/strict');
const {
  BACKUP_FORMAT,
  balanceToUnits,
  createScoreBackup,
  mergeScoreBackup,
  parseScoreBackup,
} = require('./profile-backup');

const profiles = [
  { id: 'player-1', name: '乐乐', balanceUnits: 385 },
  { id: 'player-2', name: '妈妈', balanceUnits: 225 },
];
const backup = createScoreBackup(profiles, '2026-08-11T04:00:00.000Z');
assert.deepEqual(backup, {
  format: BACKUP_FORMAT,
  version: 1,
  exportedAt: '2026-08-11T04:00:00.000Z',
  players: [
    { name: '乐乐', balance: 38.5 },
    { name: '妈妈', balance: 22.5 },
  ],
});

assert.deepEqual(parseScoreBackup(JSON.stringify(backup)).players, [
  { name: '乐乐', balanceUnits: 385 },
  { name: '妈妈', balanceUnits: 225 },
]);
assert.equal(balanceToUnits(0.1), 1);
assert.equal(balanceToUnits(18.5), 185);
assert.equal(balanceToUnits(1.25), null);

const merged = mergeScoreBackup(
  profiles,
  [
    { name: ' 乐乐 ', balanceUnits: 420 },
    { name: '爸爸', balanceUnits: 160 },
  ],
  () => 'player-new',
);
assert.deepEqual(merged, {
  profiles: [
    { id: 'player-1', name: '乐乐', balanceUnits: 420 },
    { id: 'player-2', name: '妈妈', balanceUnits: 225 },
    { id: 'player-new', name: '爸爸', balanceUnits: 160 },
  ],
  addedCount: 1,
  updatedCount: 1,
});
assert.deepEqual(profiles, [
  { id: 'player-1', name: '乐乐', balanceUnits: 385 },
  { id: 'player-2', name: '妈妈', balanceUnits: 225 },
]);

assert.throws(() => parseScoreBackup('{}'), /不是闪光跳棋积分备份/);
assert.throws(() => parseScoreBackup('{broken'), /备份文件无法解析/);
assert.throws(() => parseScoreBackup(JSON.stringify({
  ...backup,
  players: [{ name: '乐乐', balance: 1.25 }],
})), /无效的昵称或金币余额/);
assert.throws(() => parseScoreBackup(JSON.stringify({
  ...backup,
  players: [{ name: '乐乐', balance: 1 }, { name: ' 乐乐 ', balance: 2 }],
})), /重复昵称/);

console.log('checkers profile backup: all tests passed');
