// view-equipo.js — "Equipamiento y Claves" checklist per unit: which units are
// missing equipamiento/claves/wifi info, so the ops team can chase them down.
(function () {
  'use strict';
  const State = window.DomusState;
  const App = window.DomusApp;

  const CHECK_FIELDS = [
    ['claves', 'Claves'],
    ['equipamiento', 'Equipamiento'],
    ['wifi', 'WiFi'],
    ['datos_admin', 'Datos admin.'],
  ];

  let onlyMissing = false;

  function pill(has, label) {
    return '<span class="check-pill ' + (has ? 'check-ok' : 'check-no') + '">' + (has ? '✓ ' : '— ') + App.escapeHtml(label) + '</span>';
  }

  function render(root) {
    const state = State.getState();
    const search = (state.search || '').toLowerCase();

    let rows = [];
    state.clients.forEach(function (c) {
      (c.propiedades || []).forEach(function (p) {
        rows.push({ client: c, p: p });
      });
    });

    if (search) {
      rows = rows.filter(function (r) {
        return (r.client.name || '').toLowerCase().includes(search) || (r.p.address || '').toLowerCase().includes(search);
      });
    }

    rows.forEach(function (r) {
      r.missingCount = CHECK_FIELDS.filter(function (f) { return !(r.p[f[0]] || '').toString().trim(); }).length;
    });

    if (onlyMissing) rows = rows.filter(function (r) { return r.missingCount > 0; });
    rows.sort(function (a, b) { return b.missingCount - a.missingCount; });

    const totalMissing = rows.filter(function (r) { return r.missingCount > 0; }).length;

    let html = '<div class="toolbar">' +
      '<div class="toolbar-left">' +
      '<div class="search-box">🔎 <input type="text" id="equipo-search" placeholder="Buscar cliente o dirección…" value="' + App.escapeHtml(state.search || '') + '"></div>' +
      '<button class="filter-tab' + (onlyMissing ? ' active' : '') + '" id="toggle-missing">Solo con datos faltantes (' + totalMissing + ')</button>' +
      '</div>' +
      '</div>';

    html += '<div class="table-wrap"><table><thead><tr><th>Unidad</th><th>Cliente</th>' +
      CHECK_FIELDS.map(function (f) { return '<th>' + App.escapeHtml(f[1]) + '</th>'; }).join('') +
      '<th></th></tr></thead><tbody>';

    if (!rows.length) {
      html += '<tr><td colspan="' + (CHECK_FIELDS.length + 3) + '"><div class="empty">Sin resultados</div></td></tr>';
    }
    rows.forEach(function (r) {
      html += '<tr><td>' + App.escapeHtml(r.p.address || ('#' + r.p.id)) + '</td><td>' + App.escapeHtml(r.client.name || '—') + '</td>' +
        CHECK_FIELDS.map(function (f) { return '<td>' + pill(!!(r.p[f[0]] || '').toString().trim(), f[1]) + '</td>'; }).join('') +
        '<td><button class="btn btn-ghost btn-sm" data-edit-unit="' + r.p.id + '">Completar</button></td></tr>';
    });
    html += '</tbody></table></div>';

    root.innerHTML = html;

    document.getElementById('equipo-search').addEventListener('input', function (e) { State.setState({ search: e.target.value }); });
    document.getElementById('toggle-missing').addEventListener('click', function () { onlyMissing = !onlyMissing; render(root); });
    root.querySelectorAll('[data-edit-unit]').forEach(function (el) {
      el.addEventListener('click', function () { App.openUnitEditModal(el.dataset.editUnit); });
    });
  }

  window.DomusViews = window.DomusViews || {};
  window.DomusViews.equipo = render;
})();
