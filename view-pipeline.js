// view-pipeline.js — Pipeline board grouped by stage, per UNIT.
(function () {
  'use strict';
  const Config = window.DomusConfig;
  const State = window.DomusState;
  const App = window.DomusApp;

  function matchesSearch(client, p, q) {
    if (!q) return true;
    q = q.toLowerCase();
    return (
      (client.name || '').toLowerCase().includes(q) ||
      (client.email || '').toLowerCase().includes(q) ||
      (p.address || '').toLowerCase().includes(q) ||
      (p.comuna || '').toLowerCase().includes(q)
    );
  }

  function render(root) {
    const focusSnap = App.captureFocus(root);
    const state = State.getState();
    const search = state.search || '';

    const rows = []; // { client, p }
    state.clients.forEach(function (c) {
      (c.propiedades || []).forEach(function (p) {
        if (matchesSearch(c, p, search)) rows.push({ client: c, p: p });
      });
    });

    // Deals perdidos salen de las columnas normales del embudo (ya no están
    // "avanzando" en ninguna etapa) y se agrupan en su propia columna al final.
    const abiertos = rows.filter(function (r) { return !r.p.perdido; });
    const perdidos = rows.filter(function (r) { return r.p.perdido; });

    const columns = Config.STAGES.map(function (s) {
      return { stage: s, items: abiertos.filter(function (r) { return r.p.stage === s.key; }) };
    });
    columns.push({ stage: { key: '__perdidos', label: 'Perdidos' }, items: perdidos, isLost: true });

    let html = '<div class="toolbar">' +
      '<div class="toolbar-left">' +
      '<div class="search-box">🔎 <input type="text" id="pipeline-search" placeholder="Buscar por nombre, dirección, comuna…" value="' + App.escapeHtml(search) + '"></div>' +
      '</div>' +
      '<button class="btn btn-primary" id="pipeline-new-btn">+ Nuevo cliente</button>' +
      '</div>';

    html += '<div class="pipeline-board">';
    columns.forEach(function (col) {
      html += '<div class="pipeline-col">' +
        '<div class="pipeline-col-header"><span>' + App.escapeHtml(col.stage.label) + '</span><span class="pipeline-count">' + col.items.length + '</span></div>' +
        '<div class="pipeline-cards">';
      if (!col.items.length) {
        html += '<div class="text-muted" style="font-size:12px;padding:8px 2px;">Sin unidades</div>';
      }
      col.items.forEach(function (r) {
        const vendedoraLabel = Config.VENDEDORAS[r.p.vendedora] || 'Sin asignar';
        html += '<div class="pipeline-card" data-prop-id="' + r.p.id + '">' +
          '<div class="pipeline-card-name">' + App.escapeHtml(r.client.name || 'Sin nombre') + '</div>' +
          '<div class="pipeline-card-addr">' + App.escapeHtml(r.p.address || 'Sin dirección') + (r.p.comuna ? ' · ' + App.escapeHtml(r.p.comuna) : '') + '</div>' +
          '<div class="pipeline-card-meta">' + App.escapeHtml(Config.TIPO_CONTRATO_LABELS[r.p.tipo_contrato] || r.p.tipo_contrato || '') + '</div>' +
          '<div class="pipeline-card-meta">👤 ' + App.escapeHtml(vendedoraLabel) + '</div>' +
          (col.isLost && r.p.motivo_perdida ? '<div class="pipeline-card-meta" style="color:var(--red-dark);">✗ ' + App.escapeHtml(r.p.motivo_perdida) + '</div>' : '') +
          '</div>';
      });
      html += '</div></div>';
    });
    html += '</div>';

    root.innerHTML = html;
    App.restoreFocus(root, focusSnap);

    document.getElementById('pipeline-search').addEventListener('input', function (e) {
      State.setState({ search: e.target.value });
    });
    document.getElementById('pipeline-new-btn').addEventListener('click', App.openNewClientWithUnitModal);
    root.querySelectorAll('.pipeline-card').forEach(function (card) {
      card.addEventListener('click', function () {
        App.openUnitEditModal(Number(card.dataset.propId) || card.dataset.propId);
      });
    });
  }

  window.DomusViews = window.DomusViews || {};
  window.DomusViews.pipeline = render;
})();
