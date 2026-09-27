(function initProfileBackup(globalScope) {
  'use strict';

  const BACKUP_FORMAT = 'lumen-checkers-score-backup';
  const BACKUP_VERSION = 1;
  const MAX_PROFILES = 100;
  const MAX_NAME_LENGTH = 12;

  function normalizeName(name) {
    return name.trim().toLocaleLowerCase('zh-CN');
  }

  function unitsToBalance(balanceUnits) {
    return Number((balanceUnits / 10).toFixed(1));
  }

  function balanceToUnits(balance) {
    if (typeof balance !== 'number' || !Number.isFinite(balance)) return null;
    const balanceUnits = Math.round(balance * 10);
    if (Math.abs(balanceUnits / 10 - balance) > Number.EPSILON * 100) return null;
    return balanceUnits;
  }

  function createScoreBackup(profiles, exportedAt = new Date().toISOString()) {
    return {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt,
      players: profiles.map(({ name, balanceUnits }) => ({
        name,
        balance: unitsToBalance(balanceUnits),
      })),
    };
  }

  function parseScoreBackup(input) {
    let backup = input;
    if (typeof input === 'string') {
      try {
        backup = JSON.parse(input);
      } catch {
        throw new Error('备份文件无法解析，请选择闪光跳棋导出的 JSON 文件。');
      }
    }
    if (!backup || backup.format !== BACKUP_FORMAT || backup.version !== BACKUP_VERSION) {
      throw new Error('这不是闪光跳棋积分备份，或备份版本不受支持。');
    }
    if (!Array.isArray(backup.players) || backup.players.length > MAX_PROFILES) {
      throw new Error('备份中的玩家列表无效。');
    }

    const seenNames = new Set();
    const players = backup.players.map((player) => {
      const name = typeof player?.name === 'string' ? player.name.trim() : '';
      const normalizedName = normalizeName(name);
      const balanceUnits = balanceToUnits(player?.balance);
      if (!name || name.length > MAX_NAME_LENGTH || balanceUnits === null || balanceUnits < 0) {
        throw new Error('备份中存在无效的昵称或金币余额。');
      }
      if (seenNames.has(normalizedName)) throw new Error('备份中存在重复昵称。');
      seenNames.add(normalizedName);
      return { name, balanceUnits };
    });

    return {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: typeof backup.exportedAt === 'string' ? backup.exportedAt : null,
      players,
    };
  }

  function mergeScoreBackup(existingProfiles, importedPlayers, createId) {
    const mergedProfiles = existingProfiles.map((profile) => ({ ...profile }));
    let addedCount = 0;
    let updatedCount = 0;

    importedPlayers.forEach(({ name, balanceUnits }) => {
      const trimmedName = name.trim();
      const existing = mergedProfiles.find((profile) => normalizeName(profile.name) === normalizeName(trimmedName));
      if (existing) {
        existing.name = trimmedName;
        existing.balanceUnits = balanceUnits;
        updatedCount += 1;
      } else {
        mergedProfiles.push({ id: createId(), name: trimmedName, balanceUnits });
        addedCount += 1;
      }
    });

    return { profiles: mergedProfiles, addedCount, updatedCount };
  }

  const profileBackup = {
    BACKUP_FORMAT,
    BACKUP_VERSION,
    balanceToUnits,
    createScoreBackup,
    mergeScoreBackup,
    normalizeName,
    parseScoreBackup,
    unitsToBalance,
  };

  globalScope.CheckersProfileBackup = profileBackup;
  if (typeof module !== 'undefined' && module.exports) module.exports = profileBackup;
}(typeof window !== 'undefined' ? window : globalThis));
