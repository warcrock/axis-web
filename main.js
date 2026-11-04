// Axis: el diagrama del hero procesa pedidos en vivo, la terminal arma la herramienta con el nombre del negocio
// y el pipeline se enciende con el scroll. Todo el movimiento depende de data-motion en <html>.
const root = document.documentElement;
const motion = () => root.dataset.motion === 'on';

// Botón de animación: arranca con la preferencia del sistema y recuerda lo que elija el visitante
const toggle = document.querySelector('.motion');
const syncToggle = () => toggle.setAttribute('aria-pressed', motion());
syncToggle();
toggle.addEventListener('click', () => {
  root.dataset.motion = motion() ? 'off' : 'on';
  try { localStorage.setItem('axis-motion', root.dataset.motion); } catch (e) {}
  syncToggle();
  graph.restart();
  auto.reiniciar();
  rail();
});

// Decodificado: los textos mono se "descifran" de izquierda a derecha, una sola vez
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/<>#%&*+=';
function scramble(el) {
  if (!motion() || el.dataset.done) return;
  el.dataset.done = '1';
  const nodes = [];
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  while (walk.nextNode()) nodes.push({ n: walk.currentNode, txt: walk.currentNode.textContent });
  const total = nodes.reduce((s, x) => s + x.txt.length, 0);
  el.setAttribute('aria-label', el.textContent.trim());
  const dur = Math.min(1100, 300 + total * 22);
  const t0 = performance.now();
  const frame = (now) => {
    const k = Math.min(1, (now - t0) / dur);
    let i = 0;
    for (const x of nodes) {
      x.n.textContent = [...x.txt].map((c) => {
        const pos = i++ / total;
        return c === ' ' || pos < k ? c : CHARS[(Math.random() * CHARS.length) | 0];
      }).join('');
    }
    if (k < 1) requestAnimationFrame(frame);
    else el.removeAttribute('aria-label');
  };
  requestAnimationFrame(frame);
}

// Entradas: cada bloque entra una vez; los kickers se descifran al aparecer
const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    e.target.classList.add('is-in');
    if (e.target.hasAttribute('data-scramble')) scramble(e.target);
    io.unobserve(e.target);
  }
}, { rootMargin: '0px 0px -12% 0px' });
document.querySelectorAll('[data-reveal], .kicker[data-scramble]').forEach((el) => io.observe(el));
scramble(document.querySelector('.hero h1'));

