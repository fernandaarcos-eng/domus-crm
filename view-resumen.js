// view-resumen.js — dashboard: totals, stage funnel, tipo_contrato split, top comunas.
(function () {
  'use strict';
  const Config = window.DomusConfig;
  const State = window.DomusState;
  const App = window.DomusApp;

  function barRow(label, value, max) {
    const pct = max > 0 ? Math.round((value / max) * 100) : 0;
    return '<div class="bar-row"><div class="bar-label" title="' + App.escapeHtml(label) + '">' + App.escapeHtml(label) + '</div>' +
      '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%"></div></div>' +
      '<div class="bar-value">' + value + '</div></div>';
  }

  // Same shape as barRow, but colored as a traffic light against a monthly
  // goal instead of a plain proportion: green at/above 100%, amber from 70%
  // up to 100%, red below 70%. meta === 0 (no goal set) renders an empty gray
  // bar rather than claiming 0% of nothing.
  function metaBarRow(label, value, meta) {
    const pct = meta > 0 ? (value / meta) * 100 : 0;
    const displayPct = meta > 0 ? Math.min(100, Math.round(pct)) : 0;
    const color = meta <= 0 ? 'var(--border)' : (pct >= 100 ? 'var(--green)' : (pct >= 70 ? 'var(--amber)' : 'var(--red)'));
    return '<div class="bar-row"><div class="bar-label" title="' + App.escapeHtml(label) + '">' + App.escapeHtml(label) + '</div>' +
      '<div class="bar-track"><div class="bar-fill" style="width:' + displayPct + '%;background:' + color + ';"></div></div>' +
      '<div class="bar-value">' + value + '/' + (meta > 0 ? meta : '—') + '</div></div>';
  }

  function render(root) {
    const state = State.getState();
    const clients = state.clients;
    const propiedades = State.getAllPropiedades();

    const totalClientes = clients.length;
    const totalUnidades = propiedades.length;
    const activos = propiedades.filter(function (p) { return p.stage === 'cliente_activo'; }).length;
    const multiUnit = clients.filter(function (c) { return (c.propiedades || []).length > 1; }).length;

    const stageCounts = {};
    Config.STAGES.forEach(function (s) { stageCounts[s.key] = 0; });
    propiedades.forEach(function (p) { if (stageCounts[p.stage] != null) stageCounts[p.stage]++; });
    const maxStage = Math.max.apply(null, Object.values(stageCounts).concat([1]));

    const tipoCounts = { admin: 0, admin_amob: 0 };
    propiedades.forEach(function (p) { if (tipoCounts[p.tipo_contrato] != null) tipoCounts[p.tipo_contrato]++; else tipoCounts[p.tipo_contrato] = (tipoCounts[p.tipo_contrato] || 0) + 1; });

    const comunaCounts = {};
    propiedades.forEach(function (p) { const k = p.comuna || 'Sin comuna'; comunaCounts[k] = (comunaCounts[k] || 0) + 1; });
    const topComunas = Object.keys(comunaCounts).map(function (k) { return [k, comunaCounts[k]]; })
      .sort(function (a, b) { return b[1] - a[1]; }).slice(0, 8);
    const maxComuna = topComunas.length ? topComunas[0][1] : 1;

    let html = '<div class="stats">' +
      statCard('Clientes (propietarios)', totalClientes, multiUnit + ' con más de 1 unidad') +
      statCard('Unidades totales', totalUnidades, '') +
      statCard('Unidades activas', activos, totalUnidades ? Math.round(activos / totalUnidades * 100) + '% del total' : '') +
      statCard('Promedio unidades/cliente', totalClientes ? (totalUnidades / totalClientes).toFixed(1) : '0', '') +
      '</div>';

    html += '<div class="grid-2">';
    html += '<div class="card"><div class="subsection-title">Embudo de pipeline (por unidad)</div>' +
      Config.STAGES.map(function (s) { return barRow(s.label, stageCounts[s.key], maxStage); }).join('') +
      '</div>';

    html += '<div class="card"><div class="subsection-title">Top comunas</div>' +
      (topComunas.length ? topComunas.map(function (c) { return barRow(c[0], c[1], maxComuna); }).join('') : '<div class="text-muted">Sin datos</div>') +
      '</div>';
    html += '</div>';

    const totalTipo = tipoCounts.admin + tipoCounts.admin_amob;
    html += '<div class="card"><div class="subsection-title">Tipo de contrato</div>' +
      barRow(Config.TIPO_CONTRATO_LABELS.admin, tipoCounts.admin || 0, totalTipo || 1) +
      barRow(Config.TIPO_CONTRATO_LABELS.admin_amob, tipoCounts.admin_amob || 0, totalTipo || 1) +
      '</div>';

    html += renderRendimientoPorVendedora(propiedades);

    root.innerHTML = html;
  }

  function sumValorEstimado(list) {
    return list.reduce(function (sum, p) { return sum + (parseFloat(p.valor_estimado_mensual) || 0); }, 0);
  }

  // Average, across "ganadas" units, of the day-count between that unit's
  // first and last stage_history entry — a rough sales-cycle length. Units
  // with fewer than two dated entries (no real history yet) are skipped
  // rather than counted as a 0-day cycle.
  function cicloPromedioDias(ganadas) {
    const ciclos = ganadas.map(function (p) {
      const hist = (p.stage_history || []).filter(function (h) { return h && h.date; });
      if (hist.length < 2) return null;
      const diff = Math.round((new Date(hist[hist.length - 1].date) - new Date(hist[0].date)) / 86400000);
      return diff >= 0 ? diff : null;
    }).filter(function (d) { return d != null; });
    return ciclos.length ? Math.round(ciclos.reduce(function (a, b) { return a + b; }, 0) / ciclos.length) : null;
  }

  function renderRendimientoPorVendedora(propiedades) {
    const emails = Object.keys(Config.VENDEDORAS || {});
    if (!emails.length) return '';

    const currentMonth = App.currentMonthStr();
    let html = '<div class="subsection-title" style="margin-top:24px;">Rendimiento por vendedora</div><div class="grid-2">';

    emails.forEach(function (email) {
      const unidades = propiedades.filter(function (p) { return p.vendedora === email; });
      const abiertas = unidades.filter(function (p) { return !p.perdido && p.stage !== 'cliente_activo'; });
      const ganadas = unidades.filter(function (p) { return p.stage === 'cliente_activo'; });
      const perdidas = unidades.filter(function (p) { return p.perdido === true; });
      const denomConv = ganadas.length + perdidas.length;
      const tasaConversion = denomConv > 0 ? Math.round((ganadas.length / denomConv) * 100) + '%' : '—';
      const ciclo = cicloPromedioDias(ganadas);

      let contratosEsteMes = 0, evaluacionesEsteMes = 0;
      unidades.forEach(function (p) {
        (p.stage_history || []).forEach(function (h) {
          if (!h || !h.date || h.date.slice(0, 7) !== currentMonth) return;
          if (h.stage === 'cliente_activo') contratosEsteMes++;
          if (h.stage === 'reunion_cursada') evaluacionesEsteMes++;
        });
      });
      const meta = (Config.METAS_MENSUALES || {})[email] || {};

      html += '<div class="card">' +
        '<div class="subsection-title">' + App.escapeHtml(Config.VENDEDORAS[email]) + '</div>' +
        '<div class="stats" style="margin-bottom:14px;">' +
        statCard('Unidades', unidades.length, '') +
        statCard('Abiertas', abiertas.length, '') +
        statCard('Ganadas', ganadas.length, '') +
        statCard('Perdidas', perdidas.length, '') +
        statCard('Tasa de conversión', tasaConversion, 'ganadas / (ganadas + perdidas)') +
        statCard('Ciclo promedio', ciclo != null ? ciclo + ' día(s)' : '—', 'primer a último cambio de etapa') +
        '</div>' +
        '<div style="display:flex;gap:24px;flex-wrap:wrap;margin-bottom:16px;font-size:13px;">' +
        '<div><span class="text-muted">Valor pipeline abierto: </span><b>' + App.fmtMoney(sumValorEstimado(abiertas)) + '</b></div>' +
        '<div><span class="text-muted">Valor ganado: </span><b>' + App.fmtMoney(sumValorEstimado(ganadas)) + '</b></div>' +
        '</div>' +
        '<div class="subsection-title" style="font-size:12px;margin:0 0 6px;">Metas de este mes</div>' +
        metaBarRow('Contratos', contratosEsteMes, meta.contratosMeta || 0) +
        metaBarRow('Evaluaciones', evaluacionesEsteMes, meta.evaluacionesMeta || 0) +
        '</div>';
    });

    html += '</div>';
    return html;
  }

  function statCard(label, value, sub) {
    return '<div class="stat-card"><div class="stat-label">' + App.escapeHtml(label) + '</div>' +
      '<div class="stat-value">' + App.escapeHtml(String(value)) + '</div>' +
      (sub ? '<div class="stat-sub">' + App.escapeHtml(sub) + '</div>' : '') + '</div>';
  }

  window.DomusViews = window.DomusViews || {};
  window.DomusViews.resumen = render;
})();
