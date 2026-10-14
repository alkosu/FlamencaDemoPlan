/* Привязка плана к местности: пиксели сводного плана ↔ широта/долгота.
 * По контрольным точкам {x, y, lat, lon}: 2 точки — подобие (сдвиг, поворот, масштаб), 3 и больше — аффинное преобразование.
 * Широта/долгота сначала переводятся в локальные метры (равнопромежуточная проекция вокруг центра) —
 * на участке в несколько сотен метров это точнее сантиметра. Общий модуль для навигатора и редактора. */
window.FDPGeo = (() => {
  'use strict';
  const R_LAT = 110540, R_LON = 111320;
  const toLocal = (lat, lon, o) => [(lon - o[1]) * Math.cos(o[0] * Math.PI / 180) * R_LON, (lat - o[0]) * R_LAT];
  const fromLocal = (X, Y, o) => [o[0] + Y / R_LAT, o[1] + X / (Math.cos(o[0] * Math.PI / 180) * R_LON)];
  function solve(A, b) { // Гаусс с выбором ведущего элемента
    const n = b.length, M = A.map((r, i) => [...r, b[i]]);
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (Math.abs(M[p][c]) < 1e-12) return null;
      [M[c], M[p]] = [M[p], M[c]];
      for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
    }
    return M.map((r, i) => r[n] / r[i]);
  }
  function lsq(rows, ys) { // наименьшие квадраты: rows · w ≈ ys
    const n = rows[0].length, A = Array.from({ length: n }, () => new Array(n).fill(0)), b = new Array(n).fill(0);
    rows.forEach((r, k) => { for (let i = 0; i < n; i++) { b[i] += r[i] * ys[k]; for (let j = 0; j < n; j++) A[i][j] += r[i] * r[j]; } });
    return solve(A, b);
  }
  function model(src, dst, similarity) { // src, dst: [[u,v]] → функция (u,v) → [x,y]
    if (similarity) {
      const rows = [], ys = [];
      src.forEach(([u, v], i) => { rows.push([u, -v, 1, 0]); ys.push(dst[i][0]); rows.push([v, u, 0, 1]); ys.push(dst[i][1]); });
      const w = lsq(rows, ys); if (!w) return null;
      return (u, v) => [w[0] * u - w[1] * v + w[2], w[1] * u + w[0] * v + w[3]];
    }
    const rows = src.map(([u, v]) => [u, v, 1]);
    const ax = lsq(rows, dst.map(d => d[0])), ay = lsq(rows, dst.map(d => d[1])); if (!ax || !ay) return null;
    return (u, v) => [ax[0] * u + ax[1] * v + ax[2], ay[0] * u + ay[1] * v + ay[2]];
  }
  /** points: [{x, y, lat, lon}] (x, y — пиксели плана); mpp — метров на пиксель плана */
  function fit(points, mpp = 0.1) {
    const P = (points || []).filter(p => [p.x, p.y, p.lat, p.lon].every(v => typeof v === 'number' && isFinite(v)));
    if (P.length < 2) return null;
    const o = [P.reduce((s, p) => s + p.lat, 0) / P.length, P.reduce((s, p) => s + p.lon, 0) / P.length];
    const loc = P.map(p => toLocal(p.lat, p.lon, o)), px = P.map(p => [p.x, p.y]);
    const sim = P.length < 3;
    const fwd = model(loc, px, sim), inv = model(px, loc, sim);
    if (!fwd || !inv) return null;
    const residuals = P.map((p, i) => { const q = fwd(...loc[i]); return Math.hypot(q[0] - p.x, q[1] - p.y) * mpp; });
    const rms = Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / residuals.length);
    return {
      type: sim ? 'similarity' : 'affine', n: P.length, rms, residuals,
      toPx: (lat, lon) => fwd(...toLocal(lat, lon, o)),
      toLatLon: (x, y) => fromLocal(...inv(x, y), o)
    };
  }
  /** «38.0123, -0.6789» или «38°00'44"N 0°40'44"W» → [lat, lon] */
  function parse(text) {
    const s = String(text || '').trim();
    const dms = [...s.matchAll(/(\d+)[°º]\s*(\d+)?['′]?\s*([\d.]+)?["″]?\s*([NSEW])/gi)];
    if (dms.length === 2) {
      const v = dms.map(m => { let d = +m[1] + (+(m[2] || 0)) / 60 + (+(m[3] || 0)) / 3600; if (/[SW]/i.test(m[4])) d = -d; return [d, /[NS]/i.test(m[4])]; });
      const lat = v.find(x => x[1]), lon = v.find(x => !x[1]); if (lat && lon) return [lat[0], lon[0]];
    }
    const n = s.match(/-?\d+(?:[.,]\d+)?/g); if (!n || n.length < 2) return null;
    const a = parseFloat(n[0].replace(',', '.')), b = parseFloat(n[1].replace(',', '.'));
    if (Math.abs(a) > 90 || Math.abs(b) > 180) return null;
    return [a, b];
  }
  return { fit, parse };
})();
