// Mode scan : caméra en direct, détection de la feuille, prise automatique,
// recadrage + redressement (perspective) et filtre « scan » qui garde les couleurs.

const DETECT_W = 320; // largeur de l'image analysée pour trouver la feuille
const MAX_SIDE = 2400; // taille max de la page scannée
const AUTO_FRAMES = 7; // détections stables d'affilée avant la prise automatique (~1 s)

const store = {
  get(k, d) {
    try {
      const v = localStorage.getItem(k);
      return v == null ? d : JSON.parse(v);
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* ignoré */
    }
  },
};

// options.image : adresse d'une photo à utiliser à la place de la caméra (simulation)
export function openScanner(options = {}) {
  return new Promise((resolve) => new Scanner(resolve, options).start());
}

async function chargerImage(src) {
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("Photo illisible"));
    i.src = src;
  });
  const k = Math.min(1, 4000 / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas");
  c.width = Math.round(img.naturalWidth * k);
  c.height = Math.round(img.naturalHeight * k);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return c;
}

// ---------------------------------------------------------------------------
// Détection de la feuille : seuil d'Otsu, plus grande zone claire, coins extrêmes.
export function detectQuad(data, w, h) {
  const n = w * h;
  const gray = new Uint8Array(n);
  const hist = new Uint32Array(256);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    const v = (data[j] * 77 + data[j + 1] * 150 + data[j + 2] * 29) >> 8;
    gray[i] = v;
    hist[v]++;
  }
  // Seuil d'Otsu
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, best = 0, t = 127;
  for (let i = 0; i < 256; i++) {
    wB += hist[i];
    if (!wB) continue;
    const wF = n - wB;
    if (!wF) break;
    sumB += i * hist[i];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) {
      best = between;
      t = i;
    }
  }
  // Masque clair, puis érosion 3×3 pour couper les liaisons fines avec le décor
  const raw = new Uint8Array(n);
  for (let i = 0; i < n; i++) raw[i] = gray[i] > t ? 1 : 0;
  const mask = new Uint8Array(n);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      mask[i] = raw[i] & raw[i - 1] & raw[i + 1] & raw[i - w] & raw[i + w] & raw[i - w - 1] & raw[i - w + 1] & raw[i + w - 1] & raw[i + w + 1];
    }
  }
  // Plus grande composante connexe, en suivant ses points extrêmes
  const seen = new Uint8Array(n);
  const stack = new Int32Array(n);
  let bestComp = null;
  for (let s = 0; s < n; s++) {
    if (!mask[s] || seen[s]) continue;
    let top = 0, count = 0;
    stack[top++] = s;
    seen[s] = 1;
    const c = { count: 0, tl: [0, 0, Infinity], br: [0, 0, -Infinity], tr: [0, 0, -Infinity], bl: [0, 0, Infinity] };
    while (top) {
      const i = stack[--top];
      const x = i % w, y = (i - x) / w;
      count++;
      const sp = x + y, df = x - y;
      if (sp < c.tl[2]) c.tl = [x, y, sp];
      if (sp > c.br[2]) c.br = [x, y, sp];
      if (df > c.tr[2]) c.tr = [x, y, df];
      if (df < c.bl[2]) c.bl = [x, y, df];
      if (x > 0 && mask[i - 1] && !seen[i - 1]) { seen[i - 1] = 1; stack[top++] = i - 1; }
      if (x < w - 1 && mask[i + 1] && !seen[i + 1]) { seen[i + 1] = 1; stack[top++] = i + 1; }
      if (y > 0 && mask[i - w] && !seen[i - w]) { seen[i - w] = 1; stack[top++] = i - w; }
      if (y < h - 1 && mask[i + w] && !seen[i + w]) { seen[i + w] = 1; stack[top++] = i + w; }
    }
    c.count = count;
    if (!bestComp || count > bestComp.count) bestComp = c;
  }
  if (!bestComp || bestComp.count < n * 0.12) return null;
  let q = [bestComp.tl, bestComp.tr, bestComp.br, bestComp.bl].map(([x, y]) => ({ x, y }));
  // Compense l'érosion : on pousse chaque coin d'1,5 px vers l'extérieur
  const cx = (q[0].x + q[1].x + q[2].x + q[3].x) / 4, cy = (q[0].y + q[1].y + q[2].y + q[3].y) / 4;
  q = q.map((p) => {
    const dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy) || 1;
    return { x: clamp(p.x + (dx / d) * 1.5, 0, w - 1), y: clamp(p.y + (dy / d) * 1.5, 0, h - 1) };
  });
  const area = quadArea(q);
  if (!isConvex(q) || area < n * 0.12 || area > n * 0.985) return null;
  return q;
}

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function quadArea(q) {
  let s = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4];
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}
function isConvex(q) {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4], c = q[(i + 2) % 4];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < 1e-6) return false;
    const s = Math.sign(cross);
    if (sign && s !== sign) return false;
    sign = s;
  }
  return true;
}
function defaultQuad(w, h) {
  const mx = w * 0.06, my = h * 0.06;
  return [{ x: mx, y: my }, { x: w - mx, y: my }, { x: w - mx, y: h - my }, { x: mx, y: h - my }];
}

