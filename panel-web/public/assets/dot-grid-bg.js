(function () {
  if (window.initDotGridBackground) return;

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function rgb(raw, fallback) {
    var s = String(raw || '').trim();
    if (!s) return fallback;
    return s;
  }

  window.initDotGridBackground = function initDotGridBackground(options) {
    var cfg = options || {};
    var container = document.getElementById(cfg.containerId || 'starfield');
    if (!container) return null;

    var canvas = container.querySelector('canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      container.appendChild(canvas);
    }
    var ctx = canvas.getContext('2d');
    if (!ctx) return null;

    var baseColor = rgb(cfg.baseColor, '90,120,158');
    var activeColor = rgb(cfg.activeColor, '64,211,255');
    var bgColor = rgb(cfg.bgColor, '5,10,22');
    var dotSize = Number(cfg.dotSize || 1.8);
    var gap = Number(cfg.gap || 24);
    var pulse = clamp(Number(cfg.pulse || 0.2), 0, 1);
    var mouseRadius = Number(cfg.mouseRadius || 180);
    var mouseStrength = clamp(Number(cfg.mouseStrength || 1), 0, 2);

    var dpr = 1;
    var width = 0;
    var height = 0;
    var points = [];
    var running = true;
    var raf = 0;
    var tick = Math.random() * 1000;
    var mouse = { x: -9999, y: -9999, active: false };

    function buildGrid() {
      points = [];
      var step = Math.max(12, Math.floor(gap * dpr));
      var size = Math.max(1, dotSize * dpr);
      var ox = (width % step) * 0.5;
      var oy = (height % step) * 0.5;
      for (var y = oy; y <= height; y += step) {
        for (var x = ox; x <= width; x += step) {
          points.push({
            x: x,
            y: y,
            r: size * (0.85 + Math.random() * 0.4),
            k: Math.random() * Math.PI * 2
          });
        }
      }
    }

    function resize() {
      var rect = container.getBoundingClientRect();
      dpr = clamp(window.devicePixelRatio || 1, 1, 2);
      width = Math.max(1, Math.floor(rect.width * dpr));
      height = Math.max(1, Math.floor(rect.height * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        buildGrid();
      }
    }

    function draw(now) {
      if (!running) return;
      tick = now * 0.001;

      ctx.fillStyle = 'rgb(' + bgColor + ')';
      ctx.fillRect(0, 0, width, height);

      var mouseX = mouse.x * dpr;
      var mouseY = mouse.y * dpr;
      var r2 = Math.pow(mouseRadius * dpr, 2);

      for (var i = 0; i < points.length; i += 1) {
        var p = points[i];
        var px = p.x;
        var py = p.y;

        var wave = Math.sin(tick * 1.7 + p.k) * pulse;
        var alpha = 0.28 + (wave + 1) * 0.16;
        var radius = p.r * (0.9 + (wave + 1) * 0.15);
        var glow = 0;

        if (mouse.active) {
          var dx = px - mouseX;
          var dy = py - mouseY;
          var dist2 = dx * dx + dy * dy;
          if (dist2 < r2) {
            var near = 1 - dist2 / r2;
            glow = near * mouseStrength;
            alpha += near * 0.58;
            radius += near * 1.2 * dpr;
          }
        }

        alpha = clamp(alpha, 0.08, 0.92);
        var c = glow > 0.03 ? activeColor : baseColor;
        ctx.fillStyle = 'rgba(' + c + ',' + alpha.toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = window.requestAnimationFrame(draw);
    }

    function onMove(ev) {
      mouse.x = ev.clientX;
      mouse.y = ev.clientY;
      mouse.active = true;
    }

    function onLeave() {
      mouse.active = false;
    }

    function onVisibility() {
      if (document.hidden) {
        running = false;
        if (raf) window.cancelAnimationFrame(raf);
        raf = 0;
        return;
      }
      if (!running) {
        running = true;
        raf = window.requestAnimationFrame(draw);
      }
    }

    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseleave', onLeave, { passive: true });
    document.addEventListener('visibilitychange', onVisibility, { passive: true });

    resize();
    raf = window.requestAnimationFrame(draw);

    return {
      destroy: function () {
        running = false;
        if (raf) window.cancelAnimationFrame(raf);
        window.removeEventListener('resize', resize);
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseleave', onLeave);
        document.removeEventListener('visibilitychange', onVisibility);
      }
    };
  };
})();
