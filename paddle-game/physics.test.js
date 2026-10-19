// physics.test.js
// Property-based tests for the ball movement and collision logic.
// Uses Node's built-in test runner (node:test) + fast-check, 100 runs each.

const test = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');

const Physics = require('./physics');

// Canvas / game dimensions matching index.html.
const WIDTH = 600;
const HEIGHT = 300;
const RADIUS = 8;
const PADDLE_WIDTH = 10;
const PADDLE_HEIGHT = 80;

const NUM_RUNS = 100;

// Helper to build a config with given paddle Y positions.
function makeConfig(leftPaddleY, rightPaddleY) {
  return {
    width: WIDTH,
    height: HEIGHT,
    radius: RADIUS,
    paddleWidth: PADDLE_WIDTH,
    paddleHeight: PADDLE_HEIGHT,
    leftPaddleY,
    rightPaddleY,
  };
}

// --- Unit tests (specific examples / edge cases) ---

test('unit: ball at center with a left paddle it touches reverses dx', () => {
  const config = makeConfig(HEIGHT / 2 - PADDLE_HEIGHT / 2, HEIGHT / 2 - PADDLE_HEIGHT / 2);
  // Ball just touching the left paddle.
  const ball = { x: PADDLE_WIDTH + RADIUS, y: HEIGHT / 2, dx: -4, dy: 2 };
  const result = Physics.bouncePaddle(ball, config);
  assert.strictEqual(result.dx, 4, 'dx should be reversed');
  assert.strictEqual(result.dy, ball.dy, 'dy should be unchanged');
});

test('unit: ball touching the top wall reverses dy', () => {
  const config = makeConfig(0, 0);
  const ball = { x: WIDTH / 2, y: RADIUS, dx: 4, dy: -4 };
  const result = Physics.bounceWall(ball, config);
  assert.strictEqual(result.dy, 4, 'dy should be reversed');
  assert.strictEqual(result.dx, ball.dx, 'dx should be unchanged');
});

test('unit: ball touching the bottom wall reverses dy', () => {
  const config = makeConfig(0, 0);
  const ball = { x: WIDTH / 2, y: HEIGHT - RADIUS, dx: 4, dy: 4 };
  const result = Physics.bounceWall(ball, config);
  assert.strictEqual(result.dy, -4, 'dy should be reversed');
});

test('unit: ball off the left edge resets to center', () => {
  const config = makeConfig(0, 0);
  const ball = { x: -5, y: 123, dx: -4, dy: 2 };
  assert.strictEqual(Physics.isOffScreen(ball, config), true);
  const reset = Physics.centerBall(config, 4, 4);
  assert.strictEqual(reset.x, WIDTH / 2);
  assert.strictEqual(reset.y, HEIGHT / 2);
});

test('unit: ball in open space does not bounce', () => {
  const config = makeConfig(0, 0); // paddles only cover y 0..80
  const ball = { x: WIDTH / 2, y: HEIGHT / 2, dx: 4, dy: 4 };
  const afterPaddle = Physics.bouncePaddle(ball, config);
  const afterWall = Physics.bounceWall(ball, config);
  assert.strictEqual(afterPaddle.dx, 4, 'dx unchanged with no paddle contact');
  assert.strictEqual(afterWall.dy, 4, 'dy unchanged with no wall contact');
});

test('unit: clampPaddle keeps the paddle within the canvas bounds', () => {
  const config = makeConfig(0, 0);
  const maxY = HEIGHT - PADDLE_HEIGHT; // 300 - 80 = 220
  // Below the top edge -> clamped to 0.
  assert.strictEqual(Physics.clampPaddle(-20, config), 0);
  // Past the bottom edge -> clamped to maxY.
  assert.strictEqual(Physics.clampPaddle(500, config), maxY);
  // Within bounds -> unchanged.
  assert.strictEqual(Physics.clampPaddle(100, config), 100);
  // Exact edges -> unchanged.
  assert.strictEqual(Physics.clampPaddle(0, config), 0);
  assert.strictEqual(Physics.clampPaddle(maxY, config), maxY);
});

// --- Property-based tests ---