// Diagrama del hero: lo que entra (consultas, PDFs, planillas) pasa por el núcleo y sale resuelto
const graph = (() => {
  const box = document.querySelector('.graph');
  const cv = box.querySelector('canvas');
  const ctx = cv.getContext('2d');
  const ins = [...box.querySelectorAll('[data-in]')];
  const outs = [...box.querySelectorAll('[data-out]')];
  const core = box.querySelector('[data-core]');
  const vertical = matchMedia('(max-width: 720px)');
  let W = 0, H = 0, inPaths = [], outPaths = [], packets = [], raf = 0, last = 0, spawn = 0, visible = true;

  const rel = (el) => {
    const b = box.getBoundingClientRect(), r = el.getBoundingClientRect();
    return { l: r.left - b.left, t: r.top - b.top, r: r.right - b.left, b: r.bottom - b.top, cx: r.left - b.left + r.width / 2, cy: r.top - b.top + r.height / 2 };
  };
  const curve = (a, z) => vertical.matches
    ? [a, { x: a.x, y: (a.y + z.y) / 2 }, { x: z.x, y: (a.y + z.y) / 2 }, z]
    : [a, { x: (a.x + z.x) / 2, y: a.y }, { x: (a.x + z.x) / 2, y: z.y }, z];
  const at = (p, t) => {
    const u = 1 - t;
    return {
      x: u * u * u * p[0].x + 3 * u * u * t * p[1].x + 3 * u * t * t * p[2].x + t * t * t * p[3].x,
      y: u * u * u * p[0].y + 3 * u * u * t * p[1].y + 3 * u * t * t * p[2].y + t * t * t * p[3].y,
    };
  };

  function layout() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    W = box.clientWidth; H = box.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const c = rel(core), mid = { x: c.cx, y: c.cy };
    inPaths = ins.map((el) => { const r = rel(el); return curve(vertical.matches ? { x: r.cx, y: r.b } : { x: r.r, y: r.cy }, mid); });
    outPaths = outs.map((el) => { const r = rel(el); return curve(mid, vertical.matches ? { x: r.cx, y: r.t } : { x: r.l, y: r.cy }); });
  }

  function stroke(p, color, dash) {
    ctx.beginPath(); ctx.setLineDash(dash); ctx.strokeStyle = color; ctx.lineWidth = 1;
    ctx.moveTo(p[0].x, p[0].y); ctx.bezierCurveTo(p[1].x, p[1].y, p[2].x, p[2].y, p[3].x, p[3].y); ctx.stroke();
  }
  function dot(p, t, color, glow) {
    for (let k = 6; k >= 0; k--) {
      const q = at(p, Math.max(0, t - k * 0.018));
      ctx.globalAlpha = k ? (1 - k / 7) * 0.35 : 1;
      ctx.beginPath(); ctx.arc(q.x, q.y, k ? 1.6 : 2.6, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = k ? 0 : glow; ctx.fill();
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    inPaths.forEach((p) => stroke(p, 'rgba(255,255,255,.24)', [3, 5]));
    outPaths.forEach((p) => stroke(p, 'rgba(180,255,77,.35)', []));
    ctx.setLineDash([]);
    for (const k of packets) dot(k.out ? outPaths[k.i] : inPaths[k.i], k.t, k.out ? '#B4FF4D' : '#FF8E8E', k.out ? 14 : 6);
  }

  function tick(now) {
    const dt = Math.min(50, now - (last || now)); last = now;
    spawn -= dt;
    if (spawn <= 0) { packets.push({ i: (Math.random() * inPaths.length) | 0, t: 0, out: false }); spawn = 520 + Math.random() * 420; }
    for (const k of packets) k.t += dt / (k.out ? 1300 : 1500);
    for (const k of packets.filter((k) => k.t >= 1)) {
      if (!k.out) packets.push({ i: (Math.random() * outPaths.length) | 0, t: 0, out: true });
      else { const card = outs[k.i]; card.classList.add('hit'); setTimeout(() => card.classList.remove('hit'), 500); }
    }
    packets = packets.filter((k) => k.t < 1);
    draw();
    raf = requestAnimationFrame(tick);
  }

  function restart() {
    cancelAnimationFrame(raf); raf = 0; last = 0;
    layout();
    if (motion() && visible && !document.hidden) { raf = requestAnimationFrame(tick); return; }
    // Quieto: un paquete en cada línea, para que el diagrama se lea igual sin movimiento
    packets = [...inPaths.map((_, i) => ({ i, t: 0.45 + i * 0.08, out: false })), ...outPaths.map((_, i) => ({ i, t: 0.55, out: true }))];
    draw();
  }

  new ResizeObserver(restart).observe(box);
  vertical.addEventListener('change', restart);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; restart(); }).observe(box);
  document.addEventListener('visibilitychange', restart);
  document.fonts?.ready.then(restart);
  return { restart };
})();

// Probala: el rubro cambia la app y el log; el nombre y el color de marca aparecen en todo,
// y cada toque en el celular arma el mensaje que le llega al dueño
const LOGS = {
  lista: { lines: ['módulo: lista de precios online', 'precios: se cargan desde tu planilla', 'pedidos → tu WhatsApp, ya armados'], ruta: '/precios', sub: 'Lista de precios · hoy' },
  cotizador: { lines: ['módulo: cotizador de envíos', 'tarifas: por kilo, bulto y destino', 'cotización → WhatsApp del cliente'], ruta: '/cotizar', sub: 'Cotizá tu envío' },
  turnos: { lines: ['módulo: turnos online', 'servicios y horarios: los tuyos', 'confirmación → tu WhatsApp'], ruta: '/turnos', sub: 'Reservá tu turno' },
  web: { lines: ['módulo: web nueva', 'certificado: activo (https)', 'botón → tu número de ventas'], ruta: '', sub: 'Tu web nueva' },
};
const input = document.getElementById('nombre');
const pedir = document.getElementById('pedir');
const log = document.querySelector('.log');
const show = document.querySelector('.showroom');
const send = show.querySelector('[data-send]');
const toast = show.querySelector('.toast');
const bubble = show.querySelector('.bubble');
let tool = 'lista', color = '#B4FF4D', toastT = 0;
const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '') || 'tunegocio';
const peso = (n) => `$ ${(Math.round(n / 100) * 100).toLocaleString('es-AR')}`;
const nombre = () => input.value.trim() || 'Tu negocio';

