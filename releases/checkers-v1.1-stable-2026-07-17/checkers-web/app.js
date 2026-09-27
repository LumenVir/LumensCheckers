(() => {
  'use strict';

  const {
    calculateLegalMoves,
    coordinateKey,
    createBoardKeys,
    createRandomPieces,
    createStandardPieces,
    createTargetCampKeys,
    hasPlayerWon,
    pointId,
  } = window.CheckersRules;

  const root = document.getElementById('checkers-app');
  const $ = (selector) => root.querySelector(selector);
  const svg = $('#board');
  const ui = {
    form: $('#player-form'),
    game: $('#game-layout'),
    setupHelp: $('#setup-help'),
    start: $('#start-game'),
    now: $('#now'),
    nowDot: $('#now-dot'),
    before: $('#before'),
    beforeDot: $('#before-dot'),
    after: $('#after'),
    afterDot: $('#after-dot'),
    note: $('#note'),
    status: $('#status'),
    list: $('#list'),
    ranking: $('#ranking'),
    debug: $('#debug-id'),
    detail: $('#debug-detail'),
    mode: $('#mode-help'),
    undo: $('#undo'),
    end: $('#end'),
    standard: $('#standard'),
    random: $('#random'),
    victory: $('#victory'),
    restart: $('#restart'),
  };

  const COUNTERCLOCKWISE_COLORS = ['red', 'purple', 'green'];
  const COLOR_META = {
    red: { color: 'red', colorName: '红色', value: 'var(--red)' },
    purple: { color: 'purple', colorName: '紫色', value: 'var(--purple)' },
    green: { color: 'green', colorName: '绿色', value: 'var(--green)' },
  };
  let players = COUNTERCLOCKWISE_COLORS.map((color) => ({ ...COLOR_META[color], name: '' }));
  const boardKeys = createBoardKeys();
  const cells = [];
  const groups = new Map();
  const targetCamps = Object.fromEntries(
    COUNTERCLOCKWISE_COLORS.map((color) => [color, createTargetCampKeys(color)]),
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
  let startingTurnColor = 'red';
  let restartArmed = false;
  let restartTimer = null;

  const now = () => players[turn];
  const playerLabel = (player) => `${player.name ? `${player.name} · ` : ''}${player.colorName}`;
  const boardPosition = (q, r) => ({ x: 320 + (q + r / 2) * 29, y: 290 + r * 25 });

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
      addCell(i, -4 - t, 'camp-red');
      addCell(4 + t, -i, 'target-purple');
      addCell(i, 4 + t - i, 'camp-green');
      addCell(-i, 4 + t, 'target-red');
      addCell(-4 - t, i, 'camp-purple');
      addCell(-4 - t + i, -i, 'target-green');
    }
  }

  function createVictoryTestPieces() {
    const next = createStandardPieces();
    for (const [pieceKey, piece] of next) {
      if (piece.color === 'red') next.delete(pieceKey);
    }

    let number = 1;
    for (const targetKey of targetCamps.red) {
      if (targetKey !== '-1,5') {
        next.set(targetKey, { color: 'red', id: `R-${String(number).padStart(2, '0')}` });
        number += 1;
      }
    }
    next.set('0,4', { color: 'red', id: 'R-10' });
    return next;
  }

  function hasWon(color) {
    return winEnabled && hasPlayerWon({ pieces, color });
  }

  function updateRanking() {
    ui.ranking.textContent = finished.length
      ? finished.map((color, index) => {
        const player = players.find((candidate) => candidate.color === color);
        return `${index + 1}. ${playerLabel(player)}`;
      }).join('　')
      : '尚未产生名次';
  }

  function nextActiveTurn() {
    for (let count = 0; count < players.length; count += 1) {
      turn = (turn + 1) % players.length;
      if (!finished.includes(now().color)) return;
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
    const previous = players[(turn + 2) % players.length];
    const next = players[(turn + 1) % players.length];

    ui.now.textContent = gameOver ? '本局结束' : `${playerLabel(current)}回合`;
    ui.nowDot.className = `dot ${current.color}`;
    ui.before.textContent = playerLabel(previous);
    ui.beforeDot.className = `dot ${previous.color}`;
    ui.after.textContent = playerLabel(next);
    ui.afterDot.className = `dot ${next.color}`;
    ui.note.textContent = gameOver
      ? '三方名次已经确定。'
      : lockedPieceId
        ? `${lockedPieceId} 可继续跳，或结束回合。`
        : committed
          ? '落子已完成，确认后请结束回合。'
          : `请${playerLabel(current)}选择棋子。`;

    root.dataset.activeColor = current.color;
    root.style.setProperty('--move', current.value);
    ui.end.disabled = gameOver || !committed || animating;
    ui.undo.disabled = gameOver || history.length === 0 || animating;
    ui.restart.disabled = animating;
    updateRanking();
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
      token.setAttribute('class', `piece ${piece.color}`);
      token.setAttribute('cx', group.dataset.x);
      token.setAttribute('cy', group.dataset.y);
      token.setAttribute('r', '8');
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
    ring.setAttribute('r', '9');
    group.appendChild(ring);

    const start = performance.now();
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 420;
    function draw(time) {
      const progress = Math.min(1, (time - start) / duration);
      ring.setAttribute('r', String(9 + progress * 13));
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
    const lift = reducedMotion ? 0 : Math.min(48, 18 + moveRule.distance * 8);
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

    await token.animate(keyframes, {
      duration,
      easing: moveRule.type === 'step' ? 'ease-out' : 'cubic-bezier(.22,.72,.25,1)',
      fill: 'forwards',
    }).finished.catch(() => {});

    window.clearTimeout(pivotTimer);
    pivot?.classList.remove('is-pivot');
    history.push({ pieces: new Map(pieces), lockedPieceId, committed });
    pieces.delete(selection.fromKey);
    pieces.set(destination, selection.piece);
    animating = false;
    committed = true;
    renderPieces();
    landingPulse(target);

    const [q, r] = destination.split(',').map(Number);
    if (moveRule.type === 'jump') {
      lockedPieceId = selection.piece.id;
      showLegalMoves(target, q, r, selection.piece, true);
      if (selected.legalMoves.size === 0) {
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
    if (history.length === 0 || animating) return;
    const previous = history.pop();
    pieces = new Map(previous.pieces);
    lockedPieceId = previous.lockedPieceId;
    committed = previous.committed;
    renderPieces();

    if (lockedPieceId) {
      const position = findPiecePosition(lockedPieceId);
      const [q, r] = position.split(',').map(Number);
      showLegalMoves(groups.get(position), q, r, pieces.get(position), true);
      ui.status.textContent = `${lockedPieceId} 已撤回上一跳，可继续跳。`;
    } else {
      ui.status.textContent = '已撤销最近一步';
      ui.list.textContent = '请选择棋子重新操作，或结束回合。';
      updateTurnUi();
    }
  }

  function handleSpotClick(spotKey, group, q, r) {
    if (animating || gameOver) return;
    const piece = pieces.get(spotKey);

    if (piece) {
      if (committed && !lockedPieceId) {
        ui.status.textContent = '本回合已落子';
        ui.list.textContent = '可以悔棋，或点击“结束回合”。';
      } else if (piece.color !== now().color) {
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

  for (const { q, r, cellClass } of cells) {
    const spotKey = coordinateKey(q, r);
    const position = boardPosition(q, r);
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const cell = document.createElementNS('http://www.w3.org/2000/svg', 'circle');

    group.setAttribute('class', 'spot');
    group.dataset.x = String(position.x);
    group.dataset.y = String(position.y);
    group.dataset.pointId = pointId(q, r);
    group.dataset.key = spotKey;
    cell.setAttribute('class', `cell${cellClass ? ` ${cellClass}` : ''}`);
    cell.setAttribute('cx', String(position.x));
    cell.setAttribute('cy', String(position.y));
    cell.setAttribute('r', '10');
    group.appendChild(cell);

    group.addEventListener('pointerenter', () => {
      const piece = pieces.get(spotKey);
      ui.debug.textContent = piece ? piece.id : pointId(q, r);
      ui.detail.textContent = piece
        ? `棋子 ${piece.id} 位于落点 ${pointId(q, r)}`
        : `空落点 ${pointId(q, r)}`;
    });
    group.addEventListener('pointerleave', () => {
      ui.debug.textContent = '移动到棋盘上查看';
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

  function disarmRestart() {
    restartArmed = false;
    window.clearTimeout(restartTimer);
    restartTimer = null;
    ui.restart.textContent = '重新开始';
  }

  function resetGame(nextPieces, description, canWin, rememberStart = true, startColor = players[0].color) {
    if (animating) return;
    if (rememberStart) {
      startingPieces = new Map(nextPieces);
      startingText = description;
      startingCanWin = canWin;
      startingTurnColor = startColor;
    }

    disarmRestart();
    turn = Math.max(0, players.findIndex((player) => player.color === startColor));
    lockedPieceId = null;
    committed = false;
    history = [];
    finished = [];
    gameOver = false;
    winEnabled = canWin;
    pieces = new Map(nextPieces);
    ui.mode.textContent = description;
    renderPieces();
    ui.status.textContent = `请${playerLabel(now())}选择棋子`;
    ui.list.textContent = '细描边表示可以到达。';
  }

  const playerEntries = [1, 2, 3].map((number) => ({
    nameInput: $(`#player-${number}-name`),
    colorSelect: $(`#player-${number}-color`),
    swatch: $(`#player-${number}-swatch`),
  }));

  function updateSetupSwatches() {
    playerEntries.forEach(({ colorSelect, swatch }) => {
      swatch.className = `player-swatch ${colorSelect.value}`;
    });
  }

  function validateNames() {
    updateSetupSwatches();
    const namesComplete = playerEntries.every(({ nameInput }) => nameInput.value.trim());
    const colors = playerEntries.map(({ colorSelect }) => colorSelect.value);
    const colorsUnique = new Set(colors).size === players.length;
    ui.start.disabled = !namesComplete || !colorsUnique;
    ui.setupHelp.textContent = !namesComplete
      ? '请填写三位玩家的昵称。'
      : !colorsUnique
        ? '每位玩家需要选择不同的棋子颜色。'
        : '昵称和颜色填写完成，可以开始。';
  }

  function startGame() {
    const assignments = playerEntries.map(({ nameInput, colorSelect }) => ({
      name: nameInput.value.trim(),
      color: colorSelect.value,
    }));
    if (assignments.some(({ name }) => !name) || new Set(assignments.map(({ color }) => color)).size !== 3) return;

    const starterColor = assignments[0].color;
    const starterIndex = COUNTERCLOCKWISE_COLORS.indexOf(starterColor);
    const orderedColors = COUNTERCLOCKWISE_COLORS.map((_, offset) => (
      COUNTERCLOCKWISE_COLORS[(starterIndex + offset) % COUNTERCLOCKWISE_COLORS.length]
    ));
    players = orderedColors.map((color) => ({
      ...COLOR_META[color],
      name: assignments.find((assignment) => assignment.color === color).name,
    }));
    ui.form.hidden = true;
    ui.game.hidden = false;
    chooseMode(ui.standard);
    resetGame(createStandardPieces(), '每方 10 枚棋子，按棋盘逆时针方向轮换。', true, starterColor);
  }

  function finishTurn() {
    if (animating || !committed || gameOver) return;
    const completedPlayer = now();
    const won = hasWon(completedPlayer.color);

    if (won && !finished.includes(completedPlayer.color)) finished.push(completedPlayer.color);
    if (finished.length === 2) {
      const lastPlayer = players.find((player) => !finished.includes(player.color));
      if (lastPlayer) finished.push(lastPlayer.color);
      gameOver = true;
    }

    lockedPieceId = null;
    committed = false;
    history = [];
    if (!gameOver) nextActiveTurn();
    renderPieces();

    if (gameOver) {
      ui.status.textContent = '本局结束';
      ui.list.textContent = '三方名次已经确定。';
    } else if (won) {
      ui.status.textContent = `${playerLabel(completedPlayer)}完成比赛，获得第${finished.indexOf(completedPlayer.color) + 1}名`;
      ui.list.textContent = `已自动跳过完成玩家，轮到${playerLabel(now())}。`;
    } else {
      ui.status.textContent = `${playerLabel(completedPlayer)}结束回合，轮到${playerLabel(now())}`;
      ui.list.textContent = `请${playerLabel(now())}选择棋子。`;
    }
  }

  playerEntries.forEach(({ nameInput, colorSelect }) => {
    nameInput.addEventListener('input', validateNames);
    colorSelect.addEventListener('change', validateNames);
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
    resetGame(createStandardPieces(), '每方 10 枚棋子，按棋盘逆时针方向轮换。', true);
  });
  ui.random.addEventListener('click', () => {
    chooseMode(ui.random);
    const randomPieces = createRandomPieces({ boardKeys, count: 5 });
    const description = [...randomPieces].map(([spotKey, piece]) => {
      const [q, r] = spotKey.split(',').map(Number);
      return `${piece.id}@${pointId(q, r)}`;
    }).join('、');
    resetGame(randomPieces, description, false);
  });
  ui.victory.addEventListener('click', () => {
    chooseMode(ui.victory);
    resetGame(createVictoryTestPieces(), '移动 R-10 到 P-7-13，再结束回合即可验证第一名。', true, 'red');
  });
  ui.restart.addEventListener('click', () => {
    if (animating) return;
    if (!restartArmed) {
      restartArmed = true;
      ui.restart.textContent = '确认重新开始';
      restartTimer = window.setTimeout(disarmRestart, 3000);
      return;
    }
    const nextPieces = new Map(startingPieces);
    const description = startingText;
    const canWin = startingCanWin;
    const startColor = startingTurnColor;
    disarmRestart();
    resetGame(nextPieces, description, canWin, false, startColor);
  });
  ui.undo.addEventListener('click', undo);
  ui.end.addEventListener('click', finishTurn);

  pieces = createStandardPieces();
  startingPieces = new Map(pieces);
  startingText = '每方 10 枚棋子，按棋盘逆时针方向轮换。';
  renderPieces();
  validateNames();
})();
