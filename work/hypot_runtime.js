/* perf2: allocation-free Math.hypot. V8's builtin (Chrome, Edge, Node, Cloudflare Workers) copies its arguments into a fresh
   FixedDoubleArray on every call - the page calls Math.hypot from ~450 sites (bots, nav, motor, abilities, HUD), ~30 KB of
   garbage per frame in a 5v5 (80 -> 16 B per call: the boxed result is what is left). Two / three arguments run V8's own algorithm (ToNumber in order, Infinity before NaN, max
   scaling, Kahan sum) on locals: bit-identical results to V8's builtin (work/test_hypot.cjs), so a Safari / Firefox
   client now also matches the V8 server's motor math exactly. Other arities use the original. */
(function () { "use strict"; var M = Math, H = M.hypot; if (!H || H.__xHyp) return;
  function hypot(x, y, z) { var n = arguments.length; if (n !== 2 && n !== 3) return H.apply(M, arguments);
    x = +x; y = +y; var a = x < 0 ? -x : x, b = y < 0 ? -y : y, c = 0, nan = false, m = 0; if (x !== x) nan = true; else if (a > m) m = a; if (y !== y) nan = true; else if (b > m) m = b;
    if (n === 3) { z = +z; c = z < 0 ? -z : z; if (z !== z) nan = true; else if (c > m) m = c; }
    if (m === Infinity) return Infinity; if (nan) return NaN; if (m === 0) return 0;
    var s = 0, k = 0, q = a / m, u = q * q - k, p = s + u; k = (p - s) - u; s = p; q = b / m; u = q * q - k; p = s + u; k = (p - s) - u; s = p;
    if (n === 3) { q = c / m; u = q * q - k; p = s + u; k = (p - s) - u; s = p; }
    return M.sqrt(s) * m; }
  hypot.__xHyp = true; try { Object.defineProperty(M, "hypot", { value: hypot, writable: true, configurable: true, enumerable: false }); } catch (e) {} })();