function linea(contenido, done = false) {
  const li = document.createElement('li');
  if (done) li.className = 'done';
  const tick = document.createElement('span');
  tick.className = 'tick'; tick.textContent = done ? '●' : '✓';
  li.append(tick, ' ', ...contenido);
  return li;
}
function pintarLog(animar) {
  const { lines, ruta } = LOGS[tool];
  const marca = document.createElement('b'); marca.dataset.name = '';
  const hex = document.createElement('b'); hex.dataset.hex = ''; hex.textContent = color;
  const url = document.createElement('b');
  const s = document.createElement('span'); s.dataset.slug = '';
  url.append(s, `.com.ar${ruta}`);
  const items = [linea(['marca: ', marca]), linea(['color: ', hex]), ...lines.map((t) => linea([t])), linea(['listo en ', url], true)];
  log.replaceChildren(...items);
  ponerNombre();
  if (!animar || !motion()) return;
  items.forEach((li, i) => { li.classList.add('typing'); li.style.setProperty('--i', i); });
  requestAnimationFrame(() => requestAnimationFrame(() => items.forEach((li) => li.classList.remove('typing'))));
}
function ponerNombre() {
  const v = input.value.trim();
  const palabras = v.split(/\s+/).filter(Boolean);
  const ini = palabras.length > 1 ? palabras[0][0] + palabras[palabras.length - 1][0] : (palabras[0] || 'TN').slice(0, 2);
  document.querySelectorAll('[data-name]').forEach((el) => { el.textContent = nombre(); });
  document.querySelectorAll('[data-slug]').forEach((el) => { el.textContent = slug(v); });
  show.querySelector('[data-ini]').textContent = ini.toUpperCase();
  const txt = v ? `Hola, quiero ver la herramienta para ${v}` : 'Hola, quiero ver la herramienta para mi negocio';
  pedir.href = `https://wa.me/5492604670292?text=${encodeURIComponent(txt)}`;
  resumen();
}
input.addEventListener('input', ponerNombre);

// Color de marca: el texto encima va claro u oscuro según lo que tenga más contraste
function luz(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => { const c = parseInt(hex.slice(i, i + 2), 16) / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const swatches = [...document.querySelectorAll('[data-color]')];
swatches.forEach((sw) => sw.addEventListener('click', () => {
  color = sw.dataset.color;
  swatches.forEach((x) => x.setAttribute('aria-checked', x === sw));
  const L = luz(color);
  show.style.setProperty('--brand', color);
  show.style.setProperty('--on-brand', 1.05 / (L + 0.05) > (L + 0.05) / 0.056 ? '#FFFFFF' : '#0A1400');
  const hex = log.querySelector('[data-hex]');
  if (hex) hex.textContent = color;
}));

// Lista: sumar y restar bultos
show.querySelector('.items').addEventListener('click', (e) => {
  const b = e.target.closest('[data-d]');
  if (!b) return;
  const out = b.parentElement.querySelector('output');
  out.value = Math.min(99, Math.max(0, Number(out.value) + Number(b.dataset.d)));
  resumen();
});

// Cotizador: distancias por ruta (en km) y una tarifa de ejemplo
const KM = { 'Mendoza|San Juan': 170, 'San Juan|San Rafael': 400, 'La Rioja|San Juan': 450, 'Mendoza|San Rafael': 235, 'La Rioja|Mendoza': 610, 'La Rioja|San Rafael': 840 };
const desde = show.querySelector('[data-from]'), hasta = show.querySelector('[data-to]'), bultos = show.querySelector('[data-bultos]');
[desde, hasta, bultos].forEach((el) => el.addEventListener('input', resumen));
function cotizar() {
  const km = desde.value === hasta.value ? 0 : KM[[desde.value, hasta.value].sort().join('|')];
  const n = Number(bultos.value);
  show.querySelector('[data-bultos-out]').value = n;
  show.querySelector('[data-km]').textContent = km ? `${km} km · ${n} bultos · retiro en 24 h` : `Dentro de la ciudad · ${n} bultos`;
  const total = km ? 18000 + km * 60 + n * 1500 : 12000 + n * 1200;
  show.querySelector('[data-quote]').textContent = peso(total);
  return { km, n, total };
}

// Turnos: un elegido por grupo (día, servicio, horario)
show.querySelectorAll('.days, .svc, .slots').forEach((g) => g.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  g.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
  resumen();
}));

