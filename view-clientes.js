// view-clientes.js — ONE CARD PER CLIENT (deduplicated owner), expands to show
// all of their Propiedades/units with full per-unit detail. This is the fix for
// the old app's "same owner repeated N times" complaint.
(function () {
  'use strict';
  const Config = window.DomusConfig;
  const State = window.DomusState;
  const App = window.DomusApp;

  let openIds = new Set(); // client ids currently expanded

  function matchesSearch(client, q) {
    if (!q) return true;
    q = q.toLowerCase();
    if ((client.name || '').toLowerCase().includes(q)) return true;
    if ((client.email || '').toLowerCase().includes(q)) return true;
    if ((client.phone || '').toLowerCase().includes(q)) return true;
    return (client.propiedades || []).some(function (p) {
      return (p.address || '').toLowerCase().includes(q) || (p.comuna || '').toLowerCase().includes(q);
    });
  }

  function unitFieldHtml(label, value) {
    const has = value != null && String(value).trim() !== '';
    return '<div class="unit-field"><span class="unit-field-label">' + App.escapeHtml(label) + '</span>' +
      '<span class="unit-field-value' + (has ? '' : ' empty-val') + '">' + (has ? App.escapeHtml(value) : 'Sin datos') + '</span></div>';
  }

  function unitBlockHtml(p) {
    const stageLabel = Config.STAGE_LABELS[p.stage] || p.stage;
    const tipoLabel = Config.TIPO_CONTRATO_LABELS[p.tipo_contrato] || p.tipo_contrato;
    return (
      '<div class="unit-block">' +
      '<div class="unit-block-header">' +
      '<div class="unit-title">' + App.escapeHtml(p.address || ('Unidad #' + p.id)) + (p.comuna ? ' · ' + App.escapeHtml(p.comuna) : '') + '</div>' +
      '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">' +
      '<span class="badge badge-purple">' + App.escapeHtml(stageLabel) + '</span>' +
      '<span class="badge badge-blue">' + App.escapeHtml(tipoLabel) + '</span>' +
      '<button class="btn btn-ghost btn-sm" data-edit-unit="' + p.id + '">Editar</button>' +
      '</div>' +
      '</div>' +
      '<div class="unit-grid">' +
      unitFieldHtml('Dormitorios', p.dorm) + unitFieldHtml('Baños', p.banos) + unitFieldHtml('Camas', p.camas) +
      unitFieldHtml('Sofá cama', p.sofa_cama) + unitFieldHtml('Estacionamiento', p.estac) + unitFieldHtml('Aire acond.', p.ac) +
      unitFieldHtml('Calefacción', p.calef) + unitFieldHtml('Lavadora', p.lavadora) + unitFieldHtml('WiFi', p.wifi) +
      unitFieldHtml('Claves', p.claves) + unitFieldHtml('Equipamiento', p.equipamiento) + unitFieldHtml('Datos administración', p.datos_admin) +
      unitFieldHtml('Comodidades', p.comodidades) + unitFieldHtml('Origen', p.origen) +
      unitFieldHtml('Notas', p.notes) +
      '</div>' +
      '</div>'
    );
  }

  function clientCardHtml(client) {
    const isOpen = openIds.has(client.id);
    const n = (client.propiedades || []).length;
    return (
      '<div class="client-card" data-client-id="' + App.escapeHtml(client.id) + '">' +
      '<div class="client-card-header" data-toggle="' + App.escapeHtml(client.id) + '">' +
      '<div>' +
      '<div class="client-name">' + App.escapeHtml(client.name || 'Sin nombre') + '</div>' +
      '<div class="client-meta">' +
      '<span>' + (client.email ? App.escapeHtml(client.email) : '<span class="text-muted">sin correo</span>') + '</span>' +
      '<span>' + (client.phone ? App.escapeHtml(client.phone) : '<span class="text-muted">sin teléfono</span>') + '</span>' +
      '</div>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:14px;">' +
      '<span class="client-units-count">' + n + (n === 1 ? ' unidad' : ' unidades') + '</span>' +
      '<button class="btn btn-ghost btn-sm" data-edit-client="' + App.escapeHtml(client.id) + '">Editar cliente</button>' +
      '<span class="chevron' + (isOpen ? ' open' : '') + '">▸</span>' +
      '</div>' +
      '</div>' +
      '<div class="client-card-body' + (isOpen ? ' open' : '') + '">' +
      (client.propiedades || []).map(unitBlockHtml).join('') +
      '</div>' +
      '</div>'
    );
  }

  function render(root) {
    const state = State.getState();
    const search = state.search || '';
    const clients = state.clients
      .filter(function (c) { return matchesSearch(c, search); })
      .slice()
      .sort(function (a, b) { return (a.name || '').localeCompare(b.name || '', 'es'); });

    let html = '<div class="toolbar">' +
      '<div class="toolbar-left">' +
      '<div class="search-box">🔎 <input type="text" id="clientes-search" placeholder="Buscar cliente, correo, dirección…" value="' + App.escapeHtml(search) + '"></div>' +
      '<span class="text-muted" style="font-size:12px;">' + state.clients.length + ' clientes · ' + State.getAllPropiedades().length + ' unidades</span>' +
      '</div>' +
      '<button class="btn btn-primary" id="clientes-new-btn">+ Nuevo cliente</button>' +
      '</div>';

    if (!clients.length) {
      html += '<div class="empty"><div class="empty-title">Sin resultados</div><p>No hay clientes que coincidan con la búsqueda.</p></div>';
    } else {
      html += '<div class="client-list">' + clients.map(clientCardHtml).join('') + '</div>';
    }

    root.innerHTML = html;

    document.getElementById('clientes-search').addEventListener('input', function (e) {
      State.setState({ search: e.target.value });
    });
    document.getElementById('clientes-new-btn').addEventListener('click', App.openNewClientWithUnitModal);

    root.querySelectorAll('[data-toggle]').forEach(function (el) {
      el.addEventListener('click', function () {
        const id = el.dataset.toggle;
        if (openIds.has(id)) openIds.delete(id); else openIds.add(id);
        render(root);
      });
    });
    root.querySelectorAll('[data-edit-client]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        App.openClientEditModal(el.dataset.editClient);
      });
    });
    root.querySelectorAll('[data-edit-unit]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        App.openUnitEditModal(el.dataset.editUnit);
      });
    });
  }

  window.DomusViews = window.DomusViews || {};
  window.DomusViews.clientes = render;
})();
