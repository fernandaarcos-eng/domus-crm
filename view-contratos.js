// view-contratos.js — "Contratos y Pagos" module. Surfaces contract Drive
// links / uploaded contract files and bank-account / payment info that
// already round-trips through the flat `leads` rows (see PROPIEDAD_DEFAULTS
// in data.js) but previously had no UI anywhere.
(function () {
  'use strict';
  const Config = window.DomusConfig;
  const State = window.DomusState;
  const App = window.DomusApp;

  const CUENTA_TIPOS = ['Cuenta Corriente', 'Cuenta Vista', 'Cuenta de Ahorro', 'Otro'];

  let filters = { search: '', onlyMissing: false };

  function allUnits() {
    const list = [];
    State.getState().clients.forEach(function (c) {
      (c.propiedades || []).forEach(function (p) { list.push({ client: c, p: p }); });
    });
    return list;
  }

  function fmtBytes(n) {
    n = Number(n) || 0;
    if (!n) return '—';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / (1024 * 1024)).toFixed(1) + ' MB';
  }

  // Returns the list of bank accounts to show for a unit: the current array
  // format if it has entries, otherwise a single account synthesized from the
  // legacy cuenta_* fields (if any of them is filled in), for display only.
  function getAccounts(p) {
    if (Array.isArray(p.cuentas_cliente) && p.cuentas_cliente.length) return p.cuentas_cliente;
    const legacy = {
      banco: p.cuenta_banco || '', email: p.cuenta_email || '', numero: p.cuenta_numero || '',
      rut: p.cuenta_rut || '', tipo: p.cuenta_tipo || '', titular: p.cuenta_titular || '',
    };
    const hasLegacy = Object.keys(legacy).some(function (k) { return legacy[k]; });
    if (!hasLegacy) return [];
    return [Object.assign({ id: '', nombre: 'Cuenta', notas: '', deptos_ids: [], __legacy: true }, legacy)];
  }

  function amobApplies(p) { return p.tipo_contrato === 'admin_amob'; }
  function hasAdminContract(p) { return !!(p.contrato_admin_depto && p.contrato_admin_depto.driveUrl); }
  function hasAmobContract(p) { return !!(p.contrato_amob_depto && p.contrato_amob_depto.driveUrl); }
  function hasAccount(p) { return getAccounts(p).length > 0; }

  function isMissingSomething(p) {
    if (!hasAdminContract(p)) return true;
    if (amobApplies(p) && !hasAmobContract(p)) return true;
    if (!hasAccount(p)) return true;
    return false;
  }

  function badgeContratoAdmin(p) {
    if (hasAdminContract(p)) {
      return '<a class="badge badge-green" href="' + App.escapeHtml(p.contrato_admin_depto.driveUrl) + '" target="_blank" rel="noopener">✓ Ver</a>';
    }
    if (p.contrato_admin_cliente) return '<span class="badge badge-amber">Archivo subido</span>';
    return '<span class="badge badge-red">Falta</span>';
  }

  function badgeContratoAmob(p) {
    if (!amobApplies(p)) return '<span class="badge badge-gray">No aplica</span>';
    if (hasAmobContract(p)) {
      return '<a class="badge badge-green" href="' + App.escapeHtml(p.contrato_amob_depto.driveUrl) + '" target="_blank" rel="noopener">✓ Ver</a>';
    }
    return '<span class="badge badge-red">Falta</span>';
  }

  function badgeCuenta(p) {
    return hasAccount(p) ? '<span class="badge badge-green">✓</span>' : '<span class="badge badge-red">Falta</span>';
  }

  function statCard(label, value, sub) {
    return '<div class="stat-card"><div class="stat-label">' + App.escapeHtml(label) + '</div>' +
      '<div class="stat-value">' + App.escapeHtml(String(value)) + '</div>' +
      (sub ? '<div class="stat-sub">' + App.escapeHtml(sub) + '</div>' : '') + '</div>';
  }

  function unitField(label, value) {
    const has = value != null && String(value).trim() !== '';
    return '<div class="unit-field"><span class="unit-field-label">' + App.escapeHtml(label) + '</span>' +
      '<span class="unit-field-value' + (has ? '' : ' empty-val') + '">' + (has ? App.escapeHtml(value) : 'Sin datos') + '</span></div>';
  }

  function render(root) {
    const units = allUnits();
    const totalAdmin = units.filter(function (u) { return hasAdminContract(u.p); }).length;
    const totalCuenta = units.filter(function (u) { return hasAccount(u.p); }).length;
    const totalMissing = units.filter(function (u) { return isMissingSomething(u.p); }).length;

    let html = '<div class="stats">' +
      statCard('Unidades', units.length, '') +
      statCard('Con contrato admin', totalAdmin + ' / ' + units.length, '') +
      statCard('Con cuenta de pago', totalCuenta + ' / ' + units.length, '') +
      statCard('Con algo faltante', totalMissing, 'contrato o cuenta pendiente') +
      '</div>';

    html += '<div class="toolbar"><div class="toolbar-left">' +
      '<div class="search-box">🔎 <input type="text" id="contratos-search" placeholder="Buscar cliente o dirección…" value="' + App.escapeHtml(filters.search) + '"></div>' +
      '<label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text2);"><input type="checkbox" id="contratos-only-missing" style="width:auto;"' + (filters.onlyMissing ? ' checked' : '') + '> Solo con contrato/cuenta faltante</label>' +
      '</div></div>';

    const search = filters.search.toLowerCase();
    let filtered = units.filter(function (u) {
      if (search && !((u.client.name || '').toLowerCase().includes(search) || (u.p.address || '').toLowerCase().includes(search))) return false;
      if (filters.onlyMissing && !isMissingSomething(u.p)) return false;
      return true;
    });

    html += '<div class="table-wrap"><table><thead><tr>' +
      '<th>Cliente</th><th>Dirección</th><th>Tipo de contrato</th>' +
      '<th>Contrato admin</th><th>Contrato amoblado</th><th>Cuenta de pago</th><th></th>' +
      '</tr></thead><tbody>';

    if (!filtered.length) {
      html += '<tr><td colspan="7"><div class="empty">Sin resultados</div></td></tr>';
    }
    filtered.forEach(function (u) {
      const tipoLabel = Config.TIPO_CONTRATO_LABELS[u.p.tipo_contrato] || u.p.tipo_contrato;
      html += '<tr data-row-prop="' + u.p.id + '" style="cursor:pointer;">' +
        '<td>' + App.escapeHtml(u.client.name || '—') + '</td>' +
        '<td>' + App.escapeHtml(u.p.address || ('#' + u.p.id)) + '</td>' +
        '<td>' + App.escapeHtml(tipoLabel) + '</td>' +
        '<td>' + badgeContratoAdmin(u.p) + '</td>' +
        '<td>' + badgeContratoAmob(u.p) + '</td>' +
        '<td>' + badgeCuenta(u.p) + '</td>' +
        '<td><button class="btn btn-ghost btn-sm" data-detalle="' + u.p.id + '">Ver detalle</button></td>' +
        '</tr>';
    });
    html += '</tbody></table></div>';

    root.innerHTML = html;

    document.getElementById('contratos-search').addEventListener('input', function (e) {
      filters.search = e.target.value; render(root);
    });
    document.getElementById('contratos-only-missing').addEventListener('change', function (e) {
      filters.onlyMissing = e.target.checked; render(root);
    });
    root.querySelectorAll('[data-detalle]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        openDetalleModal(btn.dataset.detalle);
      });
    });
    root.querySelectorAll('[data-row-prop]').forEach(function (tr) {
      tr.addEventListener('click', function (e) {
        // Don't double-trigger when the link/button inside the row was clicked.
        if (e.target.closest('a') || e.target.closest('button')) return;
        openDetalleModal(tr.dataset.rowProp);
      });
    });
  }

  // ---------- detail modal ----------

  function contratoCardHtml(p, field, label, applicable) {
    if (!applicable) {
      return '<div class="card"><div class="subsection-title">' + App.escapeHtml(label) + '</div>' +
        '<div class="text-muted">No aplica para este tipo de contrato.</div></div>';
    }
    const c = p[field];
    let body;
    if (c && c.driveUrl) {
      body = '<div class="unit-grid">' + unitField('Fecha', c.fecha) + unitField('Nombre', c.nombre) + '</div>' +
        '<p><a href="' + App.escapeHtml(c.driveUrl) + '" target="_blank" rel="noopener">Ver contrato en Drive</a></p>';
    } else if (field === 'contrato_admin_depto' && p.contrato_admin_cliente) {
      const f = p.contrato_admin_cliente;
      body = '<div class="text-muted">Archivo subido directamente (sin link de Drive):</div>' +
        '<div class="unit-grid">' + unitField('Archivo', f.name) + unitField('Tamaño', fmtBytes(f.size)) + unitField('Fecha', f.fecha) + '</div>';
    } else {
      body = '<div class="text-muted">Sin contrato registrado.</div>';
    }
    return '<div class="card"><div class="subsection-title">' + App.escapeHtml(label) + '</div>' + body +
      '<button class="btn btn-ghost btn-sm" data-edit-contrato="' + field + '" data-prop="' + p.id + '">Editar</button></div>';
  }

  function cuentaCardHtml(p, a) {
    return '<div class="card">' +
      '<div class="subsection-title">' + App.escapeHtml(a.nombre || 'Cuenta') + (a.__legacy ? ' <span class="badge badge-gray">formato antiguo</span>' : '') + '</div>' +
      '<div class="unit-grid">' +
      unitField('Banco', a.banco) + unitField('Tipo', a.tipo) + unitField('Número', a.numero) +
      unitField('RUT', a.rut) + unitField('Titular', a.titular) + unitField('Email', a.email) +
      unitField('Notas', a.notas) +
      '</div>' +
      '<button class="btn btn-ghost btn-sm" data-edit-cuenta="' + App.escapeHtml(a.__legacy ? '' : (a.id || '')) + '" data-prop="' + p.id + '">Editar</button>' +
      '</div>';
  }

  function pagoAmobCardHtml(pa) {
    const comprobantes = pa.comprobantes || [];
    return '<div class="card">' +
      '<div><b>' + App.fmtDate(pa.fecha) + '</b> — ' + App.escapeHtml(pa.monto || '') + '</div>' +
      (pa.notas ? '<div class="text-muted">' + App.escapeHtml(pa.notas) + '</div>' : '') +
      (comprobantes.length
        ? '<ul style="margin:8px 0 0 18px;padding:0;">' + comprobantes.map(function (c) {
            return '<li>' + App.escapeHtml(c.name || 'Comprobante') + ' (' + fmtBytes(c.size) + ')</li>';
          }).join('') + '</ul>'
        : '') +
      '</div>';
  }

  function detalleBodyHtml(p, client) {
    let html = '<div class="modal-header"><div class="modal-title">Contratos y pagos — ' +
      App.escapeHtml(p.address || ('#' + p.id)) + ' · ' + App.escapeHtml(client.name || '') +
      '</div><button class="modal-close" data-close>&times;</button></div><div class="modal-body">';

    html += '<div class="subsection-title">Contratos</div>';
    html += contratoCardHtml(p, 'contrato_admin_depto', 'Contrato de Administración', true);
    html += contratoCardHtml(p, 'contrato_amob_depto', 'Contrato de Amoblado', amobApplies(p));

    html += '<div class="subsection-title">Cuentas de pago</div>';
    const accounts = getAccounts(p);
    if (!accounts.length) {
      html += '<div class="text-muted" style="margin-bottom:10px;">Sin cuenta de pago registrada.</div>';
    } else {
      accounts.forEach(function (a) { html += cuentaCardHtml(p, a); });
    }
    html += '<button class="btn btn-ghost btn-sm" id="detalle-add-cuenta" data-prop="' + p.id + '">+ Agregar cuenta</button>';

    if (p.monto_pagado) {
      html += '<div class="subsection-title">Monto pagado</div><div class="card">' + App.escapeHtml(p.monto_pagado) + '</div>';
    }

    if ((p.pagos_amob || []).length) {
      html += '<div class="subsection-title">Pagos de amoblado</div>';
      p.pagos_amob.forEach(function (pa) { html += pagoAmobCardHtml(pa); });
    }

    html += '</div><div class="modal-footer"><button class="btn btn-ghost" data-close>Cerrar</button></div>';
    return html;
  }

  function openDetalleModal(propId) {
    const found = State.findPropiedad(propId);
    if (!found) return;
    const p = found.propiedad;
    const client = found.client;
    const overlay = App.openModal(detalleBodyHtml(p, client));
    wireDetalle(overlay, propId);
  }

  function wireDetalle(overlay, propId) {
    overlay.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', App.closeModal); });
    overlay.querySelectorAll('[data-edit-contrato]').forEach(function (b) {
      b.addEventListener('click', function () { openContratoEditModal(b.dataset.prop, b.dataset.editContrato); });
    });
    overlay.querySelectorAll('[data-edit-cuenta]').forEach(function (b) {
      b.addEventListener('click', function () { openCuentaEditModal(b.dataset.prop, b.dataset.editCuenta); });
    });
    const addBtn = overlay.querySelector('#detalle-add-cuenta');
    if (addBtn) addBtn.addEventListener('click', function () { openCuentaEditModal(addBtn.dataset.prop, ''); });
  }

  // ---------- edit: contract (fecha, nombre, driveUrl) ----------

  function openContratoEditModal(propId, field) {
    const found = State.findPropiedad(propId);
    if (!found) return;
    const p = found.propiedad;
    const existing = p[field] || {};
    const label = field === 'contrato_admin_depto' ? 'Contrato de Administración' : 'Contrato de Amoblado';

    const html =
      '<div class="modal-header"><div class="modal-title">Editar ' + App.escapeHtml(label) + '</div><button class="modal-close" data-close>&times;</button></div>' +
      '<div class="modal-body"><div class="form-grid">' +
      '<div class="form-group"><label>Fecha</label><input type="text" id="ct-fecha" placeholder="DD-MM-AAAA" value="' + App.escapeHtml(existing.fecha || '') + '"></div>' +
      '<div class="form-group"><label>Nombre</label><input type="text" id="ct-nombre" value="' + App.escapeHtml(existing.nombre || label) + '"></div>' +
      '<div class="form-group full"><label>Link de Google Drive</label><input type="text" id="ct-driveurl" placeholder="https://drive.google.com/file/d/…/view" value="' + App.escapeHtml(existing.driveUrl || '') + '"></div>' +
      '</div></div>' +
      '<div class="modal-footer"><button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary" id="ct-save-btn">Guardar</button></div>';

    const overlay = App.openModal(html);
    overlay.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', App.closeModal); });
    overlay.querySelector('#ct-save-btn').addEventListener('click', function () {
      const driveUrl = document.getElementById('ct-driveurl').value.trim();
      const fecha = document.getElementById('ct-fecha').value.trim();
      const nombre = document.getElementById('ct-nombre').value.trim() || label;
      p[field] = {
        fecha: fecha,
        nombre: nombre,
        driveId: existing.driveId || '',
        driveUrl: driveUrl,
        creadoPor: existing.creadoPor || '',
      };
      App.closeModal();
      State.persistAndNotify();
      App.toast('Contrato actualizado.', 'success');
      openDetalleModal(propId);
    });
  }

  // ---------- edit: bank account ----------

  function openCuentaEditModal(propId, accountId) {
    const found = State.findPropiedad(propId);
    if (!found) return;
    const p = found.propiedad;
    p.cuentas_cliente = Array.isArray(p.cuentas_cliente) ? p.cuentas_cliente : [];

    let existing = null;
    if (accountId) existing = p.cuentas_cliente.find(function (a) { return String(a.id) === String(accountId); });
    if (!existing) {
      // Fall back to the synthesized legacy account (if any) so editing it
      // pre-fills the form, but saving always writes into cuentas_cliente.
      const legacy = getAccounts(p).find(function (a) { return a.__legacy; });
      if (legacy) existing = legacy;
    }
    existing = existing || {
      id: '', rut: '', tipo: CUENTA_TIPOS[0], banco: '', email: '', notas: '',
      nombre: 'Cuenta ' + (p.cuentas_cliente.length + 1), numero: '', titular: '', deptos_ids: [],
    };

    const tipoOptions = CUENTA_TIPOS.map(function (t) {
      return '<option value="' + t + '"' + (existing.tipo === t ? ' selected' : '') + '>' + t + '</option>';
    }).join('');

    const html =
      '<div class="modal-header"><div class="modal-title">' + (accountId ? 'Editar cuenta' : 'Agregar cuenta') + '</div><button class="modal-close" data-close>&times;</button></div>' +
      '<div class="modal-body"><div class="form-grid">' +
      '<div class="form-group full"><label>Nombre (referencia interna)</label><input type="text" id="cu-nombre" value="' + App.escapeHtml(existing.nombre || '') + '"></div>' +
      '<div class="form-group"><label>Banco</label><input type="text" id="cu-banco" value="' + App.escapeHtml(existing.banco || '') + '"></div>' +
      '<div class="form-group"><label>Tipo</label><select id="cu-tipo">' + tipoOptions + '</select></div>' +
      '<div class="form-group"><label>Número de cuenta</label><input type="text" id="cu-numero" value="' + App.escapeHtml(existing.numero || '') + '"></div>' +
      '<div class="form-group"><label>RUT</label><input type="text" id="cu-rut" value="' + App.escapeHtml(existing.rut || '') + '"></div>' +
      '<div class="form-group full"><label>Titular</label><input type="text" id="cu-titular" value="' + App.escapeHtml(existing.titular || '') + '"></div>' +
      '<div class="form-group full"><label>Email</label><input type="email" id="cu-email" value="' + App.escapeHtml(existing.email || '') + '"></div>' +
      '<div class="form-group full"><label>Notas</label><textarea id="cu-notas">' + App.escapeHtml(existing.notas || '') + '</textarea></div>' +
      '</div></div>' +
      '<div class="modal-footer"><button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary" id="cu-save-btn">Guardar</button></div>';

    const overlay = App.openModal(html);
    overlay.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', App.closeModal); });
    overlay.querySelector('#cu-save-btn').addEventListener('click', function () {
      const isNewId = !existing.id || existing.__legacy;
      const data = {
        id: isNewId ? ('cta_' + Date.now() + '_' + Math.floor(Math.random() * 10000)) : existing.id,
        rut: document.getElementById('cu-rut').value.trim(),
        tipo: document.getElementById('cu-tipo').value,
        banco: document.getElementById('cu-banco').value.trim(),
        email: document.getElementById('cu-email').value.trim(),
        notas: document.getElementById('cu-notas').value,
        nombre: document.getElementById('cu-nombre').value.trim() || 'Cuenta',
        numero: document.getElementById('cu-numero').value.trim(),
        titular: document.getElementById('cu-titular').value.trim(),
        deptos_ids: existing.deptos_ids || [],
      };
      const idx = p.cuentas_cliente.findIndex(function (a) { return String(a.id) === String(data.id); });
      if (idx !== -1) p.cuentas_cliente[idx] = data; else p.cuentas_cliente.push(data);
      App.closeModal();
      State.persistAndNotify();
      App.toast(accountId ? 'Cuenta actualizada.' : 'Cuenta agregada.', 'success');
      openDetalleModal(propId);
    });
  }

  window.DomusViews = window.DomusViews || {};
  window.DomusViews.contratos = render;
})();
