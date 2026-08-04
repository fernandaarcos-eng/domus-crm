// view-departamentos.js — flat table of all units, filterable by comuna/tipo_contrato/stage.
(function () {
  'use strict';
  const Config = window.DomusConfig;
  const State = window.DomusState;
  const App = window.DomusApp;

  let filters = { comuna: '', tipo: '', stage: '' };

  function render(root) {
    const state = State.getState();
    const search = state.search || '';

    const rows = [];
    state.clients.forEach(function (c) {
      (c.propiedades || []).forEach(function (p) { rows.push({ client: c, p: p }); });
    });

    const comunas = Array.from(new Set(rows.map(function (r) { return r.p.comuna; }).filter(Boolean))).sort();

    let filtered = rows.filter(function (r) {
      if (filters.comuna && r.p.comuna !== filters.comuna) return false;
      if (filters.tipo && r.p.tipo_contrato !== filters.tipo) return false;
      if (filters.stage && r.p.stage !== filters.stage) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = (r.client.name || '') + ' ' + (r.p.address || '') + ' ' + (r.p.comuna || '');
        if (!hay.toLowerCase().includes(q)) return false;
      }
      return true;
    });

    let html = '<div class="toolbar">' +
      '<div class="toolbar-left">' +
      '<div class="search-box">🔎 <input type="text" id="depto-search" placeholder="Buscar…" value="' + App.escapeHtml(search) + '"></div>' +
      '<select class="filter-select" id="filter-comuna"><option value="">Todas las comunas</option>' +
      comunas.map(function (c) { return '<option value="' + App.escapeHtml(c) + '"' + (filters.comuna === c ? ' selected' : '') + '>' + App.escapeHtml(c) + '</option>'; }).join('') +
      '</select>' +
      '<select class="filter-select" id="filter-tipo"><option value="">Todos los tipos</option>' +
      Object.keys(Config.TIPO_CONTRATO_LABELS).map(function (k) { return '<option value="' + k + '"' + (filters.tipo === k ? ' selected' : '') + '>' + App.escapeHtml(Config.TIPO_CONTRATO_LABELS[k]) + '</option>'; }).join('') +
      '</select>' +
      '<select class="filter-select" id="filter-stage"><option value="">Todas las etapas</option>' +
      Config.STAGES.map(function (s) { return '<option value="' + s.key + '"' + (filters.stage === s.key ? ' selected' : '') + '>' + App.escapeHtml(s.label) + '</option>'; }).join('') +
      '</select>' +
      '<span class="text-muted" style="font-size:12px;">' + filtered.length + ' de ' + rows.length + ' unidades</span>' +
      '</div>' +
      '</div>';

    html += '<div class="table-wrap"><table><thead><tr>' +
      '<th>Unidad</th><th>Comuna</th><th>Cliente</th><th>Tipo contrato</th><th>Etapa</th><th>Dorm/Baños</th><th>Plataformas</th><th></th>' +
      '</tr></thead><tbody>';

    if (!filtered.length) {
      html += '<tr><td colspan="8"><div class="empty">Sin resultados</div></td></tr>';
    }
    filtered.forEach(function (r) {
      const p = r.p, c = r.client;
      html += '<tr>' +
        '<td>' + App.escapeHtml(p.address || ('#' + p.id)) + '</td>' +
        '<td>' + App.escapeHtml(p.comuna || '—') + '</td>' +
        '<td>' + App.escapeHtml(c.name || '—') + '</td>' +
        '<td><span class="badge badge-blue">' + App.escapeHtml(Config.TIPO_CONTRATO_LABELS[p.tipo_contrato] || p.tipo_contrato || '—') + '</span></td>' +
        '<td><span class="badge badge-purple">' + App.escapeHtml(Config.STAGE_LABELS[p.stage] || p.stage || '—') + '</span></td>' +
        '<td>' + App.escapeHtml((p.dorm || '—') + ' / ' + (p.banos || '—')) + '</td>' +
        '<td>' + App.escapeHtml((p.plataformas || []).join(', ') || '—') + '</td>' +
        '<td><button class="btn btn-ghost btn-sm" data-edit-unit="' + p.id + '">Editar</button></td>' +
        '</tr>';
    });
    html += '</tbody></table></div>';

    root.innerHTML = html;

    document.getElementById('depto-search').addEventListener('input', function (e) { State.setState({ search: e.target.value }); });
    document.getElementById('filter-comuna').addEventListener('change', function (e) { filters.comuna = e.target.value; render(root); });
    document.getElementById('filter-tipo').addEventListener('change', function (e) { filters.tipo = e.target.value; render(root); });
    document.getElementById('filter-stage').addEventListener('change', function (e) { filters.stage = e.target.value; render(root); });
    root.querySelectorAll('[data-edit-unit]').forEach(function (el) {
      el.addEventListener('click', function () { App.openUnitEditModal(el.dataset.editUnit); });
    });
  }

  window.DomusViews = window.DomusViews || {};
  window.DomusViews.departamentos = render;
})();