// El botón del celular y el mensaje que le llega al dueño
function resumen() {
  let btn, title, body, aviso;
  if (tool === 'lista') {
    const filas = [...show.querySelectorAll('[data-item]')].map((li) => ({ item: li.dataset.item, precio: Number(li.dataset.price), q: Number(li.querySelector('output').value) })).filter((f) => f.q);
    const n = filas.reduce((s, f) => s + f.q, 0), total = filas.reduce((s, f) => s + f.q * f.precio, 0);
    btn = n ? `Pedir ${n} bultos · ${peso(total)}` : 'Sumá productos al pedido';
    title = 'Cliente · pedido nuevo';
    body = n ? `${filas.map((f) => `${f.q}× ${f.item}`).join('\n')}\nTotal: ${peso(total)}` : 'Todavía sin productos';
    aviso = `Pedido enviado a ${nombre()}`;
  } else if (tool === 'cotizador') {
    const c = cotizar();
    btn = `Confirmar retiro · ${peso(c.total)}`;
    title = 'Cliente · cotización aceptada';
    body = `${desde.value} → ${hasta.value}\n${c.n} bultos\nEstimado: ${peso(c.total)}`;
    aviso = `Cotización enviada a ${nombre()}`;
  } else if (tool === 'turnos') {
    const dia = show.querySelector('.days .on').dataset.day, svc = show.querySelector('.svc .on').dataset.svc, hora = show.querySelector('.slots .on').textContent;
    btn = `Confirmar ${dia} · ${hora}`;
    title = 'Cliente · turno nuevo';
    body = `${svc}\n${dia} · ${hora} hs`;
    aviso = `Turno confirmado en ${nombre()}`;
  } else {
    btn = 'Escribinos por WhatsApp';
    title = `Consulta desde ${slug(input.value.trim())}.com.ar`;
    body = '«Hola, vi la web. ¿Hacen envíos?»';
    aviso = `Mensaje enviado a ${nombre()}`;
  }
  send.textContent = btn;
  send.dataset.aviso = aviso;
  bubble.querySelector('[data-owner-title]').textContent = title;
  bubble.querySelector('[data-owner-body]').textContent = body;
}
send.addEventListener('click', () => {
  toast.querySelector('[data-toast-title]').textContent = send.dataset.aviso;
  toast.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => toast.classList.remove('show'), 2600);
  bubble.classList.remove('ping'); void bubble.offsetWidth; bubble.classList.add('ping');
});