// ---------------------------------------------------------------------------
// Redressement : homographie (rectangle de sortie → quadrilatère source) + interpolation bilinéaire
function homography(from, to) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = from[i], { x: X, y: Y } = to[i];
    A.push([x, y, 1, 0, 0, 0, -x * X, -y * X]);
    b.push(X);
    A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y]);
    b.push(Y);
  }
  // Élimination de Gauss avec pivot partiel
  for (let c = 0; c < 8; c++) {
    let p = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    [b[c], b[p]] = [b[p], b[c]];
    for (let r = c + 1; r < 8; r++) {
      const f = A[r][c] / A[c][c];
      for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k];
      b[r] -= f * b[c];
    }
  }
  const hm = new Array(8);
  for (let r = 7; r >= 0; r--) {
    let s = b[r];
    for (let k = r + 1; k < 8; k++) s -= A[r][k] * hm[k];
    hm[r] = s / A[r][r];
  }
  return hm;
}

export function warp(src, quad) {
  let W = Math.max(dist(quad[0], quad[1]), dist(quad[3], quad[2]));
  let H = Math.max(dist(quad[0], quad[3]), dist(quad[1], quad[2]));
  const k = Math.min(1, MAX_SIDE / Math.max(W, H));
  W = Math.max(1, Math.round(W * k));
  H = Math.max(1, Math.round(H * k));
  const hm = homography([{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }], quad);
  const sw = src.width, sh = src.height;
  const sd = src.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, sw, sh).data;
  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const octx = out.getContext("2d");
  const img = octx.createImageData(W, H);
  const od = img.data;
  const [h0, h1, h2, h3, h4, h5, h6, h7] = hm;
  let o = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++, o += 4) {
      const d = h6 * x + h7 * y + 1;
      let sx = (h0 * x + h1 * y + h2) / d;
      let sy = (h3 * x + h4 * y + h5) / d;
      sx = clamp(sx, 0, sw - 1.001);
      sy = clamp(sy, 0, sh - 1.001);
      const x0 = sx | 0, y0 = sy | 0, fx = sx - x0, fy = sy - y0;
      const i00 = (y0 * sw + x0) * 4, i10 = i00 + 4, i01 = i00 + sw * 4, i11 = i01 + 4;
      for (let c = 0; c < 3; c++) {
        const top = sd[i00 + c] + (sd[i10 + c] - sd[i00 + c]) * fx;
        const bot = sd[i01 + c] + (sd[i11 + c] - sd[i01 + c]) * fx;
        od[o + c] = top + (bot - top) * fy;
      }
      od[o + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);
  return out;
}

