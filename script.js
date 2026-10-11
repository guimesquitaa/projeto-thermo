// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES E ESTADO GLOBAL
// ─────────────────────────────────────────────────────────────────────────────

const TC = 92; // Temperatura crítica em Kelvin (YBa₂Cu₃O₇)

// Estado atual de cada slider
const state = {
  t1: 100, // temperatura tab 1
  t2: 100, // temperatura tab 2
  i2: 5,   // corrente tab 2
  t3: 100  // temperatura tab 3
};

// IDs dos loops de animação (para poder cancelar ao trocar de tab)
let animId = [null, null, null];

// Referências aos canvas e seus contextos 2D
const cvs = [
  document.getElementById('c1'),
  document.getElementById('c2'),
  document.getElementById('c3')
];
const ctx = cvs.map(c => c.getContext('2d'));

// ─────────────────────────────────────────────────────────────────────────────
// UTILITÁRIOS
// ─────────────────────────────────────────────────────────────────────────────

// Retorna true se a temperatura está abaixo da crítica
function isSuper(t) { return t < TC; }

// Atualiza o badge de status (verde = super, vermelho = normal)
function setBadge(id, dotId, stateId, sup, label) {
  const b = document.getElementById(id);
  const d = document.getElementById(dotId);
  const s = document.getElementById(stateId);
  if (sup) {
    b.className = 'status-badge super';
    d.className = 'dot dot-super';
  } else {
    b.className = 'status-badge normal';
    d.className = 'dot dot-normal';
  }
  s.textContent = label;
}

// Desenha a barra de temperatura lateral com a linha de Tc
function drawTempBar(c, t, bx, by) {
  const bh = 160;
  const ratio = Math.max(0, Math.min(1, (t - 1) / 149));
  const sup = isSuper(t);
  const tColor = sup ? '#1D9E75' : '#E24B4A';

  // Fundo da barra
  c.fillStyle = 'rgba(255,255,255,0.05)';
  c.beginPath(); c.roundRect(bx, by, 14, bh, 4); c.fill();

  // Preenchimento proporcional à temperatura
  c.fillStyle = tColor;
  c.beginPath(); c.roundRect(bx, by + bh * (1 - ratio), 14, bh * ratio, 4); c.fill();

  // Label "T"
  c.fillStyle = 'rgba(255,255,255,0.4)';
  c.font = '9px system-ui'; c.textAlign = 'center';
  c.fillText('T', bx + 7, by + bh + 12);

  // Linha pontilhada marcando Tc
  const tcRatio = (TC - 1) / 149;
  const tcY = by + bh * (1 - tcRatio);
  c.strokeStyle = 'rgba(250,199,117,0.7)';
  c.lineWidth = 1; c.setLineDash([2, 2]);
  c.beginPath(); c.moveTo(bx - 4, tcY); c.lineTo(bx + 22, tcY); c.stroke();
  c.setLineDash([]);

  // Label "Tc"
  c.fillStyle = 'rgba(250,199,117,0.8)';
  c.font = '9px system-ui'; c.textAlign = 'left';
  c.fillText('Tc', bx + 24, tcY + 3);
}

// Desenha uma ponta de seta
function drawArrow(c, x1, y1, x2, y2, color) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  c.save();
  c.strokeStyle = color; c.fillStyle = color;
  c.lineWidth = 1;
  c.translate(x2, y2);
  c.rotate(angle);
  c.beginPath(); c.moveTo(-6, -3); c.lineTo(0, 0); c.lineTo(-6, 3); c.stroke();
  c.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// SISTEMA DE TABS
// ─────────────────────────────────────────────────────────────────────────────

