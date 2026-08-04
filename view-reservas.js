// view-reservas.js — REAL Reservas module (replaces the old "En construcción"
// placeholder). Adapted from reservas-reference.html's UI ideas, wired to the
// shared Cliente/Propiedad data. Reservations live on propiedad.reservas so
// they round-trip through the same flat `leads` table with zero schema change.
(function () {
  'use strict';
  const Config = window.DomusConfig;
  const State = window.DomusState;
  const App = window.DomusApp;

  let filters = { estado: '', plataforma: '', unit: '', sortDir: 'asc', onlyToday: false };

  function allUnits() {
    const list = [];
    State.getState().clients.forEach(function (c) { (c.propiedades || []).forEach(function (p) { list.push({ client: c, p: p }); }); });
    return list;
  }

  function allReservations() {
    const list = [];
    allUnits().forEach(function (u) {
      (u.p.reservas || []).forEach(function (r) { list.push({ client: u.client, p: u.p, r: r }); });
    });
    return list;
  }

  function isOccupiedToday(p) {
    const today = App.todayStr();
    return (p.reservas || []).some(function (r) {
      return r.estado !== 'cancelada' && r.checkin <= today && r.checkout > today;
    });
  }

  function estadoBadge(estado) {
    const map = { confirmada: 'badge-blue', en_curso: 'badge-green', finalizada: 'badge-gray', cancelada: 'badge-red' };
    const label = (Config.RESERVA_ESTADOS.find(function (e) { return e.key === estado; }) || {}).label || estado;
    return '<span class="badge ' + (map[estado] || 'badge-gray') + '">' + App.escapeHtml(label) + '</span>';
  }

  function statCard(label, value, sub) {
    return '<div class="stat-card"><div class="stat-label">' + App.escapeHtml(label) + '</div>' +
      '<div class="stat-value">' + App.escapeHtml(String(value)) + '</div>' +
      (sub ? '<div class="stat-sub">' + App.escapeHtml(sub) + '</div>' : '') + '</div>';
  }

  function render(root) {
    const today = App.todayStr();
    const units = allUnits();
    const reservations = allReservations();

    const checkinsHoy = reservations.filter(function (x) { return x.r.checkin === today && x.r.estado !== 'cancelada'; });
    const checkoutsHoy = reservations.filter(function (x) { return x.r.checkout === today && x.r.estado !== 'cancelada'; });
    const enCurso = reservations.filter(function (x) { return x.r.estado === 'en_curso'; });
    const unidadesOcupadas = units.filter(function (u) { return isOccupiedToday(u.p); });

    let html = '<div class="stats">' +
      statCard('Check-ins hoy', checkinsHoy.length, today) +
      statCard('Check-outs hoy', checkoutsHoy.length, today) +
      statCard('Reservas en curso', enCurso.length, '') +
      statCard('Unidades ocupadas hoy', unidadesOcupadas.length + ' / ' + units.length, '') +
      '</div>';

    // --- Check-ins de hoy quick view ---
    html += '<div class="card"><div class="subsection-title">Check-ins de hoy</div>';
    if (!checkinsHoy.length) {
      html += '<div class="text-muted">No hay check-ins programados para hoy.</div>';
    } else {
      html += '<div class="table-wrap"><table><thead><tr><th>Huésped</th><th>Unidad</th><th>Cliente</th><th>Plataforma</th><th>Check-out</th><th>Estado</th></tr></thead><tbody>';
      checkinsHoy.forEach(function (x) {
        html += '<tr><td>' + App.escapeHtml(x.r.huesped || '—') + '</td><td>' + App.escapeHtml(x.p.address || ('#' + x.p.id)) + '</td>' +
          '<td>' + App.escapeHtml(x.client.name || '—') + '</td><td>' + App.escapeHtml(x.r.plataforma || '—') + '</td>' +
          '<td>' + App.fmtDate(x.r.checkout) + '</td><td>' + estadoBadge(x.r.estado) + '</td></tr>';
      });
      html += '</tbody></table></div>';
    }
    html += '</div>';

    // --- Toolbar / filters ---
    const unitOptions = units.map(function (u) {
      return '<option value="' + u.p.id + '"' + (String(filters.unit) === String(u.p.id) ? ' selected' : '') + '>' + App.escapeHtml((u.p.address || ('#' + u.p.id)) + ' — ' + (u.client.name || '')) + '</option>';
    }).join('');

    html += '<div class="toolbar"><div class="toolbar-left">' +
      '<div class="search-box">🔎 <input type="text" id="reservas-search" placeholder="Buscar huésped…" value="' + App.escapeHtml(State.getState().search || '') + '"></div>' +
      '<select class="filter-select" id="filter-estado"><option value="">Todos los estados</option>' +
      Config.RESERVA_ESTADOS.map(function (e) { return '<option value="' + e.key + '"' + (filters.estado === e.key ? ' selected' : '') + '>' + App.escapeHtml(e.label) + '</option>'; }).join('') +
      '</select>' +
      '<select class="filter-select" id="filter-plataforma"><option value="">Todas las plataformas</option>' +
      Config.PLATAFORMAS.map(function (pl) { return '<option value="' + pl + '"' + (filters.plataforma === pl ? ' selected' : '') + '>' + App.escapeHtml(pl) + '</option>'; }).join('') +
      '</select>' +
      '<select class="filter-select" id="filter-unit"><option value="">Todas las unidades</option>' + unitOptions + '</select>' +
      '</div>' +
      '<button class="btn btn-primary" id="reservas-new-btn">+ Nueva reserva</button>' +
      '</div>';

    // --- Main reservations table ---
    const search = (State.getState().search || '').toLowerCase();
    let filtered = reservations.filter(function (x) {
      if (filters.estado && x.r.estado !== filters.estado) return false;
      if (filters.plataforma && x.r.plataforma !== filters.plataforma) return false;
      if (filters.unit && String(x.p.id) !== String(filters.unit)) return false;
      if (search && !(x.r.huesped || '').toLowerCase().includes(search)) return false;
      return true;
    });
    filtered.sort(function (a, b) {
      const cmp = (a.r.checkin || '').localeCompare(b.r.checkin || '');
      return filters.sortDir === 'asc' ? cmp : -cmp;
    });

    html += '<div class="table-wrap"><table><thead><tr>' +
      '<th>Huésped</th><th>Unidad</th><th>Cliente</th><th>Plataforma</th>' +
      '<th style="cursor:pointer;" id="sort-checkin">Check-in ' + (filters.sortDir === 'asc' ? '▲' : '▼') + '</th>' +
      '<th>Check-out</th><th>Estado</th><th></th></tr></thead><tbody>';

    if (!filtered.length) {
      html += '<tr><td colspan="8"><div class="empty">Sin reservas que coincidan.</div></td></tr>';
    }
    filtered.forEach(function (x) {
      html += '<tr>' +
        '<td>' + App.escapeHtml(x.r.huesped || '—') + '</td>' +
        '<td>' + App.escapeHtml(x.p.address || ('#' + x.p.id)) + '</td>' +
        '<td>' + App.escapeHtml(x.client.name || '—') + '</td>' +
        '<td>' + App.escapeHtml(x.r.plataforma || '—') + '</td>' +
        '<td>' + App.fmtDate(x.r.checkin) + '</td>' +
        '<td>' + App.fmtDate(x.r.checkout) + '</td>' +
        '<td>' + estadoBadge(x.r.estado) + '</td>' +
        '<td style="display:flex;gap:6px;">' +
        '<button class="btn btn-ghost btn-sm" data-edit-res="' + x.r.id + '" data-prop="' + x.p.id + '">Editar</button>' +
        (x.r.estado !== 'cancelada' ? '<button class="btn btn-danger btn-sm" data-cancel-res="' + x.r.id + '" data-prop="' + x.p.id + '">Cancelar</button>' : '') +
        '</td>' +
        '</tr>';
    });
    html += '</tbody></table></div>';

    // --- Occupancy indicator per unit ---
    html += '<div class="subsection-title">Ocupación actual por unidad</div><div class="table-wrap"><table><thead><tr><th>Unidad</th><th>Cliente</th><th>Estado hoy</th></tr></thead><tbody>';
    units.forEach(function (u) {
      const occ = isOccupiedToday(u.p);
      html += '<tr><td>' + App.escapeHtml(u.p.address || ('#' + u.p.id)) + '</td><td>' + App.escapeHtml(u.client.name || '—') + '</td>' +
        '<td><span class="occupied-dot ' + (occ ? 'busy' : 'free') + '"></span>' + (occ ? 'Ocupada' : 'Disponible') + '</td></tr>';
    });
    html += '</tbody></table></div>';

    root.innerHTML = html;

    document.getElementById('reservas-search').addEventListener('input', function (e) { State.setState({ search: e.target.value }); });
    document.getElementById('filter-estado').addEventListener('change', function (e) { filters.estado = e.target.value; render(root); });
    document.getElementById('filter-plataforma').addEventListener('change', function (e) { filters.plataforma = e.target.value; render(root); });
    document.getElementById('filter-unit').addEventListener('change', function (e) { filters.unit = e.target.value; render(root); });
    document.getElementById('sort-checkin').addEventListener('click', function () { filters.sortDir = filters.sortDir === 'asc' ? 'desc' : 'asc'; render(root); });
    document.getElementById('reservas-new-btn').addEventListener('click', function () { openReservaModal(null, filters.unit || (units[0] && units[0].p.id)); });

    root.querySelectorAll('[data-edit-res]').forEach(function (btn) {
      btn.addEventListener('click', function () { openReservaModal(btn.dataset.editRes, btn.dataset.prop); });
    });
    root.querySelectorAll('[data-cancel-res]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        App.confirmAction('¿Cancelar esta reserva?', function () {
          const found = State.findPropiedad(btn.dataset.prop);
          if (!found) return;
          const r = (found.propiedad.reservas || []).find(function (rr) { return String(rr.id) === String(btn.dataset.cancelRes); });
          if (r) r.estado = 'cancelada';
          State.persistAndNotify();
          App.toast('Reserva cancelada.', 'success');
        });
      });
    });
  }

  function nextReservaId() {
    let max = 0;
    allReservations().forEach(function (x) {
      const n = Number(x.r.id);
      if (!isNaN(n) && n > max) max = n;
    });
    return max + 1;
  }

  function openReservaModal(resId, propId) {
    const units = allUnits();
    const found = State.findPropiedad(propId);
    const isNew = !resId;
    const p = found ? found.propiedad : null;
    const existing = (!isNew && p) ? (p.reservas || []).find(function (r) { return String(r.id) === String(resId); }) : null;
    const r = existing || { id: null, huesped: '', plataforma: 'Airbnb', checkin: App.todayStr(), checkout: App.todayStr(), estado: 'confirmada', notas: '' };

    const unitOptions = units.map(function (u) {
      return '<option value="' + u.p.id + '"' + (String(u.p.id) === String(propId) ? ' selected' : '') + '>' + App.escapeHtml((u.p.address || ('#' + u.p.id)) + ' — ' + (u.client.name || '')) + '</option>';
    }).join('');
    const plataformaOptions = Config.PLATAFORMAS.map(function (pl) {
      return '<option value="' + pl + '"' + (r.plataforma === pl ? ' selected' : '') + '>' + App.escapeHtml(pl) + '</option>';
    }).join('');
    const estadoOptions = Config.RESERVA_ESTADOS.map(function (e) {
      return '<option value="' + e.key + '"' + (r.estado === e.key ? ' selected' : '') + '>' + App.escapeHtml(e.label) + '</option>';
    }).join('');

    const html =
      '<div class="modal-header"><div class="modal-title">' + (isNew ? 'Nueva reserva' : 'Editar reserva') + '</div><button class="modal-close" data-close>&times;</button></div>' +
      '<div class="modal-body"><div class="form-grid">' +
      '<div class="form-group full"><label>Unidad</label><select id="res-unit">' + unitOptions + '</select></div>' +
      '<div class="form-group full"><label>Huésped</label><input type="text" id="res-huesped" value="' + App.escapeHtml(r.huesped || '') + '"></div>' +
      '<div class="form-group"><label>Plataforma</label><select id="res-plataforma">' + plataformaOptions + '</select></div>' +
      '<div class="form-group"><label>Estado</label><select id="res-estado">' + estadoOptions + '</select></div>' +
      '<div class="form-group"><label>Check-in</label><input type="date" id="res-checkin" value="' + App.escapeHtml(r.checkin || '') + '"></div>' +
      '<div class="form-group"><label>Check-out</label><input type="date" id="res-checkout" value="' + App.escapeHtml(r.checkout || '') + '"></div>' +
      '<div class="form-group full"><label>Notas</label><textarea id="res-notas">' + App.escapeHtml(r.notas || '') + '</textarea></div>' +
      '</div></div>' +
      '<div class="modal-footer"><button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary" id="res-save-btn">Guardar</button></div>';

    const overlay = App.openModal(html);
    overlay.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', App.closeModal); });
    overlay.querySelector('#res-save-btn').addEventListener('click', function () {
      const newUnitId = document.getElementById('res-unit').value;
      const checkin = document.getElementById('res-checkin').value;
      const checkout = document.getElementById('res-checkout').value;
      if (!checkin || !checkout || checkout < checkin) {
        App.toast('Revisa las fechas: check-out debe ser igual o posterior al check-in.', 'error');
        return;
      }
      const data = {
        id: r.id != null ? r.id : nextReservaId(),
        huesped: document.getElementById('res-huesped').value.trim(),
        plataforma: document.getElementById('res-plataforma').value,
        estado: document.getElementById('res-estado').value,
        checkin: checkin,
        checkout: checkout,
        notas: document.getElementById('res-notas').value,
      };

      // Remove from old unit if it existed there and the unit changed.
      if (!isNew && found) {
        found.propiedad.reservas = (found.propiedad.reservas || []).filter(function (rr) { return String(rr.id) !== String(r.id); });
      }
      const targetFound = State.findPropiedad(newUnitId);
      if (!targetFound) { App.toast('Unidad no encontrada.', 'error'); return; }
      targetFound.propiedad.reservas = targetFound.propiedad.reservas || [];
      targetFound.propiedad.reservas.push(data);

      App.closeModal();
      State.persistAndNotify();
      App.toast(isNew ? 'Reserva creada.' : 'Reserva actualizada.', 'success');
    });
  }

  window.DomusViews = window.DomusViews || {};
  window.DomusViews.reservas = render;
})();
