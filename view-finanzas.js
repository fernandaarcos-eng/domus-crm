// view-finanzas.js — REAL Finanzas y Logística module (replaces the old "En
// construcción" placeholder). Ledger entries live on propiedad.finanzas so
// they round-trip through the same flat `leads` table with zero schema change.
(function () {
  'use strict';
  const State = window.DomusState;
  const App = window.DomusApp;

  function num(v) { const n = Number(v); return isNaN(n) ? 0 : n; }

  function allUnitsWithClient() {
    const list = [];
    State.getState().clients.forEach(function (c) {
      (c.propiedades || []).forEach(function (p) { list.push({ client: c, p: p }); });
    });
    return list;
  }

  function statCard(label, value, sub) {
    return '<div class="stat-card"><div class="stat-label">' + App.escapeHtml(label) + '</div>' +
      '<div class="stat-value">' + App.escapeHtml(value) + '</div>' +
      (sub ? '<div class="stat-sub">' + App.escapeHtml(sub) + '</div>' : '') + '</div>';
  }

  function render(root) {
    const units = allUnitsWithClient();
    const activeUnits = units.filter(function (u) { return u.p.stage === 'cliente_activo'; });
    const curMonth = App.currentMonthStr();

    // Current month totals across active units only.
    let curIngreso = 0, curPago = 0, curComision = 0, curCount = 0;
    activeUnits.forEach(function (u) {
      (u.p.finanzas || []).forEach(function (e) {
        if (e.mes === curMonth) {
          curIngreso += num(e.ingreso); curPago += num(e.pago_propietario); curComision += num(e.comision_domus);
          curCount += 1;
        }
      });
    });

    // Trend by month across ALL units (last 12 months present in data, sorted).
    const byMonth = {};
    units.forEach(function (u) {
      (u.p.finanzas || []).forEach(function (e) {
        if (!e.mes) return;
        if (!byMonth[e.mes]) byMonth[e.mes] = { ingreso: 0, pago: 0, comision: 0 };
        byMonth[e.mes].ingreso += num(e.ingreso);
        byMonth[e.mes].pago += num(e.pago_propietario);
        byMonth[e.mes].comision += num(e.comision_domus);
      });
    });
    const months = Object.keys(byMonth).sort().slice(-12);
    const maxIngreso = Math.max.apply(null, months.map(function (m) { return byMonth[m].ingreso; }).concat([1]));

    let html = '<div class="stats">' +
      statCard('Ingreso mes actual (activos)', App.fmtMoney(curIngreso), curMonth) +
      statCard('Pago propietarios (mes actual)', App.fmtMoney(curPago), '') +
      statCard('Comisión Domus (mes actual)', App.fmtMoney(curComision), '') +
      statCard('Unidades activas con registro', curCount + ' / ' + activeUnits.length, 'de ' + activeUnits.length + ' unidades activas') +
      '</div>';

    html += '<div class="card"><div class="subsection-title">Tendencia mensual (ingreso total, todas las unidades)</div>';
    if (!months.length) {
      html += '<div class="text-muted">Aún no hay registros de ledger. Agrega el primer mes desde la tabla de abajo.</div>';
    } else {
      months.forEach(function (m) {
        const v = byMonth[m].ingreso;
        const pct = maxIngreso > 0 ? Math.round((v / maxIngreso) * 100) : 0;
        html += '<div class="bar-row"><div class="bar-label">' + m + '</div><div class="bar-track"><div class="bar-fill" style="width:' + pct + '%"></div></div><div class="bar-value">' + App.fmtMoney(v) + '</div></div>';
      });
    }
    html += '</div>';

    html += '<div class="toolbar"><div class="toolbar-left">' +
      '<div class="search-box">🔎 <input type="text" id="finanzas-search" placeholder="Buscar unidad o cliente…" value="' + App.escapeHtml(State.getState().search || '') + '"></div>' +
      '</div></div>';

    const search = (State.getState().search || '').toLowerCase();
    const filteredUnits = units.filter(function (u) {
      if (!search) return true;
      return (u.client.name || '').toLowerCase().includes(search) || (u.p.address || '').toLowerCase().includes(search);
    });

    html += '<div class="table-wrap"><table><thead><tr><th>Unidad</th><th>Cliente</th><th>Etapa</th><th>Meses registrados</th><th>Último mes</th><th>Ingreso último mes</th><th></th></tr></thead><tbody>';
    if (!filteredUnits.length) {
      html += '<tr><td colspan="7"><div class="empty">Sin resultados</div></td></tr>';
    }
    filteredUnits.forEach(function (u) {
      const entries = (u.p.finanzas || []).slice().sort(function (a, b) { return (a.mes || '').localeCompare(b.mes || ''); });
      const last = entries[entries.length - 1];
      html += '<tr>' +
        '<td>' + App.escapeHtml(u.p.address || ('#' + u.p.id)) + '</td>' +
        '<td>' + App.escapeHtml(u.client.name || '—') + '</td>' +
        '<td>' + (u.p.stage === 'cliente_activo' ? '<span class="badge badge-green">Activo</span>' : '<span class="badge badge-gray">' + App.escapeHtml(u.p.stage) + '</span>') + '</td>' +
        '<td>' + entries.length + '</td>' +
        '<td>' + (last ? last.mes : '—') + '</td>' +
        '<td>' + (last ? App.fmtMoney(last.ingreso) : '—') + '</td>' +
        '<td><button class="btn btn-ghost btn-sm" data-open-ledger="' + u.p.id + '">Ver ledger</button></td>' +
        '</tr>';
    });
    html += '</tbody></table></div>';

    root.innerHTML = html;

    document.getElementById('finanzas-search').addEventListener('input', function (e) { State.setState({ search: e.target.value }); });
    root.querySelectorAll('[data-open-ledger]').forEach(function (btn) {
      btn.addEventListener('click', function () { openLedgerModal(btn.dataset.openLedger); });
    });
  }

  function ledgerRowHtml(e, idx) {
    return '<tr data-idx="' + idx + '">' +
      '<td><input type="month" data-f="mes" value="' + App.escapeHtml(e.mes || '') + '" style="min-width:130px;"></td>' +
      '<td><input type="number" data-f="ingreso" value="' + num(e.ingreso) + '"></td>' +
      '<td><input type="number" data-f="pago_propietario" value="' + num(e.pago_propietario) + '"></td>' +
      '<td><input type="number" data-f="comision_domus" value="' + num(e.comision_domus) + '"></td>' +
      '<td><input type="text" data-f="notas" value="' + App.escapeHtml(e.notas || '') + '"></td>' +
      '<td><button class="btn btn-danger btn-sm" data-del-row="' + idx + '">Eliminar</button></td>' +
      '</tr>';
  }

  function openLedgerModal(propId) {
    const found = State.findPropiedad(propId);
    if (!found) return;
    const p = found.propiedad;
    p.finanzas = p.finanzas || [];

    function bodyHtml() {
      const entries = p.finanzas.slice().sort(function (a, b) { return (a.mes || '').localeCompare(b.mes || ''); });
      let rows = entries.map(ledgerRowHtml).join('');
      return (
        '<div class="modal-header"><div class="modal-title">Ledger financiero — ' + App.escapeHtml(p.address || ('#' + p.id)) + '</div><button class="modal-close" data-close>&times;</button></div>' +
        '<div class="modal-body">' +
        '<div class="table-wrap" style="margin-bottom:14px;"><table><thead><tr><th>Mes</th><th>Ingreso</th><th>Pago propietario</th><th>Comisión Domus</th><th>Notas</th><th></th></tr></thead>' +
        '<tbody id="ledger-tbody">' + (rows || '<tr><td colspan="6"><div class="empty">Sin registros aún.</div></td></tr>') + '</tbody></table></div>' +
        '<button class="btn btn-ghost btn-sm" id="ledger-add-row">+ Agregar mes</button>' +
        '</div>' +
        '<div class="modal-footer"><button class="btn btn-ghost" data-close>Cerrar</button><button class="btn btn-primary" id="ledger-save-btn">Guardar cambios</button></div>'
      );
    }

    const overlay = App.openModal(bodyHtml());
    wire(overlay);

    function wire(overlay) {
      overlay.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', App.closeModal); });
      const addBtn = overlay.querySelector('#ledger-add-row');
      if (addBtn) addBtn.addEventListener('click', function () {
        const entries = p.finanzas.slice().sort(function (a, b) { return (a.mes || '').localeCompare(b.mes || ''); });
        const lastMonth = entries.length ? entries[entries.length - 1].mes : App.currentMonthStr();
        p.finanzas.push({ mes: App.currentMonthStr(), ingreso: 0, pago_propietario: 0, comision_domus: 0, notas: '' });
        const modalDiv = overlay.querySelector('.modal');
        modalDiv.innerHTML = bodyHtml();
        wire(overlay);
      });
      overlay.querySelectorAll('[data-del-row]').forEach(function (b) {
        b.addEventListener('click', function () {
          const idx = Number(b.dataset.delRow);
          const entries = p.finanzas.slice().sort(function (a, b2) { return (a.mes || '').localeCompare(b2.mes || ''); });
          entries.splice(idx, 1);
          p.finanzas = entries;
          const modalDiv = overlay.querySelector('.modal');
          modalDiv.innerHTML = bodyHtml();
          wire(overlay);
        });
      });
      const saveBtn = overlay.querySelector('#ledger-save-btn');
      if (saveBtn) saveBtn.addEventListener('click', function () {
        const trs = overlay.querySelectorAll('#ledger-tbody tr[data-idx]');
        const newEntries = [];
        trs.forEach(function (tr) {
          const entry = {};
          tr.querySelectorAll('[data-f]').forEach(function (inp) {
            const f = inp.dataset.f;
            entry[f] = (f === 'ingreso' || f === 'pago_propietario' || f === 'comision_domus') ? num(inp.value) : inp.value;
          });
          newEntries.push(entry);
        });
        p.finanzas = newEntries;
        App.closeModal();
        State.persistAndNotify();
        App.toast('Ledger actualizado.', 'success');
      });
    }
  }

  window.DomusViews = window.DomusViews || {};
  window.DomusViews.finanzas = render;
})();
