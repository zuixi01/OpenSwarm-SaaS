(function () {
  if (window.initFaultyTerminalBackground) return;

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function hexToRgb(hex) {
    var raw = String(hex || '').trim().replace('#', '');
    if (raw.length === 3) raw = raw.split('').map(function (c) { return c + c; }).join('');
    if (raw.length !== 6) return { r: 255, g: 255, b: 255 };
    var n = parseInt(raw, 16);
    if (!Number.isFinite(n)) return { r: 255, g: 255, b: 255 };
    return {
      r: (n >> 16) & 255,
      g: (n >> 8) & 255,
      b: n & 255,
    };
  }

  function pick(pool) {
    return pool[(Math.random() * pool.length) | 0];
  }

  window.initFaultyTerminalBackground = function initFaultyTerminalBackground(options) {
    var cfg = options || {};
    var containerId = cfg.containerId || 'starfield';
    var container = document.getElementById(containerId);
    if (!container) return null;

    var canvas = container.querySelector('canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      container.appendChild(canvas);
    }
    var ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return null;

    var tint = hexToRgb(cfg.tint || '#ffffff');
    var scale = Number(cfg.scale || 1);
    var digitSize = Number(cfg.digitSize || 1.5);
    var scanlineIntensity = Number(cfg.scanlineIntensity || 0.3);
    var glitchAmount = Number(cfg.glitchAmount || 1);
    var flickerAmount = Number(cfg.flickerAmount || 1);
    var noiseAmp = Number(cfg.noiseAmp || 0);
    var curvature = Number(cfg.curvature || 0.2);
    var brightness = Number(cfg.brightness || 1);
    var mouseReact = !!cfg.mouseReact;
    var mouseStrength = Number(cfg.mouseStrength || 0.2);

    var chars = '01<>[]{}+-=*/#@%&$?;:|'.split('');
    var dpr = 1;
    var cols = 0;
    var rows = 0;
    var cellW = 0;
    var cellH = 0;
    var cells = [];
    var running = true;
    var mouse = { x: -1, y: -1 };
    var flickerTick = Math.random() * Math.PI * 2;

    function resetCells() {
      cells = new Array(cols * rows);
      for (var i = 0; i < cells.length; i += 1) {
        cells[i] = {
          ch: pick(chars),
          lum: Math.random() * 0.55 + 0.2,
          jitter: Math.random() * 0.25,
        };
      }
    }

    function resize() {
      var rect = container.getBoundingClientRect();
      dpr = clamp(window.devicePixelRatio || 1, 1, 2);
      var w = Math.max(1, Math.floor(rect.width * dpr));
      var h = Math.max(1, Math.floor(rect.height * dpr));
      if (canvas.width === w && canvas.height === h) return;

      canvas.width = w;
      canvas.height = h;
      cellH = Math.max(12, Math.floor(11 * digitSize * scale * dpr));
      cellW = Math.max(8, Math.floor(8 * digitSize * scale * dpr));
      cols = Math.max(24, Math.floor(w / cellW));
      rows = Math.max(12, Math.floor(h / cellH));
      ctx.textBaseline = 'top';
      ctx.font = Math.max(10, Math.floor(cellH * 0.86)) + 'px "JetBrains Mono", monospace';
      resetCells();
    }

    function mutateCells() {
      var m = Math.max(16, Math.floor(cells.length * 0.045 * clamp(glitchAmount, 0.05, 2)));
      for (var i = 0; i < m; i += 1) {
        var idx = (Math.random() * cells.length) | 0;
        var c = cells[idx];
        c.ch = pick(chars);
        c.lum = Math.random() * 0.7 + 0.2;
      }
    }

    function drawCell(col, row, cell) {
      var x = col * cellW;
      var y = row * cellH;
      var lum = cell.lum * brightness;

      if (mouseReact && mouse.x >= 0) {
        var cx = x + cellW * 0.5;
        var cy = y + cellH * 0.5;
        var dx = (cx - mouse.x) / canvas.width;
        var dy = (cy - mouse.y) / canvas.height;
        var dist = Math.sqrt(dx * dx + dy * dy);
        lum += Math.max(0, (0.24 - dist)) * (0.55 * mouseStrength * 8);
      }

      lum = clamp(lum, 0, 1);
      var a = 0.16 + lum * 0.7;
      ctx.fillStyle = 'rgba(' + tint.r + ',' + tint.g + ',' + tint.b + ',' + a.toFixed(3) + ')';
      ctx.fillText(cell.ch, x + cell.jitter * 2, y);
    }

    function drawScanlines() {
      if (scanlineIntensity <= 0) return;
      var alpha = clamp(scanlineIntensity, 0, 1) * 0.15;
      ctx.fillStyle = 'rgba(0,0,0,' + alpha.toFixed(3) + ')';
      for (var y = 0; y < canvas.height; y += 3) {
        ctx.fillRect(0, y, canvas.width, 1);
      }
    }

    function drawGlitchSlices() {
      if (glitchAmount <= 0) return;
      if (Math.random() > 0.08 * clamp(glitchAmount, 0, 2)) return;
      var bandH = Math.max(8, Math.floor(canvas.height * (Math.random() * 0.02 + 0.01)));
      var srcY = Math.floor(Math.random() * (canvas.height - bandH));
      var shift = Math.floor((Math.random() - 0.5) * canvas.width * 0.08 * clamp(glitchAmount, 0, 2));
      ctx.drawImage(canvas, 0, srcY, canvas.width, bandH, shift, srcY, canvas.width, bandH);
    }

    function drawVignette() {
      if (curvature <= 0) return;
      var g = ctx.createRadialGradient(
        canvas.width * 0.5,
        canvas.height * 0.5,
        canvas.width * 0.08,
        canvas.width * 0.5,
        canvas.height * 0.5,
        canvas.width * 0.72
      );
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,' + clamp(curvature, 0, 1).toFixed(3) + ')');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    function frame() {
      if (!running) return;
      flickerTick += 0.018;
      var flicker = 1 - (Math.sin(flickerTick) * 0.04 + Math.random() * 0.035) * clamp(flickerAmount, 0, 2);
      var bg = Math.max(0, Math.floor(6 * flicker));
      ctx.fillStyle = 'rgb(' + bg + ',' + bg + ',' + Math.max(10, bg + 6) + ')';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      mutateCells();
      for (var r = 0; r < rows; r += 1) {
        for (var c = 0; c < cols; c += 1) {
          drawCell(c, r, cells[r * cols + c]);
        }
      }

      if (noiseAmp > 0) {
        var nAlpha = clamp(noiseAmp, 0, 1) * 0.035;
        ctx.fillStyle = 'rgba(255,255,255,' + nAlpha.toFixed(4) + ')';
        for (var i = 0; i < 120; i += 1) {
          ctx.fillRect((Math.random() * canvas.width) | 0, (Math.random() * canvas.height) | 0, 1, 1);
        }
      }

      drawScanlines();
      drawGlitchSlices();
      drawVignette();
      window.requestAnimationFrame(frame);
    }

    function onMouseMove(ev) {
      var rect = canvas.getBoundingClientRect();
      mouse.x = (ev.clientX - rect.left) * dpr;
      mouse.y = (ev.clientY - rect.top) * dpr;
    }

    function onMouseLeave() {
      mouse.x = -1;
      mouse.y = -1;
    }

    function onVisibility() {
      if (document.hidden) {
        running = false;
      } else {
        if (!running) {
          running = true;
          window.requestAnimationFrame(frame);
        }
      }
    }

    window.addEventListener('resize', resize, { passive: true });
    canvas.addEventListener('mousemove', onMouseMove, { passive: true });
    canvas.addEventListener('mouseleave', onMouseLeave, { passive: true });
    document.addEventListener('visibilitychange', onVisibility, { passive: true });

    resize();
    window.requestAnimationFrame(frame);
    return {
      destroy: function () {
        running = false;
        window.removeEventListener('resize', resize);
        canvas.removeEventListener('mousemove', onMouseMove);
        canvas.removeEventListener('mouseleave', onMouseLeave);
        document.removeEventListener('visibilitychange', onVisibility);
      }
    };
  };
})();