const tabs = [...document.querySelectorAll('[data-tab]')];
const tools = [...document.querySelectorAll('[data-tool]')];
function elegir(btn, teclado = false) {
  tabs.forEach((t) => { const on = t === btn; t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1; });
  const actual = tools.find((t) => !t.hidden);
  const nueva = tools.find((t) => t.dataset.tool === btn.dataset.tab);
  if (actual === nueva) return;
  actual.hidden = true;
  nueva.hidden = false;
  tool = btn.dataset.tab;
  toast.classList.remove('show');
  show.querySelector('[data-sub]').textContent = LOGS[tool].sub;
  pintarLog(!teclado);
  if (motion() && !teclado) { nueva.classList.add('swap'); requestAnimationFrame(() => requestAnimationFrame(() => nueva.classList.remove('swap'))); }
}
tabs.forEach((t, i) => {
  t.tabIndex = i === 0 ? 0 : -1;
  t.addEventListener('click', () => elegir(t));
  t.addEventListener('keydown', (e) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    const sig = tabs[(i + d + tabs.length) % tabs.length];
    sig.focus(); elegir(sig, true);
  });
});
pintarLog(false);
cotizar();

// Pipeline: la línea avanza con el scroll y cada etapa se enciende cuando la alcanza
const stages = document.querySelector('.stages');
const etapas = [...stages.children];
function rail() {
  const oculto = getComputedStyle(stages, '::before').display === 'none';
  let p = 1;
  if (motion() && !oculto) {
    const r = stages.getBoundingClientRect();
    p = Math.min(1, Math.max(0, (innerHeight * 0.7 - r.top) / r.height));
  }
  stages.style.setProperty('--p', `${p * 100}%`);
  const horiz = stages.offsetWidth > stages.offsetHeight;
  etapas.forEach((el) => {
    const pos = horiz ? el.offsetLeft / stages.offsetWidth : el.offsetTop / stages.offsetHeight;
    el.classList.toggle('lit', oculto || p >= pos);
  });
}
let pend = false;
addEventListener('scroll', () => { if (!pend) { pend = true; requestAnimationFrame(() => { pend = false; rail(); }); } }, { passive: true });
addEventListener('resize', rail);
rail();

