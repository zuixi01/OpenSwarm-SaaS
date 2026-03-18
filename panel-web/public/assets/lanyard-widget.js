(function () {
  if (window.initOpenSwarmLanyard) return;

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  window.initOpenSwarmLanyard = function initOpenSwarmLanyard(options) {
    var cfg = options || {};
    var root = document.getElementById(cfg.rootId || 'topLanyard');
    var pendulum = document.getElementById(cfg.pendulumId || 'topLanyardPendulum');
    var card = document.getElementById(cfg.cardId || 'topLanyardCard');
    if (!root || !pendulum || !card) return null;

    var angle = 0.24;
    var velocity = 0;
    var gravity = 22.0;
    var damping = 2.6;
    var lengthPx = 150;
    var dragging = false;
    var lastMoveTs = 0;
    var lastMoveAngle = 0;
    var dragOffset = { x: 0, y: 0 };
    var rafId = 0;
    var running = true;
    var lastTime = performance.now();

    function getPivot() {
      var rect = root.getBoundingClientRect();
      return {
        x: rect.left + rect.width * 0.5,
        y: rect.top + 16
      };
    }

    function applyPose() {
      pendulum.style.transform = 'translateX(-50%) rotate(' + angle.toFixed(5) + 'rad)';
      var counter = -angle * 0.42;
      card.style.transform = 'translateX(-50%) rotate(' + counter.toFixed(5) + 'rad)';
    }

    function pointerToAngle(clientX, clientY) {
      var pivot = getPivot();
      var dx = clientX - pivot.x - dragOffset.x;
      var dy = clientY - pivot.y - dragOffset.y;
      var a = Math.atan2(dx, Math.max(4, dy));
      return clamp(a, -1.15, 1.15);
    }

    function onPointerDown(ev) {
      dragging = true;
      card.classList.add('dragging');
      var rect = card.getBoundingClientRect();
      dragOffset.x = ev.clientX - (rect.left + rect.width * 0.5);
      dragOffset.y = ev.clientY - (rect.top + 24);
      lastMoveTs = performance.now();
      lastMoveAngle = angle;
      velocity = 0;
      try { card.setPointerCapture(ev.pointerId); } catch (_) {}
    }

    function onPointerMove(ev) {
      if (!dragging) return;
      var nextAngle = pointerToAngle(ev.clientX, ev.clientY);
      var now = performance.now();
      var dt = Math.max(0.001, (now - lastMoveTs) / 1000);
      velocity = (nextAngle - lastMoveAngle) / dt;
      lastMoveTs = now;
      lastMoveAngle = nextAngle;
      angle = nextAngle;
      applyPose();
    }

    function onPointerUp(ev) {
      if (!dragging) return;
      dragging = false;
      card.classList.remove('dragging');
      try { card.releasePointerCapture(ev.pointerId); } catch (_) {}
    }

    function tick(now) {
      if (!running) return;
      var dt = Math.min(0.033, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      if (!dragging) {
        var accel = -(gravity / Math.max(80, lengthPx)) * Math.sin(angle) - damping * velocity;
        accel += Math.sin(now * 0.0011) * 0.0021;
        velocity += accel * dt;
        angle += velocity * dt;

        if (Math.abs(velocity) < 0.0008 && Math.abs(angle) < 0.0008) {
          velocity = 0;
          angle = 0;
        }
        angle = clamp(angle, -1.2, 1.2);
        applyPose();
      }

      rafId = window.requestAnimationFrame(tick);
    }

    function handleVisibility() {
      if (document.hidden) {
        running = false;
        if (rafId) window.cancelAnimationFrame(rafId);
        rafId = 0;
        return;
      }
      if (!running) {
        running = true;
        lastTime = performance.now();
        rafId = window.requestAnimationFrame(tick);
      }
    }

    card.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    window.addEventListener('pointercancel', onPointerUp, { passive: true });
    document.addEventListener('visibilitychange', handleVisibility, { passive: true });

    applyPose();
    rafId = window.requestAnimationFrame(tick);

    return {
      destroy: function () {
        running = false;
        if (rafId) window.cancelAnimationFrame(rafId);
        card.removeEventListener('pointerdown', onPointerDown);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);
        document.removeEventListener('visibilitychange', handleVisibility);
      }
    };
  };
})();
