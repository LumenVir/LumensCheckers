(function exposeCheckersRules(globalScope) {
  const DIRECTIONS = [
    [1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1],
  ];
  const CAMP_ORDER = ['red', 'upperLeft', 'purple', 'bottom', 'green', 'upperRight'];
  const CAMP_PREFIXES = {
    red: 'R',
    upperLeft: 'UL',
    purple: 'P',
    bottom: 'B',
    green: 'G',
    upperRight: 'UR',
  };
  const OPPOSITE_CAMP = {
    red: 'bottom',
    upperLeft: 'green',
    purple: 'upperRight',
    bottom: 'red',
    green: 'upperLeft',
    upperRight: 'purple',
  };
  const PLAYER_CAMP_LAYOUTS = {
    2: ['red', 'bottom'],
    3: ['red', 'purple', 'green'],
    4: ['upperLeft', 'purple', 'green', 'upperRight'],
    5: ['red', 'upperLeft', 'purple', 'green', 'upperRight'],
    6: CAMP_ORDER,
  };

  function createPlayerCampLayout(playerCount) {
    const layout = PLAYER_CAMP_LAYOUTS[playerCount];
    if (!layout) throw new Error(`Unsupported player count: ${playerCount}`);
    return [...layout];
  }

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

  function campCoordinate(camp, depth, index) {
    if (!CAMP_ORDER.includes(camp)) throw new Error(`Unknown player camp: ${camp}`);
    if (camp === 'red') return [index, -4 - depth];
    if (camp === 'upperRight') return [4 + depth, -index];
    if (camp === 'green') return [index, 4 + depth - index];
    if (camp === 'bottom') return [-index, 4 + depth];
    if (camp === 'purple') return [-4 - depth, index];
    return [-4 - depth + index, -index];
  }

  function createPiecesForCamps(camps) {
    const pieces = new Map();
    const uniqueCamps = [...new Set(camps)];
    if (uniqueCamps.length !== camps.length || uniqueCamps.some((camp) => !CAMP_ORDER.includes(camp))) {
      throw new Error('Player camps must be unique known camps.');
    }

    uniqueCamps.forEach((camp) => {
      let count = 0;
      for (let depth = 4; depth >= 1; depth -= 1) {
        for (let index = depth; index <= 4; index += 1) {
          count += 1;
          const [q, r] = campCoordinate(camp, depth, index);
          pieces.set(coordinateKey(q, r), {
            color: camp,
            id: `${CAMP_PREFIXES[camp]}-${String(count).padStart(2, '0')}`,
          });
        }
      }
    });
    return pieces;
  }

  function createStandardPieces() {
    return createPiecesForCamps(['red', 'green', 'purple']);
  }

  function createTwoPlayerPieces() {
    return createPiecesForCamps(['red', 'bottom']);
  }

  function createTargetCampKeys(color) {
    if (!CAMP_ORDER.includes(color)) {
      throw new Error(`Unknown player color: ${color}`);
    }
    return createCampKeys(OPPOSITE_CAMP[color]);
  }

  function createCampKeys(camp) {
    if (!CAMP_ORDER.includes(camp)) {
      throw new Error(`Unknown camp: ${camp}`);
    }
    const campKeys = new Set();
    for (let depth = 1; depth <= 4; depth += 1) {
      for (let index = depth; index <= 4; index += 1) {
        const [q, r] = campCoordinate(camp, depth, index);
        campKeys.add(coordinateKey(q, r));
      }
    }
    return campKeys;
  }

  function createTargetRewardMap(color) {
    if (!CAMP_ORDER.includes(color)) {
      throw new Error(`Unknown player color: ${color}`);
    }

    const rewards = new Map();
    const targetCamp = OPPOSITE_CAMP[color];
    for (let depth = 1; depth <= 4; depth += 1) {
      const rewardUnits = 2 ** depth;
      for (let index = depth; index <= 4; index += 1) {
        const [q, r] = campCoordinate(targetCamp, depth, index);
        rewards.set(coordinateKey(q, r), rewardUnits);
      }
    }
    return rewards;
  }

  function calculateJumpReward({ jumpNumber, distance, continuousRewardCapUnits = 5 }) {
    const continuousUnits = jumpNumber >= 2 && jumpNumber <= continuousRewardCapUnits + 1 ? 1 : 0;
    const longDistanceUnits = Math.max(0, distance - 1);
    return {
      continuousUnits,
      longDistanceUnits,
      totalUnits: continuousUnits + longDistanceUnits,
    };
  }

  function calculateComboReward({ freshJumpCount, comboStartsAt = 4 }) {
    return Math.max(0, freshJumpCount - comboStartsAt + 1);
  }

  function calculateTargetReward({ targetRewardMap, position, claimedKeys }) {
    if (!position || claimedKeys.has(position)) return 0;
    return targetRewardMap.get(position) || 0;
  }

  function isFreshTurnLanding({ visitedKeys, position }) {
    return Boolean(position) && !visitedKeys.has(position);
  }

  function formatCoinUnits(units, showSign = false) {
    const prefix = showSign && units > 0 ? '+' : '';
    return `${prefix}${(units / 10).toFixed(1)}`;
  }

  function roundTurnSeconds(elapsedMilliseconds) {
    return Math.max(1, Math.ceil(Math.max(0, elapsedMilliseconds) / 1000));
  }

  function formatClockSeconds(totalSeconds) {
    const seconds = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainder = seconds % 60;
    const clock = `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
    return hours ? `${hours}:${clock}` : clock;
  }

  function settleTurnReward({
    jumpUnits,
    targetUnits = 0,
    undoCount = 0,
    freeUndoCount = 1,
    undoFeeUnits = 5,
  }) {
    const chargedUndoCount = Math.max(0, undoCount - freeUndoCount);
    return jumpUnits + targetUnits - chargedUndoCount * undoFeeUnits;
  }

  function calculateRankReward(rank) {
    return [30, 20, 10][rank - 1] || 0;
  }

  function settleRankRewards({ rankedPlayerIds, earnedUnitsByPlayer }) {
    const totalUnitsByPlayer = new Map(earnedUnitsByPlayer);
    const rankRewardUnitsByPlayer = new Map();
    rankedPlayerIds.forEach((playerId, index) => {
      if (!playerId) return;
      const rewardUnits = calculateRankReward(index + 1);
      rankRewardUnitsByPlayer.set(playerId, rewardUnits);
      totalUnitsByPlayer.set(playerId, (totalUnitsByPlayer.get(playerId) || 0) + rewardUnits);
    });
    return { totalUnitsByPlayer, rankRewardUnitsByPlayer };
  }

  function applyCoinEarnings({ balanceUnits, earnedUnits }) {
    return Math.max(0, balanceUnits + earnedUnits);
  }

  function hasPlayerWon({ pieces, color, requiredPieces = 10 }) {
    const targetKeys = createTargetCampKeys(color);
    const playerPositions = [...pieces.entries()]
      .filter(([, piece]) => piece.color === color)
      .map(([pieceKey]) => pieceKey);

    return playerPositions.length === requiredPieces
      && playerPositions.every((pieceKey) => targetKeys.has(pieceKey));
  }

  function createRandomPieces({ boardKeys, count = 5, random = Math.random, colors = ['red', 'green', 'purple'] }) {
    const available = [...boardKeys];
    const pieces = new Map();

    for (let index = 0; index < count && available.length > 0; index += 1) {
      const chosenIndex = Math.floor(random() * available.length);
      const [chosenKey] = available.splice(chosenIndex, 1);
      pieces.set(chosenKey, {
        color: colors[index % colors.length],
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
          const landingKey = coordinateKey(q + dq * distance * 2, r + dr * distance * 2);
          if (clear && boardKeys.has(landingKey) && !pieces.has(landingKey)) {
            moves.set(landingKey, { type: 'jump', distance, pivotId: pivot.id });
          }
          break;
        }
        distance += 1;
      }
    }
    return moves;
  }

  function axialDistance(fromKey, toKey) {
    const [fromQ, fromR] = fromKey.split(',').map(Number);
    const [toQ, toR] = toKey.split(',').map(Number);
    const dq = fromQ - toQ;
    const dr = fromR - toR;
    return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
  }

  function createTargetDistanceMap(boardKeys, targetKeys) {
    return new Map([...boardKeys].map((position) => [
      position,
      Math.min(...[...targetKeys].map((target) => axialDistance(position, target))),
    ]));
  }

  function calculateTargetAssignmentDistance({ positions, targetKeys }) {
    const occupiedTargets = new Set(positions.filter((position) => targetKeys.has(position)));
    const remainingPositions = positions.filter((position) => !occupiedTargets.has(position));
    const targets = [...targetKeys].filter((target) => !occupiedTargets.has(target));
    if (remainingPositions.length === 0) return 0;
    if (remainingPositions.length > targets.length) return Number.POSITIVE_INFINITY;

    if (remainingPositions.length > 4) {
      const availableTargets = [...targets];
      return remainingPositions.reduce((total, position) => {
        let bestIndex = 0;
        let bestDistance = Number.POSITIVE_INFINITY;
        availableTargets.forEach((target, index) => {
          const distance = axialDistance(position, target);
          if (distance < bestDistance) {
            bestDistance = distance;
            bestIndex = index;
          }
        });
        availableTargets.splice(bestIndex, 1);
        return total + bestDistance;
      }, 0);
    }

    let costs = new Map([[0, 0]]);
    remainingPositions.forEach((position) => {
      const nextCosts = new Map();
      costs.forEach((cost, mask) => {
        targets.forEach((target, index) => {
          const bit = 1 << index;
          if (mask & bit) return;
          const nextMask = mask | bit;
          const nextCost = cost + axialDistance(position, target);
          if (nextCost < (nextCosts.get(nextMask) ?? Number.POSITIVE_INFINITY)) {
            nextCosts.set(nextMask, nextCost);
          }
        });
      });
      costs = nextCosts;
    });
    return Math.min(...costs.values());
  }

  function createSimpleComputerTeamContext({ ownPieces, targetKeys, targetDistanceMap }) {
    const distances = ownPieces.map(([position]) => targetDistanceMap.get(position));
    return {
      averageDistance: distances.reduce((sum, distance) => sum + distance, 0) / distances.length,
      maximumDistance: Math.max(...distances),
      targetPieceCount: ownPieces.filter(([position]) => targetKeys.has(position)).length,
      assignmentDistance: calculateTargetAssignmentDistance({
        positions: ownPieces.map(([position]) => position),
        targetKeys,
      }),
      ownPositions: ownPieces.map(([position, piece]) => [position, piece.id]),
    };
  }

  function scoreSimpleComputerRoute({
    route,
    targetKeys,
    targetRewardMap,
    targetDistanceMap,
    teamContext,
    recentPositions,
  }) {
    const startDistance = targetDistanceMap.get(route.from);
    const finishDistance = targetDistanceMap.get(route.to);
    const advancement = startDistance - finishDistance;
    const startedInTarget = targetKeys.has(route.from);
    const finishedInTarget = targetKeys.has(route.to);
    const enteredTargetBonus = !startedInTarget && finishedInTarget
      ? 180 + teamContext.targetPieceCount * 28
      : 0;
    const leftTargetPenalty = startedInTarget && !finishedInTarget ? 5000 : 0;
    const targetDepth = targetRewardMap.get(route.to) || 0;
    const jumpCount = route.moves.filter(({ rule }) => rule.type === 'jump').length;
    const travelDistance = route.moves.reduce((sum, { rule }) => (
      sum + (rule.type === 'jump' ? rule.distance * 2 : 1)
    ), 0);
    const laggingDistance = Math.max(0, startDistance - teamContext.averageDistance);
    const isRearmostPiece = startDistance === teamContext.maximumDistance;
    const completionPressure = teamContext.targetPieceCount;
    const nextPositions = teamContext.ownPositions.map(([position, pieceId]) => (
      pieceId === route.pieceId ? route.to : position
    ));
    const assignmentAdvancement = teamContext.assignmentDistance - calculateTargetAssignmentDistance({
      positions: nextPositions,
      targetKeys,
    });
    const recentPiecePositions = recentPositions?.get(route.pieceId) || [];
    const repetitionPenalty = recentPiecePositions.includes(route.to)
      ? 700 + completionPressure * 60
      : 0;
    const formationBonus = advancement > 0
      ? laggingDistance * (16 + completionPressure * 4)
        + (isRearmostPiece ? 24 + completionPressure * 3 : 0)
      : 0;

    return assignmentAdvancement * (120 + completionPressure * 28)
      + advancement * 35
      + enteredTargetBonus
      - leftTargetPenalty
      - repetitionPenalty
      + targetDepth * 4
      + jumpCount * 3
      + travelDistance
      + formationBonus;
  }

  function enumerateSimpleComputerRoutes({
    boardKeys,
    pieces,
    color,
    maxRoutes = 120,
    maxJumpDepth = 12,
    recentPositions = new Map(),
  }) {
    const targetKeys = createTargetCampKeys(color);
    const forbiddenOuterKeys = new Set(CAMP_ORDER
      .filter((camp) => camp !== color && camp !== OPPOSITE_CAMP[color])
      .flatMap((camp) => [...createCampKeys(camp)]));
    const targetRewardMap = createTargetRewardMap(color);
    const targetDistanceMap = createTargetDistanceMap(boardKeys, targetKeys);
    const ownPieces = [...pieces.entries()].filter(([, piece]) => piece.color === color);
    if (ownPieces.length === 0 || maxRoutes <= 0) return [];
    const teamContext = createSimpleComputerTeamContext({ ownPieces, targetKeys, targetDistanceMap });

    const routes = [];
    const perPieceLimit = Math.max(1, Math.floor(maxRoutes / ownPieces.length));
    const immediateScore = (from, destination, rule, piece) => scoreSimpleComputerRoute({
      targetKeys,
      targetRewardMap,
      targetDistanceMap,
      teamContext,
      recentPositions,
      route: {
        pieceId: piece.id,
        from,
        to: destination,
        moves: [{ destination, rule }],
      },
    });

    for (const [from, piece] of ownPieces) {
      if (routes.length >= maxRoutes) break;
      const [q, r] = from.split(',').map(Number);
      const initialMoves = [...calculateLegalMoves({ boardKeys, pieces, q, r })]
        .sort(([destinationA, ruleA], [destinationB, ruleB]) => (
          immediateScore(from, destinationB, ruleB, piece)
          - immediateScore(from, destinationA, ruleA, piece)
        ));
      const pieceRoutes = [];
      const jumpQueue = [];

      for (const [destination, rule] of initialMoves) {
        const nextPieces = new Map(pieces);
        nextPieces.delete(from);
        nextPieces.set(destination, piece);
        const route = {
          pieceId: piece.id,
          from,
          to: destination,
          moves: [{ destination, rule }],
        };
        if (rule.type === 'step') pieceRoutes.push(route);
        else {
          jumpQueue.push({
            pieces: nextPieces,
            route,
            visited: new Set([from, destination]),
          });
        }
      }

      while (jumpQueue.length && pieceRoutes.length < perPieceLimit) {
        const node = jumpQueue.shift();
        pieceRoutes.push(node.route);
        if (node.route.moves.length >= maxJumpDepth) continue;

        const [currentQ, currentR] = node.route.to.split(',').map(Number);
        const extensions = [...calculateLegalMoves({
          boardKeys,
          pieces: node.pieces,
          q: currentQ,
          r: currentR,
        })].filter(([destination, rule]) => rule.type === 'jump' && !node.visited.has(destination));

        for (const [destination, rule] of extensions) {
          const nextPieces = new Map(node.pieces);
          nextPieces.delete(node.route.to);
          nextPieces.set(destination, piece);
          jumpQueue.push({
            pieces: nextPieces,
            route: {
              pieceId: piece.id,
              from,
              to: destination,
              moves: [...node.route.moves, { destination, rule }],
            },
            visited: new Set([...node.visited, destination]),
          });
        }
      }

      const remaining = maxRoutes - routes.length;
      routes.push(...pieceRoutes.slice(0, Math.min(perPieceLimit, remaining)));
    }

    return routes
      .filter((route) => !forbiddenOuterKeys.has(route.to))
      .map((route) => ({
      ...route,
      score: scoreSimpleComputerRoute({
        route,
        targetKeys,
        targetRewardMap,
        targetDistanceMap,
        teamContext,
        recentPositions,
      }),
    }));
  }

  function chooseSimpleComputerRoute(options) {
    const { random = Math.random } = options;
    const routes = enumerateSimpleComputerRoutes(options);
    if (routes.length === 0) return null;
    const bestScore = Math.max(...routes.map(({ score }) => score));
    const bestRoutes = routes.filter(({ score }) => score === bestScore);
    return bestRoutes[Math.floor(random() * bestRoutes.length)];
  }

  const rules = {
    CAMP_ORDER,
    DIRECTIONS,
    OPPOSITE_CAMP,
    applyCoinEarnings,
    calculateComboReward,
    chooseSimpleComputerRoute,
    calculateTargetAssignmentDistance,
    calculateJumpReward,
    calculateLegalMoves,
    calculateRankReward,
    calculateTargetReward,
    createCampKeys,
    coordinateKey,
    createBoardKeys,
    createPlayerCampLayout,
    createPiecesForCamps,
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
    pointId,
    roundTurnSeconds,
    settleRankRewards,
    settleTurnReward,
  };

  globalScope.CheckersRules = rules;
  if (typeof module !== 'undefined' && module.exports) module.exports = rules;
}(typeof window !== 'undefined' ? window : globalThis));
