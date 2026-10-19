// physics.js
// Pure ball-movement and collision functions for the paddle ball game.
//
// These functions contain no rendering or global state. Both index.html and
// the property-based tests use them, so the game and the tests exercise the
// exact same logic (no drift).
//
// A "ball" is a plain object: { x, y, dx, dy }.
// A "config" is: { width, height, radius, paddleWidth, paddleHeight,
//                   leftPaddleY, rightPaddleY }.

(function (root, factory) {
  const api = factory();
  // Export for Node (tests) ...
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  // ... and expose on the global for the browser (index.html).
  if (root) {
    root.Physics = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  // Move the ball one step by adding its velocity to its position.
  // Returns a new ball object (does not mutate the input).
  function moveBall(ball) {
    return {
      x: ball.x + ball.dx,
      y: ball.y + ball.dy,
      dx: ball.dx,
      dy: ball.dy,
    };
  }

  // True when the ball (accounting for its radius) is touching or past the
  // top or bottom wall.
  function hitsWall(ball, config) {
    return (
      ball.y - config.radius <= 0 ||
      ball.y + config.radius >= config.height
    );
  }

  // Bounce off the top/bottom walls: reverse vertical direction when hitting a
  // wall. Returns a new ball. Requirement 2.2.
  function bounceWall(ball, config) {
    if (hitsWall(ball, config)) {
      return { x: ball.x, y: ball.y, dx: ball.dx, dy: -ball.dy };
    }
    return ball;
  }

  // True when the ball overlaps the left paddle (flush against the left edge).
  function hitsLeftPaddle(ball, config) {
    const overlapsX = ball.x - config.radius <= config.paddleWidth;
    const notPastLeft = ball.x + config.radius >= 0;
    const overlapsY =
      ball.y >= config.leftPaddleY &&
      ball.y <= config.leftPaddleY + config.paddleHeight;
    return overlapsX && notPastLeft && overlapsY;
  }

  // True when the ball overlaps the right paddle (flush against the right edge).
  function hitsRightPaddle(ball, config) {
    const overlapsX = ball.x + config.radius >= config.width - config.paddleWidth;
    const notPastRight = ball.x - config.radius <= config.width;
    const overlapsY =
      ball.y >= config.rightPaddleY &&
      ball.y <= config.rightPaddleY + config.paddleHeight;
    return overlapsX && notPastRight && overlapsY;
  }

  // True when the ball is touching either paddle.
  function hitsPaddle(ball, config) {
    return hitsLeftPaddle(ball, config) || hitsRightPaddle(ball, config);
  }

  // Bounce off a paddle: reverse horizontal direction when touching a paddle.
  // Returns a new ball. Requirement 2.1.
  function bouncePaddle(ball, config) {
    if (hitsPaddle(ball, config)) {
      return { x: ball.x, y: ball.y, dx: -ball.dx, dy: ball.dy };
    }
    return ball;
  }

  // True when the ball has gone off the left or right edge of the canvas.
  function isOffScreen(ball, config) {
    return ball.x < 0 || ball.x > config.width;
  }

  // Reset the ball to the center of the canvas. The caller supplies the new
  // direction (sign of dx/dy) so this stays pure/deterministic; the game picks
  // a random direction. Requirement 2.3.
  function centerBall(config, dx, dy) {
    return {
      x: config.width / 2,
      y: config.height / 2,
      dx: dx,
      dy: dy,
    };
  }

  // Clamp a paddle's top Y so the whole paddle stays within the canvas:
  // 0 <= y <= height - paddleHeight. Keeps the player paddle on screen.
  function clampPaddle(y, config) {
    const maxY = config.height - config.paddleHeight;
    if (y < 0) {
      return 0;
    }
    if (y > maxY) {
      return maxY;
    }
    return y;
  }

  // Determine who scored when the ball leaves the play area.
  //
  // The ball exits the LEFT edge (x < 0) when the computer (left paddle) failed
  // to return it, so the PLAYER (right side) scores -> returns 'right'.
  // The ball exits the RIGHT edge (x > width) when the player failed, so the
  // COMPUTER (left side) scores -> returns 'left'.
  // Returns null when the ball is still on screen (nobody scored).
  function scorerFromExit(ball, config) {
    if (ball.x < 0) {
      return 'right'; // player scores
    }
    if (ball.x > config.width) {
      return 'left'; // computer scores
    }
    return null;
  }

  // Game-over / win check. Returns the winner given the two scores and the
  // winning target, or null if nobody has won yet.
  //   'left'  -> computer wins
  //   'right' -> player wins
  // If both somehow reached the target, the higher score wins (ties favor the
  // left/computer only when exactly equal, which cannot happen in normal play
  // since the game stops as soon as one side reaches the target).
  function checkWinner(leftScore, rightScore, winningScore) {
    if (leftScore >= winningScore && leftScore >= rightScore) {
      return 'left';
    }
    if (rightScore >= winningScore && rightScore >= leftScore) {
      return 'right';
    }
    return null;
  }

  // Advance a single particle one step for the scoring burst effect.
  //
  // A "particle" is a plain object: { x, y, dx, dy, life } where `life` is the
  // remaining lifetime in frames. Each step moves the particle by its velocity
  // and decrements its life. Returns a new particle (does not mutate the input).
  // The caller removes particles whose life has reached 0 or below.
  function stepParticle(particle) {
    return {
      x: particle.x + particle.dx,
      y: particle.y + particle.dy,
      dx: particle.dx,
      dy: particle.dy,
      life: particle.life - 1,
    };
  }

  // True when a particle is still alive (should keep being drawn/stepped).
  function isParticleAlive(particle) {
    return particle.life > 0;
  }

  // Advance the computer-controlled (left) paddle one step toward the ball.
  //
  // The paddle tries to center itself on the ball's Y: the target top-Y is the
  // ball's Y minus half the paddle height. Rather than snapping, the paddle
  // moves a fraction `difficulty` (0-1) of the remaining distance each frame:
  //
  //   newY = currentY + (targetY - currentY) * difficulty
  //
  // difficulty = 0 -> never moves; difficulty = 1 -> snaps exactly onto target.
  // A value below 1 (e.g. 0.7) introduces smoothing/lag that makes the AI
  // beatable. The result is clamped so the paddle stays on screen.
  // Requirement 1.3.
  function aiPaddleStep(currentY, ballY, config, difficulty) {
    const targetY = ballY - config.paddleHeight / 2;
    const newY = currentY + (targetY - currentY) * difficulty;
    return clampPaddle(newY, config);
  }

  return {
    moveBall,
    hitsWall,
    bounceWall,
    hitsLeftPaddle,
    hitsRightPaddle,
    hitsPaddle,
    bouncePaddle,
    isOffScreen,
    centerBall,
    clampPaddle,
    aiPaddleStep,
    scorerFromExit,
    checkWinner,
    stepParticle,
    isParticleAlive,
  };
});