// Filtre « scan » : égalise l'éclairage (ombres, reflets, teinte jaune) pour un papier blanc,
// sans toucher aux couleurs de l'encre.
export function enhance(canvas) {
  const W = canvas.width, H = canvas.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const sw = Math.max(8, Math.round(W / 24)), sh = Math.max(8, Math.round(H / 24));
  const small = document.createElement("canvas");
  small.width = sw;
  small.height = sh;
  const sctx = small.getContext("2d", { willReadFrequently: true });
  sctx.imageSmoothingQuality = "high";
  sctx.drawImage(canvas, 0, 0, sw, sh);
  // Dilatation (maximum local) : efface l'écriture pour ne garder que le fond du papier
  let s = sctx.getImageData(0, 0, sw, sh);
  for (let pass = 0; pass < 2; pass++) {
    const src = s.data, dst = new Uint8ClampedArray(src);
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const i = (y * sw + x) * 4;
        for (let c = 0; c < 3; c++) {
          let m = src[i + c];
          for (let dy = -1; dy <= 1; dy++) {
            const yy = y + dy;
            if (yy < 0 || yy >= sh) continue;
            for (let dx = -1; dx <= 1; dx++) {
              const xx = x + dx;
              if (xx < 0 || xx >= sw) continue;
              const v = src[(yy * sw + xx) * 4 + c];
              if (v > m) m = v;
            }
          }
          dst[i + c] = m;
        }
      }
    }
    s = new ImageData(dst, sw, sh);
  }
  sctx.putImageData(s, 0, 0);
  const bgCanvas = document.createElement("canvas");
  bgCanvas.width = W;
  bgCanvas.height = H;
  const bctx = bgCanvas.getContext("2d", { willReadFrequently: true });
  bctx.imageSmoothingQuality = "high";
  bctx.drawImage(small, 0, 0, W, H);
  const bg = bctx.getImageData(0, 0, W, H).data;
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const v = (d[i + c] * 255) / Math.max(bg[i + c], 40); // papier → ~255
      d[i + c] = ((v - 30) * 255) / 205; // un peu plus de contraste (noir plus noir)
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function rotate90(canvas) {
  const out = document.createElement("canvas");
  out.width = canvas.height;
  out.height = canvas.width;
  const ctx = out.getContext("2d");
  ctx.translate(out.width, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(canvas, 0, 0);
  return out;
}

function detectOnCanvas(canvas) {
  const w = DETECT_W, h = Math.max(1, Math.round((canvas.height / canvas.width) * DETECT_W));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(canvas, 0, 0, w, h);
  const q = detectQuad(ctx.getImageData(0, 0, w, h).data, w, h);
  const k = canvas.width / w;
  return q ? q.map((p) => ({ x: p.x * k, y: p.y * k })) : null;
}

const toBlob = (canvas) =>
  new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Image impossible à créer"))), "image/jpeg", 0.9));

// Rectangle affiché d'une image « contain » dans une boîte
function fit(boxW, boxH, w, h) {
  const s = Math.min(boxW / w, boxH / h);
  return { s, ox: (boxW - w * s) / 2, oy: (boxH - h * s) / 2 };
}

// ---------------------------------------------------------------------------
class Scanner {
  constructor(done, options = {}) {
    this.done = done;
    this.simulation = options.image || null;
    this.pages = [];
    this.auto = store.get("fp.scan.auto", true);
    this.history = [];
    this.cooldownUntil = 0;
    this.el = document.createElement("div");
    this.el.className = "scan no-print";
    this.el.setAttribute("role", "dialog");
    this.el.setAttribute("aria-label", "Scanner le planning");
    this.el.innerHTML = `
      <section class="scan-view" data-view="live">
        <div class="scan-top">
          <button type="button" class="scan-chip" data-act="auto"></button>
          <label class="scan-chip">Importer une photo<input type="file" accept="image/*" hidden data-act="import"></label>
        </div>
        <div class="scan-stage"><video playsinline muted autoplay></video><canvas class="scan-overlay"></canvas></div>
        <p class="scan-hint" data-hint>Placez toute la feuille dans l'écran, bien à plat</p>
        <div class="scan-bar">
          <button type="button" class="scan-txt" data-act="cancel">Annuler</button>
          <button type="button" class="scan-shutter" data-act="shoot" aria-label="Scanner maintenant"><span></span></button>
          <button type="button" class="scan-txt" data-act="finish" data-finish disabled>Terminé</button>
        </div>
      </section>
      <section class="scan-view" data-view="edit" hidden>
        <div class="scan-stage"><canvas class="edit-canvas"></canvas></div>
        <p class="scan-hint">Glissez les 4 coins sur les bords de la feuille</p>
        <div class="scan-bar">
          <button type="button" class="scan-txt" data-act="retake">Reprendre</button>
          <span></span>
          <button type="button" class="scan-txt strong" data-act="crop">Valider</button>
        </div>
      </section>
      <section class="scan-view" data-view="result" hidden>
        <div class="scan-stage"><canvas class="result-canvas"></canvas></div>
        <div class="scan-bar three">
          <button type="button" class="scan-txt" data-act="redo">Refaire</button>
          <button type="button" class="scan-txt" data-act="rotate">Pivoter ⟳</button>
          <button type="button" class="scan-txt" data-act="more">+ Page</button>
        </div>
        <div class="scan-bar single">
          <button type="button" class="scan-main" data-act="keep">Utiliser ce scan</button>
        </div>
      </section>`;
    this.video = this.el.querySelector("video");
    this.overlay = this.el.querySelector(".scan-overlay");
    this.editCanvas = this.el.querySelector(".edit-canvas");
    this.resultCanvas = this.el.querySelector(".result-canvas");
    this.el.addEventListener("click", (e) => this.onClick(e));
    this.el.querySelector('[data-act="import"]').addEventListener("change", (e) => this.onImport(e));
    this.setupEditDrag();
    this.onResize = () => this.redraw();
    window.addEventListener("resize", this.onResize);
  }

  async start() {
    document.body.appendChild(this.el);
    document.documentElement.classList.add("scan-open");
    this.updateAutoChip();
    if (this.simulation) {
      // Simulation : pas de caméra, on part directement de la photo de test
      try {
        this.simCanvas = await chargerImage(this.simulation);
        this.openEdit(this.simCanvas);
      } catch {
        this.show("live");
        this.hint("Photo de test introuvable.");
      }
      return;
    }
    this.show("live");
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 3840 }, height: { ideal: 2160 } },
      });
      this.video.srcObject = this.stream;
      await this.video.play().catch(() => {});
      this.loop();
    } catch {
      this.hint("Caméra non disponible : autorisez l'accès à la caméra, ou utilisez « Importer une photo ».");
      this.el.querySelector('[data-act="shoot"]').disabled = true;
    }
  }

  show(view) {
    this.view = view;
    for (const s of this.el.querySelectorAll(".scan-view")) s.hidden = s.dataset.view !== view;
    const finish = this.el.querySelector("[data-finish]");
    finish.disabled = this.pages.length === 0;
    finish.textContent = this.pages.length ? `Terminé (${this.pages.length})` : "Terminé";
    requestAnimationFrame(() => this.redraw());
  }

  hint(msg) {
    this.el.querySelector("[data-hint]").textContent = msg;
  }

  updateAutoChip() {
    this.el.querySelector('[data-act="auto"]').textContent = `Prise auto : ${this.auto ? "oui" : "non"}`;
  }

  // ----- Vue caméra -----
  loop() {
    if (this.closed) return;
    this.timer = setTimeout(() => this.loop(), 140);
    if (this.view !== "live" || this.video.readyState < 2 || !this.video.videoWidth) return;
    const vw = this.video.videoWidth, vh = this.video.videoHeight;
    const w = DETECT_W, h = Math.round((vh / vw) * DETECT_W);
    this.small ||= document.createElement("canvas");
    this.small.width = w;
    this.small.height = h;
    const ctx = this.small.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(this.video, 0, 0, w, h);
    const q = detectQuad(ctx.getImageData(0, 0, w, h).data, w, h);
    // Lissage pour un contour stable à l'écran
    if (q && this.liveQuad) this.liveQuad = q.map((p, i) => ({ x: this.liveQuad[i].x * 0.5 + p.x * 0.5, y: this.liveQuad[i].y * 0.5 + p.y * 0.5 }));
    else this.liveQuad = q;
    this.liveScale = vw / w;
    this.history.push(q);
    if (this.history.length > AUTO_FRAMES) this.history.shift();
    const stable =
      this.history.length === AUTO_FRAMES &&
      this.history.every((hq) => hq && hq.every((p, i) => Math.hypot(p.x - q[i].x, p.y - q[i].y) < w * 0.015));
    this.progress = q ? this.history.filter(Boolean).length / AUTO_FRAMES : 0;
    this.drawOverlay(!!q);
    if (q) this.hint(this.auto ? "Feuille trouvée, ne bougez plus…" : "Feuille trouvée : appuyez sur le bouton");
    else this.hint("Placez toute la feuille dans l'écran, bien à plat");
    if (this.auto && stable && Date.now() > this.cooldownUntil) this.shoot();
  }

  drawOverlay(found) {
    const c = this.overlay, box = c.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    c.width = box.width * dpr;
    c.height = box.height * dpr;
    const ctx = c.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, box.width, box.height);
    if (!found || !this.liveQuad || !this.video.videoWidth) return;
    const { s, ox, oy } = fit(box.width, box.height, this.video.videoWidth, this.video.videoHeight);
    const pts = this.liveQuad.map((p) => ({ x: ox + p.x * this.liveScale * s, y: oy + p.y * this.liveScale * s }));
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fillStyle = `rgba(46, 204, 113, ${0.12 + 0.25 * (this.auto ? this.progress : 0)})`;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#2ecc71";
    ctx.stroke();
  }

  shoot() {
    const vw = this.video.videoWidth, vh = this.video.videoHeight;
    if (!vw) return;
    const c = document.createElement("canvas");
    c.width = vw;
    c.height = vh;
    c.getContext("2d").drawImage(this.video, 0, 0, vw, vh);
    if (navigator.vibrate) navigator.vibrate(30);
    this.flash();
    this.openEdit(c);
  }

  flash() {
    const f = document.createElement("div");
    f.className = "scan-flash";
    this.el.appendChild(f);
    setTimeout(() => f.remove(), 250);
  }

  async onImport(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const url = URL.createObjectURL(file);
    try {
      this.openEdit(await chargerImage(url));
    } catch (err) {
      this.hint(err.message);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  // ----- Vue ajustement des coins -----
  openEdit(canvas) {
    this.capture = canvas;
    this.quad = detectOnCanvas(canvas) || defaultQuad(canvas.width, canvas.height);
    this.show("edit");
  }

  editGeom() {
    const box = this.editCanvas.parentElement.getBoundingClientRect();
    return { box, ...fit(box.width, box.height, this.capture.width, this.capture.height) };
  }

  drawEdit() {
    if (!this.capture) return;
    const c = this.editCanvas;
    const { box, s, ox, oy } = this.editGeom();
    const dpr = window.devicePixelRatio || 1;
    c.width = box.width * dpr;
    c.height = box.height * dpr;
    const ctx = c.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, box.width, box.height);
    ctx.drawImage(this.capture, ox, oy, this.capture.width * s, this.capture.height * s);
    const pts = this.quad.map((p) => ({ x: ox + p.x * s, y: oy + p.y * s }));
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fillStyle = "rgba(46, 204, 113, .15)";
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#2ecc71";
    ctx.stroke();
    for (const p of pts) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 13, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,.9)";
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    // Loupe pendant le déplacement d'un coin
    if (this.dragIndex != null) {
      const p = this.quad[this.dragIndex];
      const R = 56, Z = 2.5;
      const lx = p.x * s + ox < box.width / 2 ? box.width - R - 12 : R + 12;
      const ly = R + 12;
      ctx.save();
      ctx.beginPath();
      ctx.arc(lx, ly, R, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = "#000";
      ctx.fillRect(lx - R, ly - R, R * 2, R * 2);
      const src = R / (s * Z);
      ctx.drawImage(this.capture, p.x - src, p.y - src, src * 2, src * 2, lx - R, ly - R, R * 2, R * 2);
      ctx.restore();
      ctx.beginPath();
      ctx.arc(lx, ly, R, 0, Math.PI * 2);
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(lx - 8, ly);
      ctx.lineTo(lx + 8, ly);
      ctx.moveTo(lx, ly - 8);
      ctx.lineTo(lx, ly + 8);
      ctx.strokeStyle = "#2ecc71";
      ctx.stroke();
    }
  }

  setupEditDrag() {
    const c = this.editCanvas;
    c.style.touchAction = "none";
    const toImg = (e) => {
      const r = c.getBoundingClientRect();
      const { s, ox, oy } = this.editGeom();
      return { x: (e.clientX - r.left - ox) / s, y: (e.clientY - r.top - oy) / s, s };
    };
    c.addEventListener("pointerdown", (e) => {
      if (!this.capture) return;
      const p = toImg(e);
      let best = -1, bd = Infinity;
      this.quad.forEach((q, i) => {
        const d = Math.hypot(q.x - p.x, q.y - p.y) * p.s;
        if (d < bd) {
          bd = d;
          best = i;
        }
      });
      if (bd > 60) return;
      this.dragIndex = best;
      this.dragOffset = { x: this.quad[best].x - p.x, y: this.quad[best].y - p.y };
      c.setPointerCapture(e.pointerId);
      this.drawEdit();
    });
    c.addEventListener("pointermove", (e) => {
      if (this.dragIndex == null) return;
      const p = toImg(e);
      this.quad[this.dragIndex] = {
        x: clamp(p.x + this.dragOffset.x, 0, this.capture.width - 1),
        y: clamp(p.y + this.dragOffset.y, 0, this.capture.height - 1),
      };
      this.drawEdit();
    });
    const end = () => {
      this.dragIndex = null;
      this.drawEdit();
    };
    c.addEventListener("pointerup", end);
    c.addEventListener("pointercancel", end);
  }

  crop() {
    if (!isConvex(this.quad)) {
      this.quad = this.quad.slice().sort((a, b) => a.y - b.y);
      const [a, b, c, d] = this.quad;
      const top = [a, b].sort((p, q) => p.x - q.x), bot = [c, d].sort((p, q) => p.x - q.x);
      this.quad = [top[0], top[1], bot[1], bot[0]];
    }
    this.result = enhance(warp(this.capture, this.quad));
    this.show("result");
  }

  drawResult() {
    if (!this.result) return;
    const c = this.resultCanvas, box = c.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    c.width = box.width * dpr;
    c.height = box.height * dpr;
    const ctx = c.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const { s, ox, oy } = fit(box.width, box.height, this.result.width, this.result.height);
    ctx.drawImage(this.result, ox, oy, this.result.width * s, this.result.height * s);
  }

  redraw() {
    if (this.view === "edit") this.drawEdit();
    else if (this.view === "result") this.drawResult();
  }

  async keepResult() {
    const blob = await toBlob(this.result);
    const n = this.pages.length + 1;
    this.pages.push(new File([blob], `scan-planning-${n}.jpg`, { type: "image/jpeg" }));
    this.result = null;
    this.capture = null;
  }

  backToLive() {
    if (this.simulation) {
      this.openEdit(this.simCanvas);
      return;
    }
    this.history = [];
    this.liveQuad = null;
    this.cooldownUntil = Date.now() + 2500;
    this.show("live");
  }

  async onClick(e) {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (!act) return;
    switch (act) {
      case "auto":
        this.auto = !this.auto;
        store.set("fp.scan.auto", this.auto);
        this.updateAutoChip();
        break;
      case "shoot":
        this.shoot();
        break;
      case "cancel":
        this.close(false);
        break;
      case "finish":
        this.close(true);
        break;
      case "retake":
        if (this.simulation) {
          this.close(false);
          break;
        }
      // falls through
      case "redo":
        this.capture = this.result = null;
        this.backToLive();
        break;
      case "crop":
        this.crop();
        break;
      case "rotate":
        this.result = rotate90(this.result);
        this.drawResult();
        break;
      case "more":
        await this.keepResult();
        this.backToLive();
        break;
      case "keep":
        await this.keepResult();
        this.close(true);
        break;
    }
  }

  // finished = l'utilisateur a validé ses scans (et non « Annuler »)
  close(finished) {
    this.closed = true;
    clearTimeout(this.timer);
    window.removeEventListener("resize", this.onResize);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.el.remove();
    document.documentElement.classList.remove("scan-open");
    this.done({ pages: this.pages, finished });
  }
}