// Property 1: Ball bounces off paddles.
// For any ball hitting a paddle, the ball should reverse horizontal direction.
// **Feature: paddle-ball-game, Property 1: Ball bounces off paddles**
// **Validates: Requirements 2.1**
test('Property 1: Ball bounces off paddles', () => {
  const config = makeConfig(0, 0);
  fc.assert(
    fc.property(
      // Choose a paddle (left or right), a y within that paddle's span, and a dx.
      fc.boolean(), // true = left paddle, false = right paddle
      fc.integer({ min: 0, max: PADDLE_HEIGHT }), // offset within paddle span
      fc.integer({ min: 1, max: 6 }), // speed magnitude
      fc.boolean(), // dx sign
      fc.integer({ min: -6, max: 6 }), // dy
      (useLeft, yOffset, speed, dxPositive, dy) => {
        const paddleY = (HEIGHT - PADDLE_HEIGHT) / 2;
        const cfg = makeConfig(paddleY, paddleY);
        const y = paddleY + yOffset;
        const dx = dxPositive ? speed : -speed;
        // Place the ball exactly touching the chosen paddle.
        const x = useLeft
          ? PADDLE_WIDTH + RADIUS // flush against left paddle
          : WIDTH - PADDLE_WIDTH - RADIUS; // flush against right paddle
        const ball = { x, y, dx, dy };

        // Precondition: the ball actually touches a paddle.
        if (!Physics.hitsPaddle(ball, cfg)) {
          return true; // skip non-contact samples
        }
        const result = Physics.bouncePaddle(ball, cfg);
        return result.dx === -dx && result.dy === dy;
      }
    ),
    { numRuns: NUM_RUNS }
  );
});

// Property 2: Ball bounces off walls.
// For any ball hitting top or bottom wall, the ball should reverse vertical direction.
// **Feature: paddle-ball-game, Property 2: Ball bounces off walls**
// **Validates: Requirements 2.2**
test('Property 2: Ball bounces off walls', () => {
  const config = makeConfig(0, 0);
  fc.assert(
    fc.property(
      fc.boolean(), // true = top wall, false = bottom wall
      fc.integer({ min: 0, max: WIDTH }), // x anywhere horizontally
      fc.integer({ min: 1, max: 6 }), // speed magnitude
      fc.integer({ min: -6, max: 6 }), // dx
      fc.boolean(), // dy sign
      (useTop, x, speed, dx, dyPositive) => {
        const dy = dyPositive ? speed : -speed;
        // Place the ball exactly touching the chosen wall.
        const y = useTop ? RADIUS : HEIGHT - RADIUS;
        const ball = { x, y, dx, dy };

        // Precondition: the ball actually touches a wall.
        if (!Physics.hitsWall(ball, config)) {
          return true;
        }
        const result = Physics.bounceWall(ball, config);
        return result.dy === -dy && result.dx === dx;
      }
    ),
    { numRuns: NUM_RUNS }
  );
});

// Property 3: Ball resets when off screen.
// For any ball going off left or right edge, the ball should return to center.
// **Feature: paddle-ball-game, Property 3: Ball resets when off screen**
// **Validates: Requirements 2.3**
test('Property 3: Ball resets when off screen', () => {
  const config = makeConfig(0, 0);
  fc.assert(
    fc.property(
      fc.boolean(), // true = off left, false = off right
      fc.integer({ min: 1, max: 50 }), // how far past the edge
      fc.integer({ min: 0, max: HEIGHT }), // y
      fc.integer({ min: 1, max: 6 }), // new dx magnitude
      fc.integer({ min: 1, max: 6 }), // new dy magnitude
      (offLeft, past, y, newDx, newDy) => {
        const x = offLeft ? -past : WIDTH + past;
        const ball = { x, y, dx: offLeft ? -4 : 4, dy: 2 };

        // Precondition: the ball is off screen.
        if (!Physics.isOffScreen(ball, config)) {
          return true;
        }
        const reset = Physics.centerBall(config, newDx, newDy);
        return reset.x === WIDTH / 2 && reset.y === HEIGHT / 2;
      }
    ),
    { numRuns: NUM_RUNS }
  );
});

// --- AI paddle tests (Requirement 1.3) ---

test('unit: aiPaddleStep moves the paddle toward the ball', () => {
  const config = makeConfig(0, 0);
  // Ball well below the paddle: the paddle (currently at top) should move down.
  const startY = 0;
  const ballY = 250;
  const next = Physics.aiPaddleStep(startY, ballY, config, 0.7);
  assert.ok(next > startY, 'paddle should move down toward a lower ball');

  // Ball above the paddle: the paddle should move up.
  const startY2 = 200;
  const ballY2 = 10;
  const next2 = Physics.aiPaddleStep(startY2, ballY2, config, 0.7);
  assert.ok(next2 < startY2, 'paddle should move up toward a higher ball');
});

