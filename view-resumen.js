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

    root.innerHTML = html;
  }

  function statCard(label, value, sub) {
    return '<div class="stat-card"><div class="stat-label">' + App.escapeHtml(label) + '</div>' +
      '<div class="stat-value">' + App.escapeHtml(String(value)) + '</div>' +
      (sub ? '<div class="stat-sub">' + App.escapeHtml(sub) + '</div>' : '') + '</div>';
  }

  window.DomusViews = window.DomusViews || {};
  window.DomusViews.resumen = render;
})();
