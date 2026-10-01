(() => {
  'use strict';

  const {
    CAMP_ORDER,
    DIRECTIONS,
    OPPOSITE_CAMP,
    applyCoinEarnings,
    chooseSimpleComputerRoute,
    calculateJumpReward,
    calculateLegalMoves,
    calculateRankReward,
    calculateTargetReward,
    coordinateKey,
    createBoardKeys,
    createPlayerCampLayout,
    createPiecesForCamps,
    createRandomPieces,
    createStandardPieces,
    createTargetCampKeys,
    createTargetRewardMap,
    formatClockSeconds,
    formatCoinUnits,
    hasPlayerWon,
    isFreshTurnLanding,
    pointId,
    roundTurnSeconds,
    settleRankRewards,
    settleTurnReward,
  } = window.CheckersRules;
  const {
    balanceToUnits,
    createScoreBackup,
    mergeScoreBackup,
    parseScoreBackup,
    removeProfile,
    unitsToBalance,
  } = window.CheckersProfileBackup;
  const { normalizeState: normalizeVaultAccessState, recordAttempt: recordVaultAttempt, verifyPin: verifyVaultPin } = window.CheckersVaultAccess;

  const root = document.getElementById('checkers-app');
  const $ = (selector) => root.querySelector(selector);
  const svg = $('#board');
  const ui = {
    form: $('#player-form'),
    scoreVault: $('#score-vault'),
    openScoreVault: $('#open-score-vault'),
    closeScoreVault: $('#close-score-vault'),
    scoreVaultPlayers: $('#score-vault-players'),
    scoreVaultCount: $('#score-vault-count'),
    scoreVaultStatus: $('#score-vault-status'),
    vaultAccessDialog: document.getElementById('score-vault-access-dialog'),
    vaultAccessForm: document.getElementById('score-vault-access-form'),
    vaultPin: document.getElementById('score-vault-pin'),
    vaultAccessStatus: document.getElementById('score-vault-access-status'),
    vaultAccessSubmit: document.getElementById('submit-score-vault-access'),
    vaultAccessCancel: document.getElementById('cancel-score-vault-access'),
    addScoreProfile: $('#add-score-profile'),
    exportScoreBackup: $('#export-score-backup'),
    importScoreBackup: $('#import-score-backup'),
    scoreBackupFile: $('#score-backup-file'),
    game: $('#game-layout'),
    setupHelp: $('#setup-help'),
    start: $('#start-game'),
    now: $('#now'),
    nowDot: $('#now-dot'),
    turnClock: $('#turn-clock'),
    turnTime: $('#turn-time'),
    totalTime: $('#total-time'),
    status: $('#status'),
    list: $('#list'),
    rankingCard: $('#ranking-card'),
    ranking: $('#ranking'),
    exportRecord: $('#export-record'),
    debug: $('#debug-id'),
    detail: $('#debug-detail'),
    mode: $('#mode-help'),
    stage: root.querySelector('.stage'),
    coinBoard: $('#coin-board'),
    coinHelp: $('#coin-help'),
    undo: $('#undo'),
    end: $('#end'),
    endButtons: [...root.querySelectorAll('[data-end-turn]')],
    standard: $('#standard'),
    random: $('#random'),
    victory: $('#victory'),
    seEnabled: $('#se-enabled'),
    inactiveWhiteMix: $('#inactive-white-mix'),
    inactiveWhiteMixValue: $('#inactive-white-mix-value'),
    restart: $('#restart'),
    gameDetails: $('#game-details'),
    gameDetailsToggle: $('#game-details-toggle'),
    undoDialog: document.getElementById('undo-dialog'),
    confirmUndo: document.getElementById('confirm-undo'),
    cancelUndo: document.getElementById('cancel-undo'),
    resultsDialog: document.getElementById('results-dialog'),
    resultsList: document.getElementById('results-list'),
    fireworksCanvas: document.getElementById('fireworks-canvas'),
    closeResults: document.getElementById('close-results'),
    rematch: document.getElementById('rematch-results'),
    scoreProfileDialog: document.getElementById('score-profile-dialog'),
    scoreProfileForm: document.getElementById('score-profile-form'),
    scoreProfileDialogTitle: document.getElementById('score-profile-dialog-title'),
    scoreProfileName: document.getElementById('score-profile-name'),
    scoreProfileBalance: document.getElementById('score-profile-balance'),
    scoreProfileError: document.getElementById('score-profile-error'),
    cancelScoreProfile: document.getElementById('cancel-score-profile'),
    deleteScoreProfile: document.getElementById('delete-score-profile'),
    scoreDeleteConfirmDialog: document.getElementById('score-delete-confirm-dialog'),
    scoreDeleteConfirmMessage: document.getElementById('score-delete-confirm-message'),
    cancelScoreDeleteConfirm: document.getElementById('cancel-score-delete-confirm'),
    continueScoreDelete: document.getElementById('continue-score-delete'),
    scoreDeleteFinalDialog: document.getElementById('score-delete-final-dialog'),
    scoreDeleteFinalForm: document.getElementById('score-delete-final-form'),
    scoreDeleteConfirmText: document.getElementById('score-delete-confirm-text'),
    scoreDeleteFinalError: document.getElementById('score-delete-final-error'),
    cancelScoreDeleteFinal: document.getElementById('cancel-score-delete-final'),
    scoreImportDialog: document.getElementById('score-import-dialog'),
    scoreImportForm: document.getElementById('score-import-form'),
    scoreImportSummary: document.getElementById('score-import-summary'),
    scoreImportPreview: document.getElementById('score-import-preview'),
    cancelScoreImport: document.getElementById('cancel-score-import'),
    setupPlayerDialog: document.getElementById('setup-player-dialog'),
    setupPlayerDialogTitle: document.getElementById('setup-player-dialog-title'),
    setupPlayerDialogLead: document.getElementById('setup-player-dialog-lead'),
    setupProfileList: document.getElementById('setup-profile-list'),
    setupNewPlayerName: document.getElementById('setup-new-player-name'),
    setupUseNewPlayer: document.getElementById('setup-use-new-player'),
    setupClosePlayer: document.getElementById('setup-close-player'),
    setupColorDialog: document.getElementById('setup-color-dialog'),
    setupColorDialogLead: document.getElementById('setup-color-dialog-lead'),
    setupColorGrid: document.getElementById('setup-color-grid'),
    setupCloseColor: document.getElementById('setup-close-color'),
  };

  const ALL_CAMPS = CAMP_ORDER;
  const PROFILE_STORAGE_KEY = 'family-checkers-player-profiles-v1';
  const VAULT_ACCESS_STORAGE_KEY = 'family-checkers-vault-access-v1';
  const LAST_STARTING_COLORS_STORAGE_KEY = 'family-checkers-last-starting-colors-v1';
  const DEFAULT_STARTING_COLORS = ['rapunzelGold', 'arielRed'];
  const pieceMoveSound = new Audio('sounds/piece-land.wav');
  pieceMoveSound.preload = 'auto';
  const INITIAL_BALANCE_UNITS = 100;
  const UNDO_FEE_UNITS = 5;
  const COMPUTER_MAX_ROUTES = 120;
  const COMPUTER_MAX_JUMP_DEPTH = 12;
  const COMPUTER_THINK_DELAY = 650;
  const COMPUTER_STEP_DELAY = 140;
  const BOARD_WIDTH = 760;
  const BOARD_HEIGHT = 760;
  const COLOR_META = {
    arielRed: { colorName: '人鱼红发', value: '#b72b4a' },
    rapunzelGold: { colorName: '乐佩金黄', value: '#edc555' },
    plutoOrange: { colorName: '布鲁托橙', value: '#d46a00' },
    purple: { colorName: '紫色', value: '#8239ee' },
    peachPink: { colorName: '桃子公主粉', value: '#f399b1' },
    red: { colorName: '红色', value: '#e95122' },
    green: { colorName: '绿色', value: '#2bb7b4' },
    donaldBlue: { colorName: '唐老鸭蓝', value: '#2d7eb6' },
    goofyGreen: { colorName: '高飞绿', value: '#2f9235' },
    mickeyBlack: { colorName: '米奇黑', value: '#252733' },
    snowBlue: { colorName: '白雪深蓝', value: '#003da5' },
    cinderellaBlue: { colorName: '灰姑娘蓝', value: '#7894ad' },
  };
  let players = createPlayerCampLayout(3).map((camp, index) => ({
    ...COLOR_META[['rapunzelGold', 'arielRed', 'green'][index]],
    camp,
    kind: 'human',
    name: '',
    profileId: null,
    balanceUnits: INITIAL_BALANCE_UNITS,
  }));
  const boardKeys = createBoardKeys();
  const cells = [];
  const groups = new Map();
  const targetCamps = Object.fromEntries(
    ALL_CAMPS.map((camp) => [camp, createTargetCampKeys(camp)]),
  );
  const targetRewards = Object.fromEntries(
    ALL_CAMPS.map((camp) => [camp, createTargetRewardMap(camp)]),
  );

  let pieces = new Map();
  let selected = null;
  let turn = 0;
  let lockedPieceId = null;
  let committed = false;
  let animating = false;
  let history = [];
  let finished = [];
  let gameOver = false;
  let winEnabled = true;
  let startingPieces = new Map();
  let startingText = '';
  let startingCanWin = true;
  let startingTurnCamp = 'red';
  let startingCoinsEnabled = true;
  let restartArmed = false;
  let restartTimer = null;
  let profiles = loadProfiles();
  let matchCoinUnits = new Map();
  let matchRankRewardUnits = new Map();
  let turnRewardUnits = 0;
  let jumpCount = 0;
  let undoFeeApplied = false;
  let turnPieceId = null;
  let turnVisitedKeys = new Set();
  let lastLandingFresh = false;
  let claimedTargetKeys = new Set();
  let coinsEnabled = true;
  let matchSettled = false;
  let matchStartedAt = null;
  let matchEndedAt = null;
  let computerRunning = false;
  let computerTurnToken = 0;
  let matchTimeSeconds = new Map();
  let turnTimeHistory = [];
  let turnStartedAt = null;
  let turnClockTimer = null;
  let fireworks = null;
  let fireworksTimer = null;
  let celebrationRunId = 0;
  let pieceMoveSoundUnlocked = false;

  function unlockPieceMoveSound() {
    if (pieceMoveSoundUnlocked) return;
    pieceMoveSound.muted = true;
    pieceMoveSound.play().then(() => {
      pieceMoveSound.pause();
      pieceMoveSound.currentTime = 0;
      pieceMoveSound.muted = false;
      pieceMoveSoundUnlocked = true;
      document.removeEventListener('pointerdown', unlockPieceMoveSound, true);
      document.removeEventListener('keydown', unlockPieceMoveSound, true);
    }).catch(() => {
      pieceMoveSound.muted = false;
    });
  }

  function playPieceMoveSound() {
    if (!ui.seEnabled.checked) return;
    try {
      pieceMoveSound.pause();
      pieceMoveSound.currentTime = 0;
      pieceMoveSound.play().catch(() => {});
    } catch {
      // 音效播放失败不影响走棋。
    }
  }

  document.addEventListener('pointerdown', unlockPieceMoveSound, true);
  document.addEventListener('keydown', unlockPieceMoveSound, true);
  let resultsOpenTimer = null;
  let activeSetupPlayerEntry = null;
  let activeSetupColorEntry = null;
  let editingProfileId = null;
  let pendingDeleteProfileId = null;
  let pendingImportedPlayers = [];

  const now = () => players[turn];
  const playerLabel = (player) => `${player.name ? `${player.name} · ` : ''}${player.colorName}`;
  const playerName = (player) => player.name || '玩家';
  const boardPosition = (q, r) => ({ x: 380 + (q + r / 2) * 52, y: 380 + r * 45 });
  const signedCoinText = (units) => (units === 0 ? '+0.0' : formatCoinUnits(units, true));

  function applyPlayerColor(element, player) {
    element.style.backgroundColor = player.value;
  }

  function playerForCamp(camp) {
    return players.find((player) => player.camp === camp);
  }

  function normalizeProfileName(name) {
    return name.trim().toLocaleLowerCase('zh-CN');
  }

  function loadProfiles() {
    try {
      const saved = JSON.parse(window.localStorage.getItem(PROFILE_STORAGE_KEY) || '[]');
      if (!Array.isArray(saved)) return [];
      return saved.filter((profile) => (
        profile
        && typeof profile.id === 'string'
        && typeof profile.name === 'string'
        && Number.isInteger(profile.balanceUnits)
      ));
    } catch {
      return [];
    }
  }

  function saveProfiles() {
    try {
      window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profiles));
      return true;
    } catch {
      ui.coinHelp.textContent = '浏览器未允许保存长期金币，本次余额只在当前页面有效。';
      return false;
    }
  }

  function createProfileId() {
    const randomPart = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `player-${randomPart}`;
  }

  function resolveProfile(name, preferredId = null) {
    const normalizedName = normalizeProfileName(name);
    let profile = preferredId
      ? profiles.find((candidate) => candidate.id === preferredId && normalizeProfileName(candidate.name) === normalizedName)
      : null;
    if (!profile) {
      profile = profiles.find((candidate) => normalizeProfileName(candidate.name) === normalizedName);
    }
    if (!profile) {
      profile = {
        id: createProfileId(),
        name: name.trim(),
        balanceUnits: INITIAL_BALANCE_UNITS,
      };
      profiles.push(profile);
      saveProfiles();
    }
    return profile;
  }

  function resetTurnLedger() {
    turnRewardUnits = 0;
    jumpCount = 0;
    undoFeeApplied = false;
    turnPieceId = null;
    turnVisitedKeys = new Set();
    lastLandingFresh = false;
  }

  function resetCoinMatch(enableCoins) {
    coinsEnabled = enableCoins;
    matchCoinUnits = new Map(players.filter((player) => player.profileId).map((player) => [player.profileId, 0]));
    matchRankRewardUnits = new Map(players.filter((player) => player.profileId).map((player) => [player.profileId, 0]));
    claimedTargetKeys = new Set();
    matchSettled = false;
    resetTurnLedger();
  }

  function clearTurnClock() {
    window.clearInterval(turnClockTimer);
    turnClockTimer = null;
    turnStartedAt = null;
  }

  function liveTurnSeconds() {
    if (turnStartedAt === null || now().kind === 'computer') return 0;
    return Math.max(0, Math.floor((performance.now() - turnStartedAt) / 1000));
  }

  function updateClockUi() {
    const current = now();
    const isHumanTurn = !gameOver && current.kind !== 'computer';
    const liveSeconds = isHumanTurn ? liveTurnSeconds() : 0;
    const settledSeconds = matchTimeSeconds.get(current.camp) || 0;
    const clockStatus = gameOver ? '本局计时已结束' : '电脑回合 · 不计时';
    ui.turnClock.dataset.mode = isHumanTurn ? 'human' : 'status';
    ui.turnClock.dataset.label = isHumanTurn ? '' : clockStatus;
    ui.turnClock.setAttribute('aria-label', isHumanTurn ? '当前玩家用时' : clockStatus);
    ui.turnTime.textContent = formatClockSeconds(liveSeconds);
    ui.totalTime.textContent = formatClockSeconds(settledSeconds + liveSeconds);

    root.querySelectorAll('.player-time').forEach((element) => {
      const player = playerForCamp(element.dataset.camp);
      if (!player || player.kind === 'computer') {
        element.textContent = '电脑不计时';
        return;
      }
      const playerLiveSeconds = isHumanTurn && player === current ? liveSeconds : 0;
      element.textContent = formatClockSeconds((matchTimeSeconds.get(player.camp) || 0) + playerLiveSeconds);
    });
  }

  function startTurnClock() {
    clearTurnClock();
    if (matchStartedAt === null || gameOver || now().kind === 'computer') {
      updateClockUi();
      return;
    }
    turnStartedAt = performance.now();
    updateClockUi();
    turnClockTimer = window.setInterval(updateClockUi, 250);
  }

  function settleTurnClock(player) {
    if (player.kind === 'computer' || turnStartedAt === null) {
      clearTurnClock();
      return 0;
    }
    const seconds = roundTurnSeconds(performance.now() - turnStartedAt);
    matchTimeSeconds.set(player.camp, (matchTimeSeconds.get(player.camp) || 0) + seconds);
    const playerTurn = turnTimeHistory.filter(({ camp }) => camp === player.camp).length + 1;
    turnTimeHistory.push({ camp: player.camp, playerTurn, seconds });
    clearTurnClock();
    return seconds;
  }

  function resetMatchClock() {
    clearTurnClock();
    matchTimeSeconds = new Map(players.map(({ camp }) => [camp, 0]));
    turnTimeHistory = [];
  }

  function updateCoinsUi() {
    ui.coinBoard.replaceChildren();
    players.forEach((player) => {
      if (!player.profileId) return;
      const row = document.createElement('div');
      row.className = `coin-player${player.camp === now().camp && !gameOver ? ' is-current' : ''}`;

      const dot = document.createElement('span');
      dot.className = 'dot';
      applyPlayerColor(dot, player);
      const name = document.createElement('span');
      name.className = 'coin-player-name';
      name.textContent = player.name;
      const balance = document.createElement('span');
      balance.className = 'coin-balance';
      const balanceIcon = document.createElement('i');
      balanceIcon.className = 'coin-icon';
      balanceIcon.textContent = '★';
      balance.append(balanceIcon, document.createTextNode(formatCoinUnits(player.balanceUnits)));
      const detail = document.createElement('span');
      detail.className = 'coin-detail';
      const matchUnits = matchCoinUnits.get(player.profileId) || 0;
      const coinDetailText = `本局 ${signedCoinText(matchUnits)}`;

      const time = document.createElement('span');
      time.className = 'player-time';
      time.dataset.camp = player.camp;
      detail.append(document.createTextNode(`${coinDetailText} · `), time);

      row.append(dot, name, balance, detail);
      ui.coinBoard.appendChild(row);
    });
    ui.coinHelp.textContent = coinsEnabled
      ? matchSettled
        ? '本局金币与名次奖励已存入长期余额。'
        : '结束回合结算本回合；完成整局后存入长期余额。'
      : '测试场景不计金币。';
    updateClockUi();
  }

  function showCoinFloat(group, units) {
    if (!group || units === 0) return;
    const pop = document.createElement('div');
    pop.className = `coin-pop${units < 0 ? ' is-cost' : ''}`;
    pop.style.left = `${(Number(group.dataset.x) / BOARD_WIDTH) * 100}%`;
    pop.style.top = `${(Number(group.dataset.y) / BOARD_HEIGHT) * 100}%`;

    const icon = document.createElement('i');
    icon.className = 'coin-icon';
    icon.textContent = '★';
    const amount = document.createElement('span');
    amount.textContent = formatCoinUnits(units, true);
    pop.append(icon, amount);
    ui.stage.appendChild(pop);
    window.setTimeout(() => pop.remove(), 950);
  }

  function settleMatchCoins() {
    if (!coinsEnabled || matchSettled) return;
    const settlement = settleRankRewards({
      rankedPlayerIds: finished.map((camp) => playerForCamp(camp)?.profileId),
      earnedUnitsByPlayer: matchCoinUnits,
    });
    matchCoinUnits = settlement.totalUnitsByPlayer;
    matchRankRewardUnits = settlement.rankRewardUnitsByPlayer;
    players.forEach((player) => {
      const earnedUnits = matchCoinUnits.get(player.profileId) || 0;
      player.balanceUnits = applyCoinEarnings({ balanceUnits: player.balanceUnits, earnedUnits });
      const profile = profiles.find((candidate) => candidate.id === player.profileId);
      if (profile) profile.balanceUnits = player.balanceUnits;
    });
    matchSettled = true;
    saveProfiles();
  }

  function addCell(q, r, cellClass = '') {
    if (!cells.some((cell) => cell.q === q && cell.r === r)) {
      cells.push({ q, r, cellClass });
    }
  }

  for (let q = -4; q <= 4; q += 1) {
    for (let r = -4; r <= 4; r += 1) {
      if (Math.abs(q + r) <= 4) addCell(q, r);
    }
  }
  for (let t = 1; t <= 4; t += 1) {
    for (let i = t; i <= 4; i += 1) {
      addCell(i, -4 - t, 'arm-red');
      addCell(4 + t, -i, 'arm-upper-right');
      addCell(i, 4 + t - i, 'arm-green');
      addCell(-i, 4 + t, 'arm-bottom');
      addCell(-4 - t, i, 'arm-purple');
      addCell(-4 - t + i, -i, 'arm-upper-left');
    }
  }

  function createVictoryTestPieces() {
    const next = new Map();

    players.forEach(({ camp }) => {
      const targetKeys = targetCamps[camp];
      let approach = null;
      for (const targetKey of targetKeys) {
        const [targetQ, targetR] = targetKey.split(',').map(Number);
        const source = DIRECTIONS
          .map(([dq, dr]) => coordinateKey(targetQ + dq, targetR + dr))
          .find((candidate) => boardKeys.has(candidate) && !targetKeys.has(candidate) && !next.has(candidate));
        if (source) {
          approach = { target: targetKey, source };
          break;
        }
      }
      if (!approach) throw new Error(`Unable to create victory test for ${camp}`);
      let number = 1;
      for (const targetKey of targetKeys) {
        if (targetKey === approach.target) continue;
        next.set(targetKey, {
          color: camp,
          id: `${camp}-${String(number).padStart(2, '0')}`,
        });
        number += 1;
      }
      next.set(approach.source, { color: camp, id: `${camp}-10` });
    });
    return next;
  }

  function createStartingPieces() {
    return createPiecesForCamps(players.map(({ camp }) => camp));
  }

  function standardDescription() {
    if (players.length === 2) return '双人局：两位玩家位于对向营地。';
    return `${players.length} 人局：每方 10 枚棋子，按棋盘逆时针方向轮换。`;
  }

  function hasWon(color) {
    return winEnabled && hasPlayerWon({ pieces, color });
  }

  function updateRanking() {
    ui.rankingCard.hidden = finished.length === 0;
    ui.ranking.textContent = finished.length
      ? finished.map((camp, index) => {
        const player = playerForCamp(camp);
        return `${index + 1}. ${playerLabel(player)}`;
      }).join('　')
      : '尚未产生名次';
  }

  function nextActiveTurn() {
    for (let count = 0; count < players.length; count += 1) {
      turn = (turn + 1) % players.length;
      if (!finished.includes(now().camp)) return;
    }
  }

  function clearSelection() {
    root.querySelectorAll('.spot').forEach((spot) => {
      spot.classList.remove('is-selected', 'is-legal', 'is-pivot');
    });
    root.querySelectorAll('.cell').forEach((cell) => {
      cell.style.removeProperty('stroke');
      cell.style.removeProperty('stroke-width');
    });
    selected = null;
  }

  function updateTurnUi() {
    const current = now();

    ui.now.textContent = gameOver ? '本局结束' : `${playerName(current)}的回合`;
    ui.nowDot.className = 'dot';
    applyPlayerColor(ui.nowDot, current);

    root.dataset.activeCamp = current.camp;
    root.dataset.computerThinking = String(computerRunning);
    root.style.setProperty('--move', current.value);
    const endTurnDisabled = gameOver || !committed || animating || computerRunning;
    ui.endButtons.forEach((button) => { button.disabled = endTurnDisabled; });
    ui.undo.disabled = gameOver || history.length === 0 || animating || computerRunning;
    ui.restart.disabled = animating || computerRunning;
    ui.exportRecord.hidden = !gameOver;
    updateRanking();
    updateCoinsUi();
  }

  function describeMoves(legalMoves) {
    return [...legalMoves].map(([destination, move]) => {
      const [q, r] = destination.split(',').map(Number);
      const kind = move.type === 'step'
        ? '相邻'
        : move.distance === 1
          ? `普通跳，跨过 ${move.pivotId}`
          : `隔空跳 ${move.distance} 格，跨过 ${move.pivotId}`;
      return `${pointId(q, r)}（${kind}）`;
    });
  }

  function showLegalMoves(group, q, r, piece, jumpsOnly = false) {
    clearSelection();
    group.classList.add('is-selected');
    const chosenCell = group.querySelector('.cell');
    chosenCell.style.stroke = 'var(--focus)';
    chosenCell.style.strokeWidth = '4';

    let legalMoves = calculateLegalMoves({ boardKeys, pieces, q, r });
    if (jumpsOnly) {
      legalMoves = new Map([...legalMoves].filter(([, move]) => move.type === 'jump'));
    }
    selected = { fromKey: coordinateKey(q, r), piece, group, legalMoves };

    for (const destination of legalMoves.keys()) {
      const target = groups.get(destination);
      target.classList.add('is-legal');
      const cell = target.querySelector('.cell');
      cell.style.stroke = 'var(--move)';
      cell.style.strokeWidth = '2';
    }

    const descriptions = describeMoves(legalMoves);
    ui.status.textContent = `${piece.id}：${jumpsOnly ? '可继续跳 ' : ''}${legalMoves.size} 处`;
    ui.list.textContent = descriptions.length ? descriptions.join('、') : '当前没有合法落点。';
    updateTurnUi();
  }

  function findPiecePosition(pieceId) {
    return [...pieces].find(([, piece]) => piece.id === pieceId)?.[0];
  }

  function renderPieces() {
    clearSelection();
    root.querySelectorAll('.piece').forEach((piece) => piece.remove());

    for (const [spotKey, group] of groups) {
      group.classList.remove('has-piece');
      const piece = pieces.get(spotKey);
      if (!piece) continue;

      group.classList.add('has-piece');
      const token = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      const owner = playerForCamp(piece.color);
      token.setAttribute('class', `piece${piece.color === now().camp ? ' is-active' : ''}`);
      token.style.setProperty('--piece-color', owner?.value || COLOR_META[piece.color]?.value || '#687083');
      token.dataset.ownerCamp = piece.color;
      token.setAttribute('cx', group.dataset.x);
      token.setAttribute('cy', group.dataset.y);
      token.setAttribute('r', '12');
      token.dataset.pieceId = piece.id;
      group.appendChild(token);
    }
    updateTurnUi();
  }

  function landingPulse(group) {
    const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    ring.setAttribute('class', 'pulse');
    ring.setAttribute('cx', group.dataset.x);
    ring.setAttribute('cy', group.dataset.y);
    ring.setAttribute('r', '13');
    group.appendChild(ring);

    const start = performance.now();
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 420;
    function draw(time) {
      const progress = Math.min(1, (time - start) / duration);
      ring.setAttribute('r', String(13 + progress * 18));
      ring.setAttribute('opacity', String(0.9 * (1 - progress)));
      if (progress < 1) requestAnimationFrame(draw);
      else ring.remove();
    }
    requestAnimationFrame(draw);
  }

  async function moveSelectedPiece(destination, moveRule) {
    if (!selected || animating) return;

    const selection = selected;
    const target = groups.get(destination);
    const token = selection.group.querySelector('.piece');
    if (!target || !token) return;

    animating = true;
    updateTurnUi();
    root.querySelectorAll('.is-legal').forEach((spot) => {
      spot.classList.remove('is-legal');
      const cell = spot.querySelector('.cell');
      cell.style.removeProperty('stroke');
      cell.style.removeProperty('stroke-width');
    });

    const dx = Number(target.dataset.x) - Number(selection.group.dataset.x);
    const dy = Number(target.dataset.y) - Number(selection.group.dataset.y);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = reducedMotion
      ? 1
      : moveRule.type === 'step'
        ? 160
        : Math.min(600, 340 + moveRule.distance * 40);
    const lift = reducedMotion ? 0 : Math.min(72, 28 + moveRule.distance * 11);
    let pivot = null;
    let pivotTimer = null;

    if (moveRule.type === 'jump') {
      const pivotPosition = findPiecePosition(moveRule.pivotId);
      pivot = pivotPosition ? groups.get(pivotPosition) : null;
      pivotTimer = window.setTimeout(() => pivot?.classList.add('is-pivot'), duration * 0.38);
      ui.status.textContent = `${selection.piece.id} 正在跳跃…`;
    } else {
      ui.status.textContent = `${selection.piece.id} 正在移动…`;
    }

    const keyframes = moveRule.type === 'step'
      ? [{ transform: 'translate(0, 0)' }, { transform: `translate(${dx}px, ${dy}px)` }]
      : [
        { transform: 'translate(0, 0) scale(.96)' },
        { transform: `translate(${dx / 2}px, ${dy / 2 - lift}px) scale(1.08)`, offset: 0.5 },
        { transform: `translate(${dx}px, ${dy}px) scale(1)` },
      ];

    playPieceMoveSound();
    await new Promise((resolve) => window.setTimeout(resolve, 200));
    await token.animate(keyframes, {
      duration,
      easing: moveRule.type === 'step' ? 'ease-out' : 'cubic-bezier(.22,.72,.25,1)',
      fill: 'forwards',
    }).finished.catch(() => {});

    window.clearTimeout(pivotTimer);
    pivot?.classList.remove('is-pivot');
    if (history.length === 0) {
      history.push({
        pieces: new Map(pieces),
        lockedPieceId,
        committed,
        jumpCount,
        turnRewardUnits,
        turnPieceId,
        turnVisitedKeys: new Set(turnVisitedKeys),
        lastLandingFresh,
      });
    }
    turnVisitedKeys.add(selection.fromKey);
    lastLandingFresh = isFreshTurnLanding({ visitedKeys: turnVisitedKeys, position: destination });
    turnVisitedKeys.add(destination);
    pieces.delete(selection.fromKey);
    pieces.set(destination, selection.piece);
    turnPieceId = selection.piece.id;
    animating = false;
    committed = true;
    renderPieces();
    landingPulse(target);
    if (matchStartedAt === null) {
      matchStartedAt = new Date();
      startTurnClock();
    }

    const [q, r] = destination.split(',').map(Number);
    if (moveRule.type === 'jump') {
      jumpCount += 1;
      if (coinsEnabled && lastLandingFresh) {
        const reward = calculateJumpReward({ jumpNumber: jumpCount, distance: moveRule.distance });
        turnRewardUnits += reward.totalUnits;
        showCoinFloat(target, reward.totalUnits);
      }
      lockedPieceId = selection.piece.id;
      showLegalMoves(target, q, r, selection.piece, true);
      if (coinsEnabled && !lastLandingFresh) {
        ui.status.textContent = `${selection.piece.id} 已落到本回合走过的格子`;
        ui.list.textContent = selected.legalMoves.size
          ? '本次落地不计金币；仍可继续跳，或结束回合。'
          : '本次落地不计金币；没有可继续跳跃的落点，请结束回合。';
      } else if (selected.legalMoves.size === 0) {
        ui.status.textContent = `${selection.piece.id} 跳跃完成`;
        ui.list.textContent = '没有可继续跳跃的落点，请结束回合。';
      }
    } else {
      lockedPieceId = null;
      ui.status.textContent = `${selection.piece.id} 移动完成`;
      ui.list.textContent = '可以悔棋，或点击“结束回合”。';
      updateTurnUi();
    }
  }

  function undo() {
    if (history.length === 0 || animating || computerRunning || now().kind === 'computer') return;
    const chargeUndoFee = coinsEnabled && !undoFeeApplied;
    const undonePieceId = turnPieceId;
    if (chargeUndoFee) undoFeeApplied = true;
    const previous = history[0];
    history = [];
    pieces = new Map(previous.pieces);
    lockedPieceId = previous.lockedPieceId;
    committed = previous.committed;
    jumpCount = previous.jumpCount;
    turnRewardUnits = previous.turnRewardUnits;
    turnPieceId = previous.turnPieceId;
    turnVisitedKeys = new Set(previous.turnVisitedKeys);
    lastLandingFresh = previous.lastLandingFresh;
    renderPieces();

    if (chargeUndoFee) {
      const restoredPosition = findPiecePosition(undonePieceId);
      showCoinFloat(groups.get(restoredPosition), -UNDO_FEE_UNITS);
    }

    ui.status.textContent = `已恢复到本回合开始${chargeUndoFee ? '，本回合悔棋费 -0.5' : ''}`;
    ui.list.textContent = '本回合走法已全部撤销，请重新选择棋子。';
    updateTurnUi();
  }

  function closeUndoDialog() {
    if (typeof ui.undoDialog.close === 'function' && ui.undoDialog.open) ui.undoDialog.close();
    else ui.undoDialog.removeAttribute('open');
  }

  function openUndoDialog() {
    if (ui.undo.disabled) return;
    if (typeof ui.undoDialog.showModal === 'function') ui.undoDialog.showModal();
    else ui.undoDialog.setAttribute('open', '');
    ui.cancelUndo.focus();
  }

  function handleSpotClick(spotKey, group, q, r) {
    if (animating || gameOver || computerRunning || now().kind === 'computer') return;
    const piece = pieces.get(spotKey);

    if (piece) {
      if (committed && !lockedPieceId) {
        ui.status.textContent = '本回合已落子';
        ui.list.textContent = '可以悔棋，或点击“结束回合”。';
      } else if (piece.color !== now().camp) {
        ui.status.textContent = `现在是${playerLabel(now())}回合`;
        ui.list.textContent = `${piece.id} 不是当前玩家的棋子。`;
      } else if (lockedPieceId && piece.id !== lockedPieceId) {
        ui.status.textContent = `${lockedPieceId} 正在连续跳跃`;
        ui.list.textContent = '本回合不能改选其他棋子。';
      } else {
        showLegalMoves(group, q, r, piece, Boolean(lockedPieceId));
      }
    } else if (selected?.legalMoves.has(spotKey)) {
      moveSelectedPiece(spotKey, selected.legalMoves.get(spotKey));
    }
  }

  const connectionLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  connectionLayer.setAttribute('class', 'board-connections');
  const connectionDirections = [[1, 0], [0, 1], [1, -1]];
  for (const spotKey of boardKeys) {
    const [q, r] = spotKey.split(',').map(Number);
    const from = boardPosition(q, r);
    for (const [dq, dr] of connectionDirections) {
      if (!boardKeys.has(coordinateKey(q + dq, r + dr))) continue;
      const to = boardPosition(q + dq, r + dr);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('class', 'board-connection');
      line.setAttribute('x1', String(from.x));
      line.setAttribute('y1', String(from.y));
      line.setAttribute('x2', String(to.x));
      line.setAttribute('y2', String(to.y));
      connectionLayer.appendChild(line);
    }
  }
  svg.appendChild(connectionLayer);

  for (const { q, r, cellClass } of cells) {
    const spotKey = coordinateKey(q, r);
    const position = boardPosition(q, r);
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const touchTarget = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    const cell = document.createElementNS('http://www.w3.org/2000/svg', 'circle');

    group.setAttribute('class', 'spot');
    group.dataset.x = String(position.x);
    group.dataset.y = String(position.y);
    group.dataset.pointId = pointId(q, r);
    group.dataset.key = spotKey;
    touchTarget.setAttribute('class', 'touch-target');
    touchTarget.setAttribute('cx', String(position.x));
    touchTarget.setAttribute('cy', String(position.y));
    touchTarget.setAttribute('r', '24.5');
    cell.setAttribute('class', `cell${cellClass ? ` ${cellClass}` : ''}`);
    cell.setAttribute('cx', String(position.x));
    cell.setAttribute('cy', String(position.y));
    cell.setAttribute('r', '15');
    group.append(touchTarget, cell);

    const updateDebugInfo = () => {
      const piece = pieces.get(spotKey);
      ui.debug.textContent = piece ? piece.id : pointId(q, r);
      ui.detail.textContent = piece
        ? `棋子 ${piece.id} 位于落点 ${pointId(q, r)}`
        : `空落点 ${pointId(q, r)}`;
    };
    group.addEventListener('pointerenter', updateDebugInfo);
    group.addEventListener('pointerdown', updateDebugInfo);
    group.addEventListener('pointerleave', () => {
      ui.debug.textContent = '触摸或移动到棋盘上查看';
      ui.detail.textContent = '棋盘落点和棋子都有独立 ID。';
    });
    group.addEventListener('click', () => handleSpotClick(spotKey, group, q, r));

    groups.set(spotKey, group);
    svg.appendChild(group);
  }

  function chooseMode(activeButton) {
    [ui.standard, ui.random, ui.victory].forEach((button) => {
      button.setAttribute('aria-pressed', String(button === activeButton));
    });
  }

  function setGameDetailsOpen(open) {
    ui.gameDetails.dataset.open = String(open);
    ui.gameDetailsToggle.setAttribute('aria-expanded', String(open));
  }

  function applyBoardPalette() {
    root.dataset.playerCount = String(players.length);
    ui.standard.textContent = `标准开局 · ${players.length * 10} 枚`;
    ALL_CAMPS.forEach((arm) => {
      const cssArm = arm.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
      const occupant = playerForCamp(arm);
      const targeter = playerForCamp(OPPOSITE_CAMP[arm]);
      const color = occupant?.value || targeter?.value;
      const tint = occupant ? 14 : targeter ? 7 : 0;
      const fill = color
        ? `color-mix(in srgb, ${color} ${tint}%, #fffefa)`
        : 'var(--surface-muted)';
      root.style.setProperty(`--arm-${cssArm}-fill`, fill);
    });
  }

  function stopFireworks() {
    celebrationRunId += 1;
    window.clearTimeout(fireworksTimer);
    fireworksTimer = null;
    fireworks?.reset?.();
  }

  function disarmRestart() {
    restartArmed = false;
    window.clearTimeout(restartTimer);
    restartTimer = null;
    ui.restart.textContent = '重新开始';
    ui.rematch.textContent = '再来一局';
  }

  function performRestart() {
    const nextPieces = new Map(startingPieces);
    const description = startingText;
    const canWin = startingCanWin;
    const startCamp = startingTurnCamp;
    const enableCoins = startingCoinsEnabled;
    if (ui.resultsDialog.open) ui.resultsDialog.close();
    stopFireworks();
    disarmRestart();
    resetGame(nextPieces, description, canWin, false, startCamp, enableCoins);
  }

  function requestRestart() {
    if (animating || computerRunning) return;
    if (!restartArmed) {
      restartArmed = true;
      ui.restart.textContent = '确认重新开始';
      ui.rematch.textContent = '确认再来一局';
      restartTimer = window.setTimeout(disarmRestart, 3000);
      return;
    }
    performRestart();
  }

  function resetGame(
    nextPieces,
    description,
    canWin,
    rememberStart = true,
    startCamp = players[0].camp,
    enableCoins = true,
  ) {
    if (animating) return;
    computerTurnToken += 1;
    computerRunning = false;
    window.clearTimeout(resultsOpenTimer);
    resultsOpenTimer = null;
    if (ui.resultsDialog.open) ui.resultsDialog.close();
    stopFireworks();
    if (rememberStart) {
      startingPieces = new Map(nextPieces);
      startingText = description;
      startingCanWin = canWin;
      startingTurnCamp = startCamp;
      startingCoinsEnabled = enableCoins;
    }

    disarmRestart();
    turn = Math.max(0, players.findIndex((player) => player.camp === startCamp));
    lockedPieceId = null;
    committed = false;
    history = [];
    finished = [];
    gameOver = false;
    winEnabled = canWin;
    matchStartedAt = null;
    matchEndedAt = null;
    resetCoinMatch(enableCoins);
    resetMatchClock();
    pieces = new Map(nextPieces);
    ui.mode.textContent = description;
    renderPieces();
    ui.status.textContent = `请${playerLabel(now())}选择棋子`;
    ui.list.textContent = '细描边表示可以到达。';
    updateClockUi();
    scheduleComputerTurn();
  }

  const playerEntries = [1, 2, 3, 4, 5, 6].map((number) => ({
    number,
    fieldset: $(`#player-${number}-name`).closest('.player-entry'),
    nameInput: $(`#player-${number}-name`),
    nameButton: $(`#player-${number}-name-trigger`),
    nameSummary: $(`#player-${number}-name-summary`),
    kindInput: $(`#player-${number}-kind`),
    kindButtons: [...$(`#player-${number}-kind`).parentElement.querySelectorAll('[data-kind]')],
    colorInput: $(`#player-${number}-color`),
    colorButton: $(`#player-${number}-color-trigger`),
    colorSummary: $(`#player-${number}-color-summary`),
  }));

  function createCoinIcon() {
    const icon = document.createElement('i');
    icon.className = 'coin-icon';
    icon.textContent = '★';
    return icon;
  }

  function refreshProfileViews() {
    playerEntries.forEach((entry) => {
      const selectedProfile = profiles.find(({ id }) => id === entry.nameInput.dataset.profileId);
      if (selectedProfile) entry.nameInput.value = selectedProfile.name;

      const humanProfile = profiles.find(({ id }) => id === entry.nameInput.dataset.humanProfileId);
      if (humanProfile) entry.nameInput.dataset.humanName = humanProfile.name;

      const inactiveProfile = profiles.find(({ id }) => id === entry.nameInput.dataset.inactiveProfileId);
      if (inactiveProfile) entry.nameInput.dataset.inactiveName = inactiveProfile.name;
    });
    buildProfileCards();
    renderScoreVault();
    validateNames();
  }

  function renderScoreVault() {
    ui.scoreVaultPlayers.replaceChildren();
    ui.scoreVaultCount.textContent = `${profiles.length} 位玩家`;
    ui.exportScoreBackup.disabled = profiles.length === 0;

    if (profiles.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'score-vault-empty';
      empty.textContent = '还没有玩家档案，可以先录入昵称和余额。';
      ui.scoreVaultPlayers.appendChild(empty);
      return;
    }

    profiles.forEach((profile) => {
      const row = document.createElement('div');
      row.className = 'score-vault-player';

      const name = document.createElement('span');
      name.className = 'score-vault-player-name';
      name.textContent = profile.name;

      const balance = document.createElement('span');
      balance.className = 'score-vault-balance';
      balance.append(createCoinIcon(), document.createTextNode(formatCoinUnits(profile.balanceUnits)));

      const edit = document.createElement('button');
      edit.className = 'score-vault-edit';
      edit.type = 'button';
      edit.textContent = '修改';
      edit.setAttribute('aria-label', `修改${profile.name}的积分`);
      edit.addEventListener('click', () => openScoreProfileDialog(profile.id));

      row.append(name, balance, edit);
      ui.scoreVaultPlayers.appendChild(row);
    });
  }

  function openScoreVault() {
    renderScoreVault();
    ui.scoreVaultStatus.textContent = '';
    ui.form.hidden = true;
    ui.scoreVault.hidden = false;
    ui.closeScoreVault.focus();
  }

  function loadStartingColors() {
    try {
      const saved = JSON.parse(window.localStorage.getItem(LAST_STARTING_COLORS_STORAGE_KEY) || 'null');
      if (
        Array.isArray(saved)
        && saved.length === 2
        && saved.every((color) => COLOR_META[color])
        && saved[0] !== saved[1]
      ) return saved;
    } catch {
      // 读取失败时使用首次默认颜色。
    }
    return DEFAULT_STARTING_COLORS;
  }

  function saveStartingColors() {
    const selected = playerEntries.slice(0, 2).map(({ colorInput }) => colorInput.value);
    if (selected.some((color) => !COLOR_META[color]) || selected[0] === selected[1]) return;
    try {
      window.localStorage.setItem(LAST_STARTING_COLORS_STORAGE_KEY, JSON.stringify(selected));
    } catch {
      // 颜色记忆失败不影响本局设置。
    }
  }

  let vaultAccessTimer = null;
  let vaultAccessRequestId = 0;

  function readVaultAccessState() {
    try {
      return { available: true, state: JSON.parse(window.localStorage.getItem(VAULT_ACCESS_STORAGE_KEY) || 'null') };
    } catch {
      return { available: false, state: null };
    }
  }

  function saveVaultAccessState(state) {
    try {
      window.localStorage.setItem(VAULT_ACCESS_STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch {
      return false;
    }
  }

  function refreshVaultAccess() {
    const saved = readVaultAccessState();
    const access = normalizeVaultAccessState(saved.state, Date.now());
    const { lockedUntil } = access;
    const locked = lockedUntil > 0;
    ui.vaultPin.disabled = !saved.available || locked;
    ui.vaultAccessSubmit.disabled = !saved.available || locked;
    ui.vaultAccessStatus.textContent = !saved.available
      ? '浏览器未允许保存安全状态，暂时无法打开保险箱。'
      : locked
        ? `连续输错 3 次，保险箱已锁定。约 ${Math.ceil((lockedUntil - Date.now()) / 60000)} 分钟后可重试。`
        : access.failures.length
          ? `密码错误。5 分钟内还可尝试 ${3 - access.failures.length} 次。`
          : '';
    return saved.available && !locked;
  }

  function closeVaultAccessDialog() {
    vaultAccessRequestId += 1;
    if (vaultAccessTimer !== null) window.clearInterval(vaultAccessTimer);
    vaultAccessTimer = null;
    if (ui.vaultAccessDialog.open) ui.vaultAccessDialog.close();
    else ui.vaultAccessDialog.removeAttribute('open');
    ui.vaultPin.value = '';
    ui.openScoreVault.focus();
  }

  function requestScoreVaultAccess() {
    ui.vaultPin.value = '';
    if (typeof ui.vaultAccessDialog.showModal === 'function') ui.vaultAccessDialog.showModal();
    else ui.vaultAccessDialog.setAttribute('open', '');
    if (refreshVaultAccess()) ui.vaultPin.focus();
    else ui.vaultAccessCancel.focus();
    vaultAccessTimer = window.setInterval(refreshVaultAccess, 1000);
  }

  async function submitScoreVaultAccess() {
    const saved = readVaultAccessState();
    const now = Date.now();
    if (!saved.available || normalizeVaultAccessState(saved.state, now).lockedUntil) {
      refreshVaultAccess();
      return;
    }
    const requestId = ++vaultAccessRequestId;
    const pin = ui.vaultPin.value;
    ui.vaultAccessSubmit.disabled = true;
    try {
      const correct = await verifyVaultPin(pin);
      if (requestId !== vaultAccessRequestId || !ui.vaultAccessDialog.open) return;
      const latest = readVaultAccessState();
      if (!latest.available) {
        refreshVaultAccess();
        return;
      }
      const result = recordVaultAttempt(latest.state, correct, Date.now());
      if (!saveVaultAccessState(result.state)) {
        refreshVaultAccess();
        return;
      }
      ui.vaultPin.value = '';
      if (result.status === 'unlocked') {
        closeVaultAccessDialog();
        openScoreVault();
      } else if (result.status === 'wrong') {
        ui.vaultAccessStatus.textContent = `密码错误。5 分钟内还可尝试 ${result.remaining} 次。`;
        ui.vaultPin.focus();
      } else {
        refreshVaultAccess();
        ui.vaultAccessCancel.focus();
      }
    } catch {
      ui.vaultAccessStatus.textContent = '无法验证密码，请稍后再试。';
    } finally {
      if (ui.vaultAccessDialog.open) {
        const current = readVaultAccessState();
        ui.vaultAccessSubmit.disabled = !current.available
          || Boolean(normalizeVaultAccessState(current.state, Date.now()).lockedUntil);
      }
    }
  }

  function closeScoreVault() {
    ui.scoreVault.hidden = true;
    ui.form.hidden = false;
    ui.openScoreVault.focus();
  }

  function openScoreProfileDialog(profileId = null) {
    const profile = profiles.find(({ id }) => id === profileId);
    editingProfileId = profile?.id || null;
    ui.scoreProfileDialogTitle.textContent = profile ? '修改玩家' : '录入玩家';
    ui.scoreProfileName.value = profile?.name || '';
    ui.scoreProfileBalance.value = unitsToBalance(profile?.balanceUnits ?? INITIAL_BALANCE_UNITS).toFixed(1);
    ui.scoreProfileError.textContent = '';
    ui.deleteScoreProfile.hidden = !profile;
    if (typeof ui.scoreProfileDialog.showModal === 'function') ui.scoreProfileDialog.showModal();
    else ui.scoreProfileDialog.setAttribute('open', '');
    ui.scoreProfileName.focus();
  }

  function closeScoreProfileDialog() {
    if (ui.scoreProfileDialog.open) ui.scoreProfileDialog.close();
    else ui.scoreProfileDialog.removeAttribute('open');
    editingProfileId = null;
  }

  function saveScoreProfile() {
    const name = ui.scoreProfileName.value.trim();
    const balanceUnits = balanceToUnits(Number(ui.scoreProfileBalance.value));
    const duplicate = profiles.find((profile) => (
      profile.id !== editingProfileId && normalizeProfileName(profile.name) === normalizeProfileName(name)
    ));

    ui.scoreProfileError.textContent = !name
      ? '请输入玩家昵称。'
      : name.length > 12
        ? '昵称最多 12 个字符。'
      : balanceUnits === null || balanceUnits < 0
        ? '金币余额必须是大于等于 0、精确到 0.1 的数字。'
      : duplicate
        ? '已经存在同名玩家，请直接修改原有玩家。'
        : '';
    if (ui.scoreProfileError.textContent) return;

    const previousProfiles = profiles.map((profile) => ({ ...profile }));
    const profile = profiles.find(({ id }) => id === editingProfileId);
    if (profile) {
      profile.name = name;
      profile.balanceUnits = balanceUnits;
    } else {
      profiles.push({ id: createProfileId(), name, balanceUnits });
    }

    if (!saveProfiles()) {
      profiles = previousProfiles;
      ui.scoreProfileError.textContent = '浏览器未允许保存数据，请先不要关闭本页面。';
      return;
    }
    closeScoreProfileDialog();
    refreshProfileViews();
    ui.scoreVaultStatus.textContent = `${name}的长期金币已保存。`;
  }

  function closeScoreDeleteConfirmDialog() {
    if (ui.scoreDeleteConfirmDialog.open) ui.scoreDeleteConfirmDialog.close();
    else ui.scoreDeleteConfirmDialog.removeAttribute('open');
    pendingDeleteProfileId = null;
  }

  function requestScoreProfileDelete() {
    const profile = profiles.find(({ id }) => id === editingProfileId);
    if (!profile) return;
    const profileId = profile.id;
    const profileName = profile.name;
    closeScoreProfileDialog();
    pendingDeleteProfileId = profileId;
    ui.scoreDeleteConfirmMessage.textContent = `${profileName}的玩家档案和长期金币将从本机删除。`;
    if (typeof ui.scoreDeleteConfirmDialog.showModal === 'function') ui.scoreDeleteConfirmDialog.showModal();
    else ui.scoreDeleteConfirmDialog.setAttribute('open', '');
    ui.cancelScoreDeleteConfirm.focus();
  }

  function continueScoreProfileDelete() {
    if (!profiles.some(({ id }) => id === pendingDeleteProfileId)) {
      closeScoreDeleteConfirmDialog();
      return;
    }
    if (ui.scoreDeleteConfirmDialog.open) ui.scoreDeleteConfirmDialog.close();
    else ui.scoreDeleteConfirmDialog.removeAttribute('open');
    ui.scoreDeleteConfirmText.value = '';
    ui.scoreDeleteFinalError.textContent = '';
    if (typeof ui.scoreDeleteFinalDialog.showModal === 'function') ui.scoreDeleteFinalDialog.showModal();
    else ui.scoreDeleteFinalDialog.setAttribute('open', '');
    ui.scoreDeleteConfirmText.focus();
  }

  function closeScoreDeleteFinalDialog() {
    if (ui.scoreDeleteFinalDialog.open) ui.scoreDeleteFinalDialog.close();
    else ui.scoreDeleteFinalDialog.removeAttribute('open');
    ui.scoreDeleteConfirmText.value = '';
    ui.scoreDeleteFinalError.textContent = '';
    pendingDeleteProfileId = null;
  }

  function clearDeletedProfileFromSetup(profileId) {
    playerEntries.forEach((entry) => {
      if (entry.nameInput.dataset.profileId === profileId) {
        entry.nameInput.value = '';
        delete entry.nameInput.dataset.profileId;
      }
      if (entry.nameInput.dataset.humanProfileId === profileId) {
        entry.nameInput.dataset.humanName = '';
        entry.nameInput.dataset.humanProfileId = '';
      }
      if (entry.nameInput.dataset.inactiveProfileId === profileId) {
        entry.nameInput.dataset.inactiveName = '';
        entry.nameInput.dataset.inactiveProfileId = '';
      }
    });
  }

  function deleteScoreProfile() {
    if (ui.scoreDeleteConfirmText.value !== 'DELETE') {
      ui.scoreDeleteFinalError.textContent = '请输入大写的 DELETE。';
      ui.scoreDeleteConfirmText.focus();
      return;
    }
    const removal = removeProfile(profiles, pendingDeleteProfileId);
    const profile = removal.removedProfile;
    if (!profile) {
      ui.scoreDeleteFinalError.textContent = '这位玩家已经不存在。';
      return;
    }
    const previousProfiles = profiles;
    profiles = removal.profiles;
    if (!saveProfiles()) {
      profiles = previousProfiles;
      ui.scoreDeleteFinalError.textContent = '浏览器未允许保存数据，玩家没有被删除。';
      return;
    }
    clearDeletedProfileFromSetup(profile.id);
    if (ui.scoreDeleteFinalDialog.open) ui.scoreDeleteFinalDialog.close();
    else ui.scoreDeleteFinalDialog.removeAttribute('open');
    pendingDeleteProfileId = null;
    refreshProfileViews();
    ui.scoreVaultStatus.textContent = `${profile.name}的玩家档案和长期金币已删除。`;
  }

  function exportScoreBackup() {
    if (profiles.length === 0) return;
    const backup = createScoreBackup(profiles);
    const link = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 16).replaceAll(':', '-').replace('T', '-');
    link.href = `data:application/json;charset=utf-8,${encodeURIComponent(`${JSON.stringify(backup, null, 2)}\n`)}`;
    link.download = `闪光跳棋-积分备份-${stamp}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    ui.scoreVaultStatus.textContent = `已导出 ${profiles.length} 位玩家的积分备份。`;
  }

  function openScoreImportDialog(importedPlayers) {
    pendingImportedPlayers = importedPlayers;
    ui.scoreImportPreview.replaceChildren();
    importedPlayers.forEach((player) => {
      const row = document.createElement('div');
      row.className = 'score-import-row';
      const name = document.createElement('span');
      name.textContent = player.name;
      const balance = document.createElement('strong');
      balance.textContent = formatCoinUnits(player.balanceUnits);
      row.append(name, balance);
      ui.scoreImportPreview.appendChild(row);
    });
    ui.scoreImportSummary.textContent = `备份包含 ${importedPlayers.length} 位玩家，请核对昵称和余额。`;
    if (typeof ui.scoreImportDialog.showModal === 'function') ui.scoreImportDialog.showModal();
    else ui.scoreImportDialog.setAttribute('open', '');
    ui.cancelScoreImport.focus();
  }

  function closeScoreImportDialog() {
    if (ui.scoreImportDialog.open) ui.scoreImportDialog.close();
    else ui.scoreImportDialog.removeAttribute('open');
    pendingImportedPlayers = [];
  }

  async function readScoreBackupFile() {
    const [file] = ui.scoreBackupFile.files;
    ui.scoreBackupFile.value = '';
    if (!file) return;
    if (file.size > 1024 * 1024) {
      ui.scoreVaultStatus.textContent = '备份文件过大，请选择闪光跳棋导出的 JSON 文件。';
      return;
    }
    try {
      const backup = parseScoreBackup(await file.text());
      openScoreImportDialog(backup.players);
    } catch (error) {
      ui.scoreVaultStatus.textContent = error instanceof Error ? error.message : '无法读取这份积分备份。';
    }
  }

  function importScoreBackup() {
    if (pendingImportedPlayers.length === 0) {
      closeScoreImportDialog();
      return;
    }
    const result = mergeScoreBackup(profiles, pendingImportedPlayers, createProfileId);
    const previousProfiles = profiles;
    profiles = result.profiles;
    if (!saveProfiles()) {
      profiles = previousProfiles;
      ui.scoreImportSummary.textContent = '浏览器未允许保存数据，请取消导入并保留当前页面。';
      return;
    }
    closeScoreImportDialog();
    refreshProfileViews();
    ui.scoreVaultStatus.textContent = `积分已恢复：更新 ${result.updatedCount} 位，新增 ${result.addedCount} 位。`;
  }

  function setEntryKind(entry, kind) {
    const previousKind = entry.kindInput.value;
    if (kind === 'empty') {
      if (previousKind !== 'empty') {
        entry.nameInput.dataset.inactiveName = previousKind === 'computer'
          ? entry.nameInput.dataset.humanName || ''
          : entry.nameInput.value;
        entry.nameInput.dataset.inactiveProfileId = previousKind === 'computer'
          ? entry.nameInput.dataset.humanProfileId || ''
          : entry.nameInput.dataset.profileId || '';
      }
      entry.nameInput.value = '';
      delete entry.nameInput.dataset.profileId;
    } else if (previousKind === 'empty') {
      entry.nameInput.value = entry.nameInput.dataset.inactiveName || '';
      if (entry.nameInput.dataset.inactiveProfileId) {
        entry.nameInput.dataset.profileId = entry.nameInput.dataset.inactiveProfileId;
      } else {
        delete entry.nameInput.dataset.profileId;
      }
    }

    if (kind === 'computer' && previousKind !== 'computer') {
      entry.nameInput.dataset.humanName = entry.nameInput.value;
      entry.nameInput.dataset.humanProfileId = entry.nameInput.dataset.profileId || '';
      entry.nameInput.value = 'Lumen';
      delete entry.nameInput.dataset.profileId;
    } else if (kind === 'human' && previousKind === 'computer') {
      entry.nameInput.value = entry.nameInput.dataset.humanName || '';
      if (entry.nameInput.dataset.humanProfileId) {
        entry.nameInput.dataset.profileId = entry.nameInput.dataset.humanProfileId;
      }
    }

    entry.kindInput.value = kind;
    entry.fieldset.dataset.kind = kind;
    entry.nameInput.disabled = kind !== 'human';
    entry.kindButtons.forEach((button) => {
      button.setAttribute('aria-checked', String(button.dataset.kind === kind));
    });
  }

  function chooseEntryKind(entry, kind) {
    if (kind === 'computer') {
      const previousComputer = playerEntries.find((candidate) => (
        candidate !== entry && candidate.kindInput.value === 'computer'
      ));
      if (previousComputer) setEntryKind(previousComputer, 'human');
    }
    setEntryKind(entry, kind);
  }

  function updateProfileCards() {
    playerEntries.forEach((entry) => {
      entry.nameSummary.textContent = entry.nameInput.value.trim() || '选择玩家';
      entry.nameButton.title = entry.kindInput.value === 'human'
        ? `选择玩家：${entry.nameInput.value.trim() || '尚未选择'}`
        : entry.nameInput.value.trim();
      entry.nameButton.disabled = entry.kindInput.value !== 'human';
      entry.colorButton.disabled = entry.kindInput.value === 'empty';
      entry.fieldset.querySelector('.seat-number').textContent = entry.kindInput.value === 'computer'
        ? 'L'
        : String(entry.number);
    });
    if (activeSetupPlayerEntry && ui.setupPlayerDialog.open) buildProfileCards();
  }

  function buildProfileCards() {
    ui.setupProfileList.replaceChildren();
    if (!activeSetupPlayerEntry) return;
    profiles.forEach((profile) => {
      const usedByOther = playerEntries.some((entry) => (
        entry !== activeSetupPlayerEntry
        && entry.kindInput.value !== 'empty'
        && entry.nameInput.dataset.profileId === profile.id
      ));
      const card = document.createElement('button');
      card.className = 'setup-profile-option';
      card.type = 'button';
      card.disabled = usedByOther;
      card.setAttribute('aria-label', `${profile.name}，长期金币 ${formatCoinUnits(profile.balanceUnits)}${usedByOther ? '，已在其他席位' : ''}`);
      const avatar = document.createElement('span');
      avatar.className = 'setup-profile-avatar';
      avatar.textContent = [...profile.name][0] || '玩';
      const name = document.createElement('strong');
      name.textContent = profile.name;
      const balance = document.createElement('small');
      balance.textContent = `★ ${formatCoinUnits(profile.balanceUnits)}`;
      card.append(avatar, name, balance);
      card.addEventListener('click', () => {
        activeSetupPlayerEntry.nameInput.value = profile.name;
        activeSetupPlayerEntry.nameInput.dataset.profileId = profile.id;
        closeSetupPlayerDialog();
        validateNames();
      });
      ui.setupProfileList.appendChild(card);
    });
  }

  function openSetupPlayerDialog(entry) {
    if (entry.kindInput.value !== 'human') return;
    activeSetupPlayerEntry = entry;
    ui.setupPlayerDialogLead.textContent = `为${entry.fieldset.querySelector('.seat-title').textContent}选择已有玩家，或者输入一个新昵称。`;
    ui.setupNewPlayerName.value = '';
    buildProfileCards();
    if (typeof ui.setupPlayerDialog.showModal === 'function') ui.setupPlayerDialog.showModal();
    else ui.setupPlayerDialog.setAttribute('open', '');
    if (profiles.length === 0) ui.setupNewPlayerName.focus();
    else ui.setupPlayerDialogTitle.focus();
  }

  function closeSetupPlayerDialog() {
    if (ui.setupPlayerDialog.open) ui.setupPlayerDialog.close();
    else ui.setupPlayerDialog.removeAttribute('open');
    activeSetupPlayerEntry = null;
  }

  function useSetupNewPlayerName() {
    if (!activeSetupPlayerEntry) return;
    const name = ui.setupNewPlayerName.value.trim();
    if (!name) {
      ui.setupNewPlayerName.focus();
      return;
    }
    activeSetupPlayerEntry.nameInput.value = name;
    delete activeSetupPlayerEntry.nameInput.dataset.profileId;
    closeSetupPlayerDialog();
    validateNames();
  }

  function activeColorEntries(excludedEntry = null) {
    return playerEntries.filter((entry) => (
      entry !== excludedEntry && entry.kindInput.value !== 'empty'
    ));
  }

  function firstUnusedColor(excludedEntry = null) {
    const usedColors = new Set(activeColorEntries(excludedEntry).map(({ colorInput }) => colorInput.value));
    return Object.keys(COLOR_META).find((colorKey) => !usedColors.has(colorKey)) || 'red';
  }

  function ensureUniqueActiveColors() {
    const usedColors = new Set();
    playerEntries.forEach((entry) => {
      if (entry.kindInput.value === 'empty') return;
      if (usedColors.has(entry.colorInput.value)) {
        entry.colorInput.value = firstUnusedColor(entry);
      }
      usedColors.add(entry.colorInput.value);
    });
  }

  function buildColorCards() {
    ui.setupColorGrid.replaceChildren();
    Object.entries(COLOR_META).forEach(([colorKey, meta]) => {
      const option = document.createElement('button');
      option.className = 'color-option';
      option.type = 'button';
      option.dataset.color = colorKey;
      option.setAttribute('role', 'radio');
      option.setAttribute('aria-checked', 'false');
      option.style.setProperty('--swatch', meta.value);
      const preview = document.createElement('span');
      preview.className = 'color-preview';
      const name = document.createElement('span');
      name.className = 'color-option-name';
      name.textContent = meta.colorName;
      const state = document.createElement('span');
      state.className = 'color-option-state';
      option.append(preview, name, state);
      option.addEventListener('click', () => {
        if (!activeSetupColorEntry || option.disabled) return;
        activeSetupColorEntry.colorInput.value = colorKey;
        saveStartingColors();
        closeSetupColorDialog();
        validateNames();
      });
      ui.setupColorGrid.appendChild(option);
    });
  }

  function updateSetupColorCards() {
    playerEntries.forEach(({ colorInput, colorSummary, fieldset }) => {
      const selectedColor = COLOR_META[colorInput.value];
      colorSummary.textContent = selectedColor?.colorName || '选择颜色';
      fieldset.style.setProperty('--seat-color', selectedColor?.value || '#687083');
      fieldset.querySelector('.color-select').title = `棋子颜色：${selectedColor?.colorName || '尚未选择'}`;
    });
    ui.setupColorGrid.querySelectorAll('.color-option').forEach((option) => {
      const colorKey = option.dataset.color;
      const selected = activeSetupColorEntry?.colorInput.value === colorKey;
      const occupied = Boolean(activeSetupColorEntry) && activeColorEntries(activeSetupColorEntry).some((entry) => (
        entry.colorInput.value === colorKey
      ));
      option.setAttribute('aria-checked', String(selected));
      option.disabled = occupied;
      option.querySelector('.color-option-state').textContent = occupied ? '已占用' : '';
    });
  }

  function openSetupColorDialog(entry) {
    if (entry.kindInput.value === 'empty') return;
    activeSetupColorEntry = entry;
    ui.setupColorDialogLead.textContent = `为${entry.fieldset.querySelector('.seat-title').textContent}选择颜色；已被其他参与者使用的颜色不可选择。`;
    updateSetupColorCards();
    if (typeof ui.setupColorDialog.showModal === 'function') ui.setupColorDialog.showModal();
    else ui.setupColorDialog.setAttribute('open', '');
  }

  function closeSetupColorDialog() {
    if (ui.setupColorDialog.open) ui.setupColorDialog.close();
    else ui.setupColorDialog.removeAttribute('open');
    activeSetupColorEntry = null;
    updateSetupColorCards();
  }

  function validateNames() {
    updateSetupColorCards();
    updateProfileCards();
    const activeEntries = playerEntries.filter(({ kindInput }) => kindInput.value !== 'empty');
    const names = activeEntries.map(({ nameInput, number }) => nameInput.value.trim() || `玩家${number}`);
    const enoughPlayers = activeEntries.length >= 2;
    const namesUnique = new Set(names.map(normalizeProfileName)).size === names.length;
    const colors = activeEntries.map(({ colorInput }) => colorInput.value);
    const colorsComplete = activeEntries.every(({ colorInput }) => Boolean(COLOR_META[colorInput.value]));
    const colorsUnique = colorsComplete && new Set(colors).size === colors.length;
    const computerCount = activeEntries.filter(({ kindInput }) => kindInput.value === 'computer').length;
    const hasHumanPlayer = activeEntries.some(({ kindInput }) => kindInput.value === 'human');
    ui.start.textContent = `开始${activeEntries.length}人局`;
    ui.start.disabled = !enoughPlayers
      || !namesUnique
      || !colorsUnique
      || computerCount > 1
      || !hasHumanPlayer;
    ui.setupHelp.textContent = !enoughPlayers
      ? '请至少选择两位参与者。玩家姓名可以不填。'
      : !namesUnique
        ? '参与本局的玩家需要使用不同昵称，以便保存各自金币。'
      : !colorsComplete
        ? '请为参与本局的玩家选择棋子颜色。'
      : !colorsUnique
        ? '参与本局的玩家需要选择不同的棋子颜色。'
        : computerCount > 1
          ? '每局最多加入一位简单电脑，请调整玩家类型。'
        : !hasHumanPlayer
          ? '至少保留一位真人玩家，才能开始游戏。'
        : `${activeEntries.length}人局准备完成${activeEntries.some(({ kindInput }) => kindInput.value === 'computer') ? '；简单电脑只看当前一步。' : '，可以开始。'}`;
  }

  function startGame() {
    const assignments = playerEntries.map(({ number, nameInput, kindInput, colorInput }) => ({
      number,
      enteredName: nameInput.value.trim(),
      name: nameInput.value.trim() || `玩家${number}`,
      kind: kindInput.value,
      color: colorInput.value,
      profileId: nameInput.dataset.profileId || null,
      humanName: nameInput.dataset.humanName || null,
      humanProfileId: nameInput.dataset.humanProfileId || null,
    })).filter(({ kind }) => kind !== 'empty');
    if (
      assignments.length < 2
      || assignments.some(({ color }) => !COLOR_META[color])
      || assignments.filter(({ kind }) => kind === 'computer').length > 1
      || assignments.every(({ kind }) => kind === 'computer')
      || new Set(assignments.map(({ name }) => normalizeProfileName(name))).size !== assignments.length
      || new Set(assignments.map(({ color }) => color)).size !== assignments.length
    ) return;
    saveStartingColors();

    assignments.forEach((assignment) => {
      assignment.profile = assignment.kind === 'computer'
        ? { id: 'computer-simple', name: assignment.name, balanceUnits: INITIAL_BALANCE_UNITS }
        : assignment.enteredName
          ? resolveProfile(assignment.name, assignment.profileId)
          : { id: `guest-seat-${assignment.number}`, name: assignment.name, balanceUnits: INITIAL_BALANCE_UNITS };
    });
    const activeCamps = createPlayerCampLayout(assignments.length);
    players = activeCamps.map((camp, index) => {
      const assignment = assignments[index];
      return {
        ...COLOR_META[assignment.color],
        camp,
        kind: assignment.kind,
        name: assignment.profile.name,
        profileId: assignment.profile.id,
        balanceUnits: assignment.profile.balanceUnits,
      };
    });
    applyBoardPalette();
    ui.form.hidden = true;
    ui.game.hidden = false;
    chooseMode(ui.standard);
    resetGame(createStartingPieces(), standardDescription(), true, true, players[0].camp, true);
  }

  function formatRecordTime(date) {
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  function formatDuration(start, end) {
    const totalMinutes = Math.max(0, Math.round((end - start) / 60000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return hours ? `${hours} 小时 ${minutes} 分钟` : `${minutes} 分钟`;
  }

  function exportMatchRecord() {
    if (!gameOver || !matchStartedAt || !matchEndedAt) return;
    const rankingLines = finished.map((camp, index) => {
      const player = playerForCamp(camp);
      const rankRewardUnits = matchRankRewardUnits.get(player.profileId) || 0;
      return `${index + 1}. ${player.name} · ${player.colorName}${coinsEnabled ? ` · 名次奖励 ${signedCoinText(rankRewardUnits)}` : ''}`;
    });
    const coinLines = players.map((player) => {
      if (!coinsEnabled) return `- ${player.name}：调试场景，本局未计分`;
      const earnedUnits = matchCoinUnits.get(player.profileId) || 0;
      const rankRewardUnits = matchRankRewardUnits.get(player.profileId) || 0;
      const playUnits = earnedUnits - rankRewardUnits;
      return `- ${player.name}：本局 ${signedCoinText(earnedUnits)}（行棋 ${signedCoinText(playUnits)}，名次 ${signedCoinText(rankRewardUnits)}），长期余额 ${formatCoinUnits(player.balanceUnits)}`;
    });
    const timeLines = players.map((player) => {
      if (player.kind === 'computer') return `- ${player.name}：电脑玩家，不计时`;
      const turns = turnTimeHistory
        .filter(({ camp }) => camp === player.camp)
        .map(({ playerTurn, seconds }) => `第 ${playerTurn} 回合 ${formatClockSeconds(seconds)}`)
        .join('、');
      return `- ${player.name}：累计 ${formatClockSeconds(matchTimeSeconds.get(player.camp) || 0)}${turns ? `（${turns}）` : ''}`;
    });
    const content = [
      "# 闪光跳棋 | Lumen's Checker 战绩",
      '',
      `- 开始时间：${formatRecordTime(matchStartedAt)}`,
      `- 结束时间：${formatRecordTime(matchEndedAt)}`,
      `- 对局时长：${formatDuration(matchStartedAt, matchEndedAt)}`,
      `- 模式：${players.length}人局`,
      `- 计分：${coinsEnabled ? '标准对局' : '调试场景（不计金币）'}`,
      '',
      '## 排名',
      '',
      ...rankingLines,
      '',
      '## 金币',
      '',
      ...coinLines,
      '',
      '## 用时',
      '',
      ...timeLines,
      '',
    ].join('\n');
    const link = document.createElement('a');
    const stamp = matchEndedAt.toISOString().slice(0, 16).replaceAll(':', '-').replace('T', '-');
    link.href = `data:text/markdown;charset=utf-8,${encodeURIComponent(content)}`;
    link.download = `跳棋战绩-${stamp}.md`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function buildResultsPanel() {
    ui.resultsList.replaceChildren();
    finished.forEach((camp, index) => {
      const player = playerForCamp(camp);
      if (!player) return;

      const row = document.createElement('article');
      row.className = `result-row${index === 0 ? ' is-winner' : ''}`;

      const rank = document.createElement('span');
      rank.className = 'result-rank';
      rank.textContent = String(index + 1);

      const playerBlock = document.createElement('div');
      playerBlock.className = 'result-player';
      const name = document.createElement('div');
      name.className = 'result-name';
      const dot = document.createElement('span');
      dot.className = 'dot';
      applyPlayerColor(dot, player);
      const nameText = document.createElement('span');
      nameText.textContent = `${player.name} · ${player.colorName}`;
      name.append(dot, nameText);
      const time = document.createElement('div');
      time.className = 'result-meta';
      time.textContent = player.kind === 'computer'
        ? '电脑玩家 · 不计时'
        : `累计用时 ${formatClockSeconds(matchTimeSeconds.get(player.camp) || 0)}`;
      playerBlock.append(name, time);

      const coins = document.createElement('div');
      coins.className = 'result-coins';
      const matchCoins = document.createElement('span');
      const totalMatchUnits = matchCoinUnits.get(player.profileId) || 0;
      const rankRewardUnits = matchRankRewardUnits.get(player.profileId) || 0;
      const playUnits = totalMatchUnits - rankRewardUnits;
      matchCoins.textContent = coinsEnabled
        ? `本局 ${signedCoinText(totalMatchUnits)}`
        : '本局未计分';
      const breakdown = document.createElement('span');
      breakdown.className = 'result-coin-breakdown';
      breakdown.textContent = coinsEnabled
        ? `行棋 ${signedCoinText(playUnits)} · 名次 ${signedCoinText(rankRewardUnits)}`
        : '';
      const totalCoins = document.createElement('span');
      totalCoins.textContent = `累计 ${formatCoinUnits(player.balanceUnits)}`;
      coins.append(matchCoins, breakdown, totalCoins);

      row.append(rank, playerBlock, coins);
      ui.resultsList.appendChild(row);
    });
  }

  function launchFireworks() {
    if (typeof window.confetti !== 'function') return;
    if (!fireworks) {
      fireworks = window.confetti.create(ui.fireworksCanvas, {
        resize: true,
        useWorker: true,
        disableForReducedMotion: true,
      });
    }

    const runId = ++celebrationRunId;
    const endAt = performance.now() + 2600;
    const colors = [...new Set([...players.map(({ value }) => value), '#f4c64e', '#fff4bd'])];
    const tick = () => {
      if (runId !== celebrationRunId || !ui.resultsDialog.open) return;
      fireworks({
        particleCount: 4,
        angle: 62,
        spread: 54,
        startVelocity: 50,
        gravity: 0.9,
        decay: 0.94,
        scalar: 0.9,
        origin: { x: 0.05, y: 1 },
        colors,
        shapes: ['circle', 'star'],
      });
      fireworks({
        particleCount: 4,
        angle: 118,
        spread: 54,
        startVelocity: 50,
        gravity: 0.9,
        decay: 0.94,
        scalar: 0.9,
        origin: { x: 0.95, y: 1 },
        colors,
        shapes: ['circle', 'star'],
      });
      if (performance.now() < endAt) fireworksTimer = window.setTimeout(tick, 90);
    };
    tick();
  }

  function openResultsDialog() {
    resultsOpenTimer = null;
    if (!gameOver || ui.resultsDialog.open) return;
    buildResultsPanel();
    disarmRestart();
    if (typeof ui.resultsDialog.showModal === 'function') ui.resultsDialog.showModal();
    else ui.resultsDialog.setAttribute('open', '');
    ui.closeResults.focus();
    launchFireworks();
  }

  function closeResultsDialog() {
    if (typeof ui.resultsDialog.close === 'function' && ui.resultsDialog.open) ui.resultsDialog.close();
    else ui.resultsDialog.removeAttribute('open');
    stopFireworks();
    disarmRestart();
  }

  const wait = (duration) => new Promise((resolve) => window.setTimeout(resolve, duration));

  function scheduleComputerTurn() {
    const token = ++computerTurnToken;
    if (gameOver || now().kind !== 'computer') return;
    window.setTimeout(() => runComputerTurn(token), 0);
  }

  async function runComputerTurn(token) {
    if (token !== computerTurnToken || gameOver || now().kind !== 'computer') return;
    const computer = now();
    computerRunning = true;
    clearSelection();
    updateTurnUi();
    ui.status.textContent = `${playerName(computer)} 正在查看棋盘`;
    ui.list.textContent = `最多评估 ${COMPUTER_MAX_ROUTES} 条路线，只判断当前一步。`;
    await wait(COMPUTER_THINK_DELAY);

    if (token !== computerTurnToken || gameOver || now() !== computer) return;
    const route = chooseSimpleComputerRoute({
      boardKeys,
      pieces,
      color: computer.camp,
      maxRoutes: COMPUTER_MAX_ROUTES,
      maxJumpDepth: COMPUTER_MAX_JUMP_DEPTH,
    });

    if (!route) {
      computerRunning = false;
      nextActiveTurn();
      renderPieces();
      startTurnClock();
      ui.status.textContent = `${playerName(computer)}没有合法走法，本回合跳过`;
      ui.list.textContent = `轮到${playerLabel(now())}。`;
      scheduleComputerTurn();
      return;
    }

    for (let index = 0; index < route.moves.length; index += 1) {
      if (token !== computerTurnToken || gameOver) return;
      const position = findPiecePosition(route.pieceId);
      if (!position) break;
      const [q, r] = position.split(',').map(Number);
      const piece = pieces.get(position);
      showLegalMoves(groups.get(position), q, r, piece, index > 0);
      const plannedMove = route.moves[index];
      const liveRule = selected?.legalMoves.get(plannedMove.destination);
      if (!liveRule) break;
      await moveSelectedPiece(plannedMove.destination, liveRule);
      if (index < route.moves.length - 1) await wait(COMPUTER_STEP_DELAY);
    }

    if (token !== computerTurnToken || gameOver) return;
    if (!committed) {
      computerRunning = false;
      nextActiveTurn();
      renderPieces();
      startTurnClock();
      ui.status.textContent = `${playerName(computer)}没有完成有效走法，本回合跳过`;
      ui.list.textContent = `轮到${playerLabel(now())}。`;
      scheduleComputerTurn();
      return;
    }
    ui.status.textContent = `${playerName(computer)}完成了这一步`;
    ui.list.textContent = route.moves.length > 1
      ? `连续跳跃 ${route.moves.length} 次，准备结束回合。`
      : '准备结束回合。';
    await wait(260);
    if (token !== computerTurnToken || gameOver) return;
    computerRunning = false;
    finishTurn();
  }

  function finishTurn() {
    if (animating || !committed || gameOver) return;
    const completedPlayer = now();
    const completedTurnSeconds = settleTurnClock(completedPlayer);
    const finalPosition = findPiecePosition(turnPieceId);
    let targetRewardUnits = 0;
    if (coinsEnabled && finalPosition && lastLandingFresh) {
      targetRewardUnits = calculateTargetReward({
        targetRewardMap: targetRewards[completedPlayer.camp],
        position: finalPosition,
        claimedKeys: claimedTargetKeys,
      });
      if (targetRewardUnits > 0) claimedTargetKeys.add(finalPosition);
    }
    const settledTurnUnits = coinsEnabled
      ? settleTurnReward({
        jumpUnits: turnRewardUnits,
        targetUnits: targetRewardUnits,
        undoUsed: undoFeeApplied,
        undoFeeUnits: UNDO_FEE_UNITS,
      })
      : 0;
    if (coinsEnabled) {
      matchCoinUnits.set(
        completedPlayer.profileId,
        (matchCoinUnits.get(completedPlayer.profileId) || 0) + settledTurnUnits,
      );
    }
    const won = hasWon(completedPlayer.camp);

    if (won && !finished.includes(completedPlayer.camp)) finished.push(completedPlayer.camp);
    if (won && finished.length === players.length - 1) {
      const lastPlayer = players.find((player) => !finished.includes(player.camp));
      if (lastPlayer) finished.push(lastPlayer.camp);
      gameOver = true;
      matchEndedAt = new Date();
    }

    lockedPieceId = null;
    committed = false;
    history = [];
    resetTurnLedger();
    if (!gameOver) nextActiveTurn();
    else settleMatchCoins();
    renderPieces();
    if (targetRewardUnits > 0) showCoinFloat(groups.get(finalPosition), targetRewardUnits);

    const coinResultText = coinsEnabled ? signedCoinText(settledTurnUnits) : null;

    if (gameOver) {
      ui.status.textContent = '本局结束';
      ui.list.textContent = coinsEnabled
        ? `全部名次已经确定；最后回合 ${coinResultText}，本局金币与名次奖励已存入长期余额。`
        : '全部名次已经确定。';
      window.clearTimeout(resultsOpenTimer);
      resultsOpenTimer = window.setTimeout(openResultsDialog, 180);
    } else if (won) {
      const rankRewardText = signedCoinText(calculateRankReward(finished.indexOf(completedPlayer.camp) + 1));
      ui.status.textContent = `${playerLabel(completedPlayer)}完成比赛，获得第${finished.indexOf(completedPlayer.camp) + 1}名`;
      ui.list.textContent = `已自动跳过完成玩家${coinsEnabled ? `；本回合 ${coinResultText}，名次奖励 ${rankRewardText} 将在本局结束时入账` : ''}，轮到${playerLabel(now())}。`;
    } else {
      ui.status.textContent = `${playerLabel(completedPlayer)}结束回合，轮到${playerLabel(now())}`;
      ui.list.textContent = `${coinsEnabled ? `本回合已结算 ${coinResultText}。` : ''}${completedPlayer.kind === 'computer' ? '' : `本回合用时 ${formatClockSeconds(completedTurnSeconds)}。`}请${playerLabel(now())}选择棋子。`;
    }
    startTurnClock();
    scheduleComputerTurn();
  }

  playerEntries.forEach((entry) => {
    entry.kindButtons.forEach((button) => {
      button.addEventListener('click', () => {
        chooseEntryKind(entry, button.dataset.kind);
        ensureUniqueActiveColors();
        validateNames();
      });
    });
    entry.nameButton.addEventListener('click', () => openSetupPlayerDialog(entry));
    entry.colorButton.addEventListener('click', () => openSetupColorDialog(entry));
  });
  playerEntries.forEach(({ nameInput }) => {
    nameInput.addEventListener('input', () => {
      delete nameInput.dataset.profileId;
      validateNames();
    });
  });
  ui.setupUseNewPlayer.addEventListener('click', useSetupNewPlayerName);
  ui.setupNewPlayerName.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.isComposing) {
      event.preventDefault();
      useSetupNewPlayerName();
    }
  });
  ui.setupClosePlayer.addEventListener('click', closeSetupPlayerDialog);
  ui.setupPlayerDialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeSetupPlayerDialog();
  });
  ui.setupCloseColor.addEventListener('click', closeSetupColorDialog);
  ui.setupColorDialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeSetupColorDialog();
  });
  ui.openScoreVault.addEventListener('click', requestScoreVaultAccess);
  ui.vaultAccessForm.addEventListener('submit', (event) => {
    event.preventDefault();
    submitScoreVaultAccess();
  });
  ui.vaultAccessCancel.addEventListener('click', closeVaultAccessDialog);
  ui.vaultAccessDialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeVaultAccessDialog();
  });
  window.addEventListener('storage', (event) => {
    if (event.key !== VAULT_ACCESS_STORAGE_KEY) return;
    if (ui.vaultAccessDialog.open) refreshVaultAccess();
    if (!ui.scoreVault.hidden && normalizeVaultAccessState(readVaultAccessState().state, Date.now()).lockedUntil) {
      closeScoreVault();
    }
  });
  ui.closeScoreVault.addEventListener('click', closeScoreVault);
  ui.addScoreProfile.addEventListener('click', () => openScoreProfileDialog());
  ui.exportScoreBackup.addEventListener('click', exportScoreBackup);
  ui.importScoreBackup.addEventListener('click', () => ui.scoreBackupFile.click());
  ui.scoreBackupFile.addEventListener('change', readScoreBackupFile);
  ui.scoreProfileForm.addEventListener('submit', (event) => {
    event.preventDefault();
    saveScoreProfile();
  });
  ui.cancelScoreProfile.addEventListener('click', closeScoreProfileDialog);
  ui.deleteScoreProfile.addEventListener('click', requestScoreProfileDelete);
  ui.scoreProfileDialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeScoreProfileDialog();
  });
  ui.cancelScoreDeleteConfirm.addEventListener('click', closeScoreDeleteConfirmDialog);
  ui.continueScoreDelete.addEventListener('click', continueScoreProfileDelete);
  ui.scoreDeleteConfirmDialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeScoreDeleteConfirmDialog();
  });
  ui.scoreDeleteFinalForm.addEventListener('submit', (event) => {
    event.preventDefault();
    deleteScoreProfile();
  });
  ui.cancelScoreDeleteFinal.addEventListener('click', closeScoreDeleteFinalDialog);
  ui.scoreDeleteFinalDialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeScoreDeleteFinalDialog();
  });
  ui.scoreImportForm.addEventListener('submit', (event) => {
    event.preventDefault();
    importScoreBackup();
  });
  ui.cancelScoreImport.addEventListener('click', closeScoreImportDialog);
  ui.scoreImportDialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeScoreImportDialog();
  });
  ui.start.addEventListener('click', (event) => {
    event.preventDefault();
    startGame();
  });
  ui.form.addEventListener('submit', (event) => {
    event.preventDefault();
    startGame();
  });
  ui.standard.addEventListener('click', () => {
    chooseMode(ui.standard);
    resetGame(createStartingPieces(), standardDescription(), true);
  });
  ui.random.addEventListener('click', () => {
    chooseMode(ui.random);
    const randomPieces = createRandomPieces({
      boardKeys,
      count: 24,
      colors: players.map((player) => player.camp),
    });
    const description = [...randomPieces].map(([spotKey, piece]) => {
      const [q, r] = spotKey.split(',').map(Number);
      return `${piece.id}@${pointId(q, r)}`;
    }).join('、');
    resetGame(randomPieces, description, false, true, players[0].camp, false);
  });
  ui.victory.addEventListener('click', () => {
    chooseMode(ui.victory);
    const description = players.length === 2
      ? '移动 R-10 到 P-7-13，再结束回合即可验证双人结算。'
      : '依次移动 R-10 到 P-7-13、P-10 到 P-13-7，并分别结束回合，即可验证完整三人结算。';
    resetGame(createVictoryTestPieces(), description, true, true, 'red', false);
  });
  ui.restart.addEventListener('click', requestRestart);
  ui.rematch.addEventListener('click', requestRestart);
  ui.closeResults.addEventListener('click', closeResultsDialog);
  ui.resultsDialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeResultsDialog();
  });
  ui.resultsDialog.addEventListener('close', () => {
    stopFireworks();
    disarmRestart();
  });
  ui.gameDetailsToggle.addEventListener('click', () => {
    setGameDetailsOpen(ui.gameDetails.dataset.open !== 'true');
  });
  ui.seEnabled.addEventListener('change', () => {
    if (ui.seEnabled.checked) return;
    pieceMoveSound.pause();
    pieceMoveSound.currentTime = 0;
  });
  ui.inactiveWhiteMix.addEventListener('input', () => {
    const whiteMix = Math.min(85, Math.max(0, Number(ui.inactiveWhiteMix.value) || 0));
    root.style.setProperty('--inactive-piece-color-weight', `${100 - whiteMix}%`);
    ui.inactiveWhiteMixValue.value = `${whiteMix}%`;
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && ui.gameDetails.dataset.open === 'true') {
      setGameDetailsOpen(false);
      ui.gameDetailsToggle.focus();
    }
    const targetIsControl = event.target instanceof Element
      && event.target.closest('button, input, textarea, select, [contenteditable="true"]');
    if (
      event.key === 'Enter'
      && !event.repeat
      && !event.isComposing
      && !ui.game.hidden
      && !ui.end.disabled
      && !targetIsControl
    ) {
      event.preventDefault();
      finishTurn();
    }
  });
  ui.undo.addEventListener('click', openUndoDialog);
  ui.cancelUndo.addEventListener('click', (event) => {
    event.preventDefault();
    closeUndoDialog();
    ui.undo.focus();
  });
  ui.confirmUndo.addEventListener('click', (event) => {
    event.preventDefault();
    closeUndoDialog();
    undo();
  });
  ui.endButtons.forEach((button) => button.addEventListener('click', finishTurn));
  ui.exportRecord.addEventListener('click', exportMatchRecord);

  pieces = createStandardPieces();
  startingPieces = new Map(pieces);
  startingText = '每方 10 枚棋子，按棋盘逆时针方向轮换。';
  root.style.setProperty('--inactive-piece-color-weight', `${100 - Number(ui.inactiveWhiteMix.value)}%`);
  loadStartingColors().forEach((color, index) => {
    playerEntries[index].colorInput.value = color;
  });
  buildColorCards();
  buildProfileCards();
  renderScoreVault();
  playerEntries.forEach((entry, index) => setEntryKind(entry, index < 2 ? 'human' : 'empty'));
  ensureUniqueActiveColors();
  renderPieces();
  validateNames();
})();