// Automatización: el paquete recorre los cinco pasos, cada paso se enciende y el log se escribe solo
const FLOWS = {
  pedido: {
    nombre: 'pedido por mail',
    pasos: [['Llega un mail', 'Pedido_DonLuis.pdf'], ['Lee el pedido', '12 renglones'], ['Cruza precios y stock', '2 sin stock'], ['Arma el presupuesto', 'listo para aprobar'], ['Avisa al vendedor', 'WhatsApp · aprobar']],
    log: ['mail recibido: Pedido_DonLuis.pdf', 'leídos 12 renglones del PDF', 'precios de hoy aplicados · 2 sin stock', 'presupuesto cargado en el sistema', 'aviso al vendedor: falta aprobar'],
    hora: [8, 2],
  },
  informe: {
    nombre: 'informe mensual',
    pasos: [['Día 1, 08:00', 'arranca solo'], ['Junta los datos', '3 planillas + banco'], ['Calcula', 'ventas por vendedor'], ['Arma el informe', 'informe-octubre.pdf'], ['Lo manda', 'mail a los socios']],
    log: ['disparado por calendario: 1 de noviembre', 'leídas 3 planillas y el extracto del banco', 'totales por vendedor y por rubro', 'generado informe-octubre.pdf', 'enviado por mail a los socios'],
    hora: [8, 0],
  },
  cobranza: {
    nombre: 'cobranzas',
    pasos: [['Vencimientos de hoy', '14 clientes'], ['Cruza con el banco', '5 ya pagaron'], ['Manda recordatorio', 'mail a 9 pendientes'], ['Actualiza la planilla', 'estado por cliente'], ['Te resume', '18:00 · 1 mensaje']],
    log: ['14 vencimientos para hoy', 'cruzado con el banco: 5 pagos encontrados', 'recordatorio enviado a 9 clientes', 'planilla de cobranzas actualizada', 'resumen del día enviado al dueño'],
    hora: [17, 58],
  },
};
const auto = (() => {
  const sec = document.querySelector('.auto');
  const pipe = sec.querySelector('.pipe');
  const nodos = [...sec.querySelectorAll('.pn')];
  const track = sec.querySelector('.pipe-track'), fill = sec.querySelector('.pipe-fill'), pkt = sec.querySelector('.pkt');
  const alog = sec.querySelector('.alog');
  const botones = [...sec.querySelectorAll('[data-flow]')];
  let flow = 'pedido', paso = 0, timer = 0, visible = false, centros = [], vertical = false;

  const hhmm = (i) => { const [h, m] = FLOWS[flow].hora; const t = h * 60 + m + Math.floor(i / 2); return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };
  function medir() {
    const b = pipe.getBoundingClientRect();
    centros = nodos.map((n) => { const r = n.querySelector('.pn-dot').getBoundingClientRect(); return { x: r.left - b.left + r.width / 2, y: r.top - b.top + r.height / 2 }; });
    const a = centros[0], z = centros[centros.length - 1];
    vertical = Math.abs(z.y - a.y) > Math.abs(z.x - a.x);
    Object.assign(track.style, vertical
      ? { left: `${a.x - 1}px`, top: `${a.y}px`, width: '2px', height: `${z.y - a.y}px` }
      : { left: `${a.x}px`, top: `${a.y - 1}px`, width: `${z.x - a.x}px`, height: '2px' });
  }
  function pintar(k) {
    // k = paso en curso (0..5); 5 = terminado
    nodos.forEach((n, i) => {
      n.classList.toggle('active', i === k);
      n.classList.toggle('wait', i > k);
      n.querySelector('.pn-s').textContent = i < k ? '✓ listo' : i === k ? 'procesando…' : 'en espera';
    });
    const p = Math.min(k, nodos.length - 1) / (nodos.length - 1);
    fill.style.transform = vertical ? `scaleY(${p})` : `scaleX(${p})`;
    const c = centros[Math.min(k, nodos.length - 1)];
    pkt.style.transform = `translate(${c.x - 7}px, ${c.y - 7}px)`;
    pkt.style.opacity = k >= nodos.length ? 0 : 1;
  }
  function renglon(i, animar) {
    const li = document.createElement('li');
    const t = document.createElement('span'); t.className = 't'; t.textContent = hhmm(i);
    const fin = i >= FLOWS[flow].log.length;
    if (fin) li.className = 'fin';
    li.append(t, fin ? '✓ listo, sin que nadie lo toque' : `✓ ${FLOWS[flow].log[i]}`);
    alog.append(li);
    if (animar) { li.classList.add('typing'); requestAnimationFrame(() => requestAnimationFrame(() => li.classList.remove('typing'))); }
  }
  function cargar() {
    const f = FLOWS[flow];
    nodos.forEach((n, i) => { n.querySelector('.pn-t').textContent = f.pasos[i][0]; n.querySelector('.pn-d').textContent = f.pasos[i][1]; });
    sec.querySelector('[data-flow-title]').textContent = `axis — flujo: ${f.nombre}`;
    alog.replaceChildren();
    medir();
  }
  function correr() {
    clearTimeout(timer);
    if (!motion() || !visible) {
      // Quieto: el flujo completo, con todo el log
      alog.replaceChildren();
      for (let i = 0; i <= nodos.length; i++) renglon(i, false);
      pintar(nodos.length);
      nodos.forEach((n) => { n.classList.remove('wait', 'active'); n.querySelector('.pn-s').textContent = '✓ listo'; });
      return;
    }
    const tick = () => {
      if (paso === 0) alog.replaceChildren();
      pintar(paso);
      renglon(paso, true);
      paso = paso >= nodos.length ? 0 : paso + 1;
      timer = setTimeout(tick, paso === 0 ? 3200 : 1300);
    };
    tick();
  }
  function reiniciar() { paso = 0; cargar(); correr(); }
  botones.forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.flow === flow) return;
    flow = b.dataset.flow;
    botones.forEach((x) => x.setAttribute('aria-pressed', x === b));
    reiniciar();
  }));
  new IntersectionObserver(([e]) => { const antes = visible; visible = e.isIntersecting; if (antes !== visible) reiniciar(); }, { threshold: 0.25 }).observe(pipe);
  new ResizeObserver(() => { medir(); pintar(motion() && visible ? Math.max(0, paso - 1) : nodos.length); }).observe(pipe);
  cargar(); correr();
  return { reiniciar };
})();