function switchTab(i) {
  // Cancela todos os loops de animação ativos
  animId.forEach(id => id && cancelAnimationFrame(id));

  // Atualiza visual das abas
  document.querySelectorAll('.tab-btn').forEach((b, j) => b.classList.toggle('active', j === i));
  document.querySelectorAll('.panel').forEach((p, j) => p.classList.toggle('active', j === i));

  // Inicia a animação da aba selecionada
  if (i === 0) startMeissner();
  if (i === 1) { initResistParticles(); startResist(); }
  if (i === 2) { initCooperParticles(); startCooper(); }
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 1 — EFEITO MEISSNER
// ─────────────────────────────────────────────────────────────────────────────

// Posição Y alvo e atual do ímã (animação suave)
let magnetTarget = 185;
let magnetCurrent = 185;

function updateMeissner() {
  const t = parseInt(document.getElementById('t1').value);
  state.t1 = t;
  document.getElementById('t1-val').textContent = t + ' K';
  document.getElementById('m-t').textContent = t + ' K';

  const sup = isSuper(t);

  // Se supercondutor, o ímã sobe (Y menor = mais para cima no canvas)
  magnetTarget = sup ? 85 : 185;

  document.getElementById('m-lev').textContent = sup ? 'Sim ✓' : 'Não';
  setBadge('m-badge', 'm-dot', 'm-state', sup,
    sup ? 'Supercondutor: campo expulso' : 'Estado normal: sem levitação');
}

function drawMeissner(ts) {
  const c = ctx[0], W = 640, H = 300;
  c.clearRect(0, 0, W, H);

  const t = state.t1;
  const sup = isSuper(t);

  // Grade de fundo sutil
  c.strokeStyle = 'rgba(255,255,255,0.03)';
  c.lineWidth = 0.5;
  for (let x = 0; x < W; x += 30) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
  for (let y = 0; y < H; y += 30) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }

  // ── MATERIAL (elipse) ──
  const mx = W / 2, my = H - 60, mw = 200, mh = 36;
  const matColor = sup ? '#1D9E75' : '#5F5E5A';
  const glowColor = sup ? 'rgba(29,158,117,0.25)' : 'rgba(95,94,90,0.1)';

  // Brilho ao redor do material
  const grad = c.createRadialGradient(mx, my, 0, mx, my, 120);
  grad.addColorStop(0, glowColor);
  grad.addColorStop(1, 'transparent');
  c.fillStyle = grad;
  c.beginPath(); c.ellipse(mx, my, 130, 50, 0, 0, Math.PI * 2); c.fill();

  // Corpo do material
  c.fillStyle = matColor;
  c.beginPath(); c.ellipse(mx, my, mw / 2, mh / 2, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = sup ? '#5DCAA5' : '#888780';
  c.lineWidth = 1.5;
  c.beginPath(); c.ellipse(mx, my, mw / 2, mh / 2, 0, 0, Math.PI * 2); c.stroke();

  // Label do material
  c.fillStyle = sup ? '#E1F5EE' : '#D3D1C7';
  c.font = '500 12px system-ui';
  c.textAlign = 'center';
  c.fillText(sup ? 'SUPERCONDUTOR' : 'MATERIAL NORMAL', mx, my + 4);

  // ── ÍMÂ (animação suave) ──
  // Interpolação exponencial: move 7% da distância restante a cada frame
  magnetCurrent += (magnetTarget - magnetCurrent) * 0.07;
  const magY = magnetCurrent;
  const magH = 40, magW = 70;

  // Polo Norte (laranja/vermelho)
  c.fillStyle = '#D85A30';
  c.beginPath(); c.roundRect(mx - magW / 2, magY - magH, magW, magH / 2, 4); c.fill();
  // Polo Sul (azul)
  c.fillStyle = '#378ADD';
  c.beginPath(); c.roundRect(mx - magW / 2, magY - magH / 2, magW, magH / 2, 4); c.fill();

  // Labels dos polos
  c.font = '700 11px monospace'; c.textAlign = 'center';
  c.fillStyle = '#FAC775'; c.fillText('N', mx, magY - magH + 14);
  c.fillStyle = '#85B7EB'; c.fillText('S', mx, magY - 6);

  // ── LINHAS DE CAMPO MAGNÉTICO ──
  if (sup) {
    // Supercondutor: linhas curvam PARA FORA (efeito Meissner)
    for (let i = 0; i < 5; i++) {
      const xOff = -90 + i * 45;
      const lineX = mx + xOff;
      const topY = magY - 50;
      const side = xOff < 0 ? -1 : (xOff > 0 ? 1 : 0);
      const bulge = side * (60 + Math.abs(xOff));

      c.beginPath();
      c.moveTo(lineX, topY);
      // Curva Bezier que desvia ao redor do material
      c.bezierCurveTo(lineX + bulge, topY + 80, lineX + bulge, topY + 140, lineX, topY + 195);
      c.strokeStyle = 'rgba(250,199,117,0.45)';
      c.lineWidth = 1.2;
      c.setLineDash([4, 3]);
      c.stroke();
      c.setLineDash([]);
      drawArrow(c, lineX, topY + 185, lineX, topY + 195, 'rgba(250,199,117,0.6)');
    }
    c.fillStyle = '#FAC775'; c.font = '11px system-ui'; c.textAlign = 'left';
    c.fillText('Campo expulso', mx + 108, my - 10);
  } else {
    // Normal: linhas passam direto pelo material
    for (let i = 0; i < 5; i++) {
      const xOff = -80 + i * 40;
      c.beginPath();
      c.moveTo(mx + xOff, magY - 50);
      c.lineTo(mx + xOff, my + 20);
      c.strokeStyle = 'rgba(250,199,117,0.35)';
      c.lineWidth = 1.2;
      c.setLineDash([4, 3]);
      c.stroke();
      c.setLineDash([]);
      drawArrow(c, mx + xOff, my + 10, mx + xOff, my + 20, 'rgba(250,199,117,0.5)');
    }
    c.fillStyle = 'rgba(250,199,117,0.6)'; c.font = '11px system-ui'; c.textAlign = 'right';
    c.fillText('Campo penetra', mx - 108, my - 10);
  }

  drawTempBar(c, t, 16, 40);

  // Próximo frame
  animId[0] = requestAnimationFrame(drawMeissner);
}

function startMeissner() {
  animId[0] = requestAnimationFrame(drawMeissner);
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 2 — RESISTÊNCIA ZERO
// ─────────────────────────────────────────────────────────────────────────────

const N_PARTICLES = 24;
let rParticles = [];

function initResistParticles() {
  rParticles = [];
  for (let i = 0; i < N_PARTICLES; i++) {
    rParticles.push({
      x: Math.random() * 520 + 60,  // posição X inicial aleatória no fio
      y: 150,                         // posição Y central (dentro do fio)
      vx: 1.2,                        // velocidade base horizontal
      vy: 0                           // velocidade vertical (só usada no estado normal)
    });
  }
}

function updateResist() {
  const t = parseInt(document.getElementById('t2').value);
  const i = parseInt(document.getElementById('i2').value);
  state.t2 = t; state.i2 = i;
  document.getElementById('t2-val').textContent = t + ' K';
  document.getElementById('i2-val').textContent = i + ' A';

  const sup = isSuper(t);
  const outCurr = sup
    ? i
    : Math.max(0, i * (1 - (1 - TC / Math.max(t, TC)) * 0.65)).toFixed(1);
  const loss = sup ? 0 : Math.round((1 - outCurr / i) * 100);

  document.getElementById('r-in').textContent = i + ' A';
  document.getElementById('r-out').textContent = outCurr + ' A';
  document.getElementById('r-loss').textContent = loss + '%';

  setBadge('r-badge', 'r-dot', 'r-state', sup,
    sup ? 'Supercondutor -> resistência = 0 Ω' : 'Estado normal -> com resistência');
}

function drawResist(ts) {
  const c = ctx[1], W = 640, H = 300;
  c.clearRect(0, 0, W, H);

  const t = state.t2, i2 = state.i2;
  const sup = isSuper(t);

  // Velocidade das partículas: proporcional à corrente
  // No estado normal, reduz com temperatura
  const speed = sup
    ? 2.5 * (i2 / 5)
    : 1.2 * (i2 / 5) * (TC / Math.max(t, TC));

  // ── FIO ──
  const wireY = 150, wireH = 60;
  c.fillStyle = '#1a1a2e';
  c.beginPath(); c.roundRect(40, wireY - wireH / 2, 560, wireH, 8); c.fill();
  c.strokeStyle = sup ? '#1D9E75' : '#888780';
  c.lineWidth = 2;
  c.beginPath(); c.roundRect(40, wireY - wireH / 2, 560, wireH, 8); c.stroke();

  // Preenchimento colorido no fio
  c.fillStyle = sup ? 'rgba(29,158,117,0.1)' : 'rgba(136,135,128,0.08)';
  c.fillRect(41, wireY - wireH / 2 + 1, 558, wireH - 2);

  // Label do fio
  c.fillStyle = sup ? '#5DCAA5' : '#B4B2A9';
  c.font = '500 11px system-ui'; c.textAlign = 'center';
  c.fillText(sup ? 'FIO SUPERCONDUTOR' : 'FIO CONDUTOR NORMAL', W / 2, wireY + 4);

  // ── AMPERÍMETROS ──
  drawAmmeter(c, 40, wireY, state.i2, 'Entrada');
  const outA = sup
    ? state.i2
    : Math.max(0, state.i2 * (1 - (1 - TC / Math.max(t, TC)) * 0.65));
  drawAmmeter(c, 600, wireY, outA, 'Saída');

  // ── PARTÍCULAS (elétrons) ──
  rParticles.forEach(p => {
    p.x += speed;

    if (!sup) {
      // Estado normal: jitter aleatório simula colisões com a rede
      p.vy += (Math.random() - 0.5) * 0.3;
      p.vy *= 0.9; // amortecimento
      p.y += p.vy;
      // Mantém dentro do fio
      p.y = Math.max(wireY - wireH / 2 + 10, Math.min(wireY + wireH / 2 - 10, p.y));
    } else {
      // Supercondutor: elétrons se alinham suavemente ao centro
      p.y += (wireY - p.y) * 0.05;
      p.vy *= 0.9;
    }

    // Reinicia a partícula quando sai do fio pela direita
    if (p.x > 595) {
      p.x = 60 + Math.random() * 20;
      if (!sup) p.y = wireY + (Math.random() - 0.5) * wireH * 0.8;
    }

    // Simula "perda" de elétrons no estado normal (resistência)
    if (!sup && Math.random() < 0.004 * (t / TC - 1)) return;

    // Desenha a partícula
    c.beginPath();
    c.arc(p.x, p.y, sup ? 5 : 4, 0, Math.PI * 2);
    c.fillStyle = sup ? '#5DCAA5' : '#D85A30';
    c.fill();

    // Símbolo de carga negativa
    c.fillStyle = sup ? '#04342C' : '#FAF0EC';
    c.font = '700 8px monospace'; c.textAlign = 'center';
    c.fillText('−', p.x, p.y + 3);

    // Rastro de luz quando supercondutor
    if (sup) {
      c.beginPath(); c.arc(p.x - 10, p.y, 3, 0, Math.PI * 2);
      c.fillStyle = 'rgba(93,202,165,0.3)'; c.fill();
      c.beginPath(); c.arc(p.x - 18, p.y, 1.5, 0, Math.PI * 2);
      c.fillStyle = 'rgba(93,202,165,0.15)'; c.fill();
    }
  });

  drawTempBar(c, t, 16, 40);
  animId[1] = requestAnimationFrame(drawResist);
}

// Desenha um amperímetro circular com agulha
function drawAmmeter(c, x, y, val, label) {
  const r = 22;
  c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2);
  c.fillStyle = '#0d0d1a'; c.fill();
  c.strokeStyle = '#FAC775'; c.lineWidth = 1.5; c.stroke();

  // Agulha proporcional ao valor (0 a 10A → -90° a +90°)
  const angle = -Math.PI / 2 + (val / 10) * Math.PI;
  c.save(); c.translate(x, y);
  c.strokeStyle = '#FAC775'; c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(angle) * 14, Math.sin(angle) * 14); c.stroke();
  c.restore();

  c.fillStyle = 'rgba(255,255,255,0.4)'; c.font = '9px system-ui'; c.textAlign = 'center';
  c.fillText('A', x, y + 4);
  c.fillText(label, x, y + r + 13);
  c.fillStyle = '#FAC775'; c.font = '500 10px system-ui';
  c.fillText(val.toFixed(1) + 'A', x, y - r - 5);
}