test('unit: aiPaddleStep with difficulty < 1 does not snap to the target', () => {
  const config = makeConfig(0, 0);
  const startY = 0;
  const ballY = 150;
  const targetY = ballY - PADDLE_HEIGHT / 2; // 110
  const next = Physics.aiPaddleStep(startY, ballY, config, 0.7);
  // It should move partway, not land exactly on the target.
  assert.ok(next > startY, 'paddle moved');
  assert.ok(next < targetY, 'paddle did not snap all the way to the target');
  // Specifically, it closes 70% of the gap: 0 + (110 - 0) * 0.7 = 77.
  assert.strictEqual(next, 77);
});

test('unit: aiPaddleStep with difficulty 1 centers exactly on the ball', () => {
  const config = makeConfig(0, 0);
  const ballY = 150;
  const next = Physics.aiPaddleStep(100, ballY, config, 1);
  assert.strictEqual(next, ballY - PADDLE_HEIGHT / 2, 'snaps to centered target');
});

test('unit: aiPaddleStep with difficulty 0 never moves', () => {
  const config = makeConfig(0, 0);
  const startY = 42;
  const next = Physics.aiPaddleStep(startY, 250, config, 0);
  assert.strictEqual(next, startY, 'paddle stays put with zero responsiveness');
});

test('unit: aiPaddleStep keeps the paddle within the canvas bounds', () => {
  const config = makeConfig(0, 0);
  const maxY = HEIGHT - PADDLE_HEIGHT; // 220
  // Ball at the very bottom pulls the paddle down; result must stay <= maxY.
  const low = Physics.aiPaddleStep(200, HEIGHT + 500, config, 1);
  assert.ok(low <= maxY && low >= 0, 'clamped to bottom bound');
  assert.strictEqual(low, maxY);
  // Ball far above pulls the paddle up; result must stay >= 0.
  const high = Physics.aiPaddleStep(50, -500, config, 1);
  assert.ok(high >= 0 && high <= maxY, 'clamped to top bound');
  assert.strictEqual(high, 0);
});

// --- Scoring / win / particle tests (customization: scoreboard + effects) ---

test('unit: scorerFromExit awards the player when the ball exits the left edge', () => {
  const config = makeConfig(0, 0);
  // Ball past the left edge -> computer (left) failed -> player (right) scores.
  assert.strictEqual(Physics.scorerFromExit({ x: -5, y: 100 }, config), 'right');
});

test('unit: scorerFromExit awards the computer when the ball exits the right edge', () => {
  const config = makeConfig(0, 0);
  // Ball past the right edge -> player failed -> computer (left) scores.
  assert.strictEqual(Physics.scorerFromExit({ x: WIDTH + 5, y: 100 }, config), 'left');
});

test('unit: scorerFromExit returns null when the ball is still on screen', () => {
  const config = makeConfig(0, 0);
  assert.strictEqual(Physics.scorerFromExit({ x: WIDTH / 2, y: 100 }, config), null);
});

test('unit: checkWinner returns null before anyone reaches the winning score', () => {
  assert.strictEqual(Physics.checkWinner(4, 3, 5), null);
  assert.strictEqual(Physics.checkWinner(0, 0, 5), null);
});

test('unit: checkWinner reports the player (right) once they reach the target', () => {
  assert.strictEqual(Physics.checkWinner(2, 5, 5), 'right');
});

test('unit: checkWinner reports the computer (left) once they reach the target', () => {
  assert.strictEqual(Physics.checkWinner(5, 1, 5), 'left');
});

test('unit: stepParticle moves by its velocity and decrements life', () => {
  const p = { x: 10, y: 20, dx: 2, dy: -3, life: 5 };
  const next = Physics.stepParticle(p);
  assert.strictEqual(next.x, 12);
  assert.strictEqual(next.y, 17);
  assert.strictEqual(next.dx, 2, 'dx unchanged');
  assert.strictEqual(next.dy, -3, 'dy unchanged');
  assert.strictEqual(next.life, 4, 'life decremented');
  // Original not mutated.
  assert.strictEqual(p.life, 5);
});

test('unit: isParticleAlive is true only while life remains', () => {
  assert.strictEqual(Physics.isParticleAlive({ life: 3 }), true);
  assert.strictEqual(Physics.isParticleAlive({ life: 1 }), true);
  assert.strictEqual(Physics.isParticleAlive({ life: 0 }), false);
  assert.strictEqual(Physics.isParticleAlive({ life: -2 }), false);
});