function startResist() {
  animId[1] = requestAnimationFrame(drawResist);
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 3 — PARES DE COOPER
// ─────────────────────────────────────────────────────────────────────────────

const NC = 12; // Número de elétrons (deve ser par para formar pares)
let cParticles = [];

function initCooperParticles() {
  cParticles = [];
  for (let i = 0; i < NC; i++) {
    cParticles.push({
      x: 80 + Math.random() * 480,
      y: 80 + Math.random() * 160,
      vx: (Math.random() - 0.5) * 2.5, // velocidade aleatória
      vy: (Math.random() - 0.5) * 2.5,
      id: i
    });
  }
}

function updateCooper() {
  const t = parseInt(document.getElementById('t3').value);
  state.t3 = t;
  document.getElementById('t3-val').textContent = t + ' K';
  document.getElementById('c-t').textContent = t + ' K';
  const sup = isSuper(t);
  document.getElementById('c-mode').textContent = sup ? 'Pares de Cooper ✓' : 'Desordenado';
  setBadge('c-badge', 'c-dot', 'c-state', sup,
    sup ? 'Supercondutor: pares de Cooper formados' : 'Estado normal : elétrons livres');
}

function drawCooper(ts) {
  const c = ctx[2], W = 640, H = 300;
  c.clearRect(0, 0, W, H);

  const t = state.t3;
  const sup = isSuper(t);

  // ── REDE IÔNICA (fundo) ──
  // Representa os íons positivos do cristal que medeiam a atração entre elétrons
  c.fillStyle = 'rgba(55,138,221,0.1)';
  for (let x = 60; x < W - 40; x += 40) {
    for (let y = 50; y < H - 40; y += 40) {
      c.beginPath(); c.arc(x, y, 5, 0, Math.PI * 2); c.fill();
    }
  }
  c.strokeStyle = 'rgba(55,138,221,0.06)';
  c.lineWidth = 0.5;
  for (let x = 60; x < W - 40; x += 40) {
    c.beginPath(); c.moveTo(x, 50); c.lineTo(x, H - 40); c.stroke();
  }
  for (let y = 50; y < H - 40; y += 40) {
    c.beginPath(); c.moveTo(60, y); c.lineTo(W - 40, y); c.stroke();
  }
  c.fillStyle = 'rgba(55,138,221,0.45)';
  c.font = '10px system-ui'; c.textAlign = 'left';
  c.fillText('Íons da rede cristalina', 16, 20);

  if (sup) {
    // ── ESTADO SUPERCONDUTOR: pares se movem juntos em fluxo ordenado ──
    for (let i = 0; i < NC; i += 2) {
      const p1 = cParticles[i];
      const p2 = cParticles[i + 1];

      // Linha base para cada par (streams horizontais separados)
      const stream = i / 2;
      const baseY = 90 + stream * 35;

      // Movimento horizontal suave
      p1.x += 1.5;
      p2.x = p1.x + 18; // p2 sempre 18px à direita de p1
      p1.y += (baseY - p1.y) * 0.05; // suaviza para a linha base
      p2.y += (baseY - p2.y) * 0.05;

      if (p1.x > 600) { p1.x = 60; p2.x = 78; }

      // Linha de ligação entre o par
      c.beginPath();
      c.moveTo(p1.x, p1.y); c.lineTo(p2.x, p2.y);
      c.strokeStyle = 'rgba(93,202,165,0.5)'; c.lineWidth = 2; c.stroke();

      // Pulsação visual no centro do par
      const pulse = Math.sin(ts * 0.003 + stream) * 4;
      c.beginPath(); c.arc((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, 3 + pulse * 0.5, 0, Math.PI * 2);
      c.fillStyle = 'rgba(93,202,165,0.2)'; c.fill();

      drawElectron(c, p1.x, p1.y, true);
      drawElectron(c, p2.x, p2.y, true);

      // Label do primeiro par
      if (i === 0) {
        c.fillStyle = '#5DCAA5'; c.font = '10px system-ui'; c.textAlign = 'left';
        c.fillText('Par de Cooper', p2.x + 8, p2.y - 10);
      }
    }
    c.fillStyle = 'rgba(55,138,221,0.4)';
    c.font = '10px system-ui'; c.textAlign = 'right';
    c.fillText('Fônons medeiam a atração', W - 16, H - 16);

  } else {
    // ── ESTADO NORMAL: movimento browniano aleatório ──
    cParticles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;

      // Rebate nas bordas
      if (p.x < 60 || p.x > W - 40) p.vx *= -1;
      if (p.y < 50 || p.y > H - 40) p.vy *= -1;

      // Pequeno ruído aleatório (simulando colisões térmicas)
      p.vx += (Math.random() - 0.5) * 0.3;
      p.vy += (Math.random() - 0.5) * 0.3;

      // Limita a velocidade máxima
      p.vx = Math.max(-3, Math.min(3, p.vx));
      p.vy = Math.max(-3, Math.min(3, p.vy));

      drawElectron(c, p.x, p.y, false);
    });
    c.fillStyle = '#E24B4A'; c.font = '10px system-ui'; c.textAlign = 'right';
    c.fillText('Elétrons espalhados pelos íons', W - 16, H - 16);
  }

  drawTempBar(c, t, 16, 40);
  animId[2] = requestAnimationFrame(drawCooper);
}

// Desenha um elétron como círculo com símbolo "e⁻"
function drawElectron(c, x, y, paired) {
  const r = 6;
  c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2);
  c.fillStyle = paired ? '#5DCAA5' : '#D85A30'; c.fill();
  c.strokeStyle = paired ? '#1D9E75' : '#993C1D';
  c.lineWidth = 1; c.stroke();
  c.fillStyle = paired ? '#04342C' : '#FAECE7';
  c.font = '700 8px monospace'; c.textAlign = 'center';
  c.fillText('e⁻', x, y + 3);
}

function startCooper() {
  animId[2] = requestAnimationFrame(drawCooper);
}

// ─────────────────────────────────────────────────────────────────────────────
// INICIALIZAÇÃO
// ─────────────────────────────────────────────────────────────────────────────

// Atualiza os textos iniciais com os valores padrão dos sliders
updateMeissner();
updateResist();
updateCooper();

// Inicia a primeira tab
startMeissner();