// view-cotizador.js — Cotizador de Amoblados: calcula el costo de amoblar una
// unidad (precio de lista, descuento vigente, descuento Cyber por nivel, IVA
// opcional) y permite guardar la cotización en el historial de la unidad
// (mismo formato que las cotizaciones ya existentes en la base de datos:
// id, fecha, tipologia, tipologiaLabel, estilo, config, subtotal, total,
// ahorro, paraNombre, paraEmail). Nota: la versión anterior del cotizador
// permitía desmarcar ítems individuales del catálogo de muebles; ninguna de
// las cotizaciones reales guardadas usa esa opción, así que se dejó fuera
// para mantener esto simple.
(function () {
  'use strict';
  const Config = window.DomusConfig;
  const State = window.DomusState;
  const App = window.DomusApp;

  let cfg = {
    tipologia: 'studio',
    estilo: 'nordico',
    incluirAmoblado: true,
    incluirAdicionales: false,
    incluirAire: false,
    conIva: false,
    descuentoNivel: 0,
    targetPropId: '',
    paraNombre: '',
    paraEmail: '',
  };

  function findTipologia(key) {
    return Config.TIPOLOGIAS_AMOB.find(function (t) { return t.key === key; }) || Config.TIPOLOGIAS_AMOB[0];
  }

  function calcTotales() {
    const tpl = findTipologia(cfg.tipologia);
    let lista = 0, dscto = 0;
    if (cfg.incluirAmoblado) { lista += tpl.amobFull; dscto += tpl.amobDscto; }
    if (cfg.incluirAdicionales) { lista += tpl.adicLista; dscto += tpl.adicDscto; }
    if (cfg.incluirAire) { lista += Config.AIRE_COSTO_AMOB; dscto += Config.AIRE_COSTO_AMOB; }
    const nivel = cfg.descuentoNivel || 0;
    const descuentoCyber = nivel > 0 ? Math.round(dscto * (nivel / 100)) : 0;
    const subtotal = Math.max(0, dscto - descuentoCyber);
    const iva = cfg.conIva ? Math.round(subtotal * (Config.IVA_PCT_AMOB / 100)) : 0;
    const total = subtotal + iva;
    const ahorro = Math.max(0, lista - subtotal);
    return { tpl: tpl, lista: lista, dscto: dscto, descuentoCyber: descuentoCyber, subtotal: subtotal, iva: iva, total: total, ahorro: ahorro };
  }

  function allUnitsGrouped() {
    return State.getState().clients;
  }

  function getSelectedPropiedad() {
    if (!cfg.targetPropId) return null;
    const found = State.findPropiedad(cfg.targetPropId);
    return found ? found : null;
  }

  function chipBtn(active, label, dataAttr, dataVal) {
    return '<button type="button" class="btn btn-sm" data-' + dataAttr + '="' + App.escapeHtml(dataVal) + '" style="border:2px solid ' +
      (active ? 'var(--accent)' : 'var(--border)') + ';background:' + (active ? 'var(--accent)' : 'var(--surface)') +
      ';color:' + (active ? '#fff' : 'var(--text2)') + ';border-radius:20px;font-weight:700;margin:0 6px 6px 0;">' +
      App.escapeHtml(label) + '</button>';
  }

  function unitSelectHtml() {
    const clients = allUnitsGrouped();
    let html = '<select id="cotiz-unit-select"><option value="">— Cotización libre (sin unidad) —</option>';
    clients.forEach(function (c) {
      if (!(c.propiedades || []).length) return;
      html += '<optgroup label="' + App.escapeHtml(c.name || 'Sin nombre') + '">';
      c.propiedades.forEach(function (p) {
        html += '<option value="' + App.escapeHtml(p.id) + '"' + (String(p.id) === String(cfg.targetPropId) ? ' selected' : '') + '>' +
          App.escapeHtml(p.address || ('Unidad #' + p.id)) + '</option>';
      });
      html += '</optgroup>';
    });
    html += '</select>';
    return html;
  }

  function historialHtml(p) {
    const cot = (p.cotizaciones || []).slice().sort(function (a, b) { return (b.fecha || '').localeCompare(a.fecha || ''); });
    if (!cot.length) return '<div class="text-muted">Sin cotizaciones guardadas para esta unidad.</div>';
    return cot.map(function (c) {
      const nivel = c.config && c.config.descuentoNivel ? c.config.descuentoNivel : 0;
      return '<div class="card" style="display:flex;justify-content:space-between;align-items:center;gap:10px;">' +
        '<div>' +
        '<div style="font-weight:700;">' + App.escapeHtml(c.tipologiaLabel || c.tipologia || 'Cotización') + ' · ' + App.escapeHtml(c.estilo || '—') + '</div>' +
        '<div class="text-muted" style="font-size:12px;">' + App.escapeHtml(c.fechaStr || '') + (nivel ? ' · Cyber ' + nivel + '%' : '') +
        (c.paraNombre ? ' · Para: ' + App.escapeHtml(c.paraNombre) : '') + '</div>' +
        '</div>' +
        '<div style="text-align:right;white-space:nowrap;">' +
        '<div style="font-weight:800;">' + App.fmtMoney(c.total) + '</div>' +
        (c.ahorro ? '<div class="text-muted" style="font-size:11px;">Ahorro ' + App.fmtMoney(c.ahorro) + '</div>' : '') +
        '</div>' +
        '<button class="btn btn-ghost btn-sm" data-del-cotiz="' + App.escapeHtml(c.id) + '">Eliminar</button>' +
        '</div>';
    }).join('');
  }

  function render(root) {
    const t = calcTotales();
    const selected = getSelectedPropiedad();

    let html = '<div class="toolbar"><div class="toolbar-left">' +
      '<span class="text-muted" style="font-size:12px;">Calcula el costo de amoblar una unidad y guarda la cotización en su historial.</span>' +
      '</div></div>';

    html += '<div style="display:grid;grid-template-columns:1.1fr 1fr;gap:16px;align-items:start;">';

    // ---- Left: configuration card ----
    html += '<div class="card">';
    html += '<div class="subsection-title">Unidad / destinatario</div>';
    html += '<div class="form-grid">' +
      '<div class="form-group full"><label>Unidad</label>' + unitSelectHtml() + '</div>' +
      '<div class="form-group"><label>Para (nombre)</label><input type="text" id="cotiz-para-nombre" value="' + App.escapeHtml(cfg.paraNombre) + '"></div>' +
      '<div class="form-group"><label>Para (correo)</label><input type="email" id="cotiz-para-email" value="' + App.escapeHtml(cfg.paraEmail) + '"></div>' +
      '</div>';

    html += '<div class="subsection-title">Tipología</div><div>' +
      Config.TIPOLOGIAS_AMOB.map(function (tp) {
        return chipBtn(cfg.tipologia === tp.key, tp.emoji + ' ' + tp.label, 'set-tipologia', tp.key);
      }).join('') + '</div>';

    html += '<div class="subsection-title">Estilo</div><div>' +
      Config.ESTILOS_AMOB.map(function (e) {
        return chipBtn(cfg.estilo === e.key, e.emoji + ' ' + e.label, 'set-estilo', e.key);
      }).join('') + '</div>';

    html += '<div class="subsection-title">Opciones</div>';
    html += '<label style="display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer;">' +
      '<input type="checkbox" id="cotiz-opt-amoblado"' + (cfg.incluirAmoblado ? ' checked' : '') + ' style="width:auto;"> 🛋️ Amoblado completo</label>';
    html += '<label style="display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer;">' +
      '<input type="checkbox" id="cotiz-opt-adicionales"' + (cfg.incluirAdicionales ? ' checked' : '') + ' style="width:auto;"> ➕ Adicionales (cortinas, chapa electrónica, luminarias, estacionamiento)</label>';
    html += '<label style="display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer;">' +
      '<input type="checkbox" id="cotiz-opt-aire"' + (cfg.incluirAire ? ' checked' : '') + ' style="width:auto;"> ❄️ Aire acondicionado</label>';
    html += '<label style="display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer;">' +
      '<input type="checkbox" id="cotiz-opt-iva"' + (cfg.conIva ? ' checked' : '') + ' style="width:auto;"> 🧾 Incluir IVA (' + Config.IVA_PCT_AMOB + '%)</label>';

    html += '<div class="subsection-title">Descuento Cyber</div><div>' +
      Config.DESCUENTO_NIVELES_AMOB.map(function (n) {
        return chipBtn(cfg.descuentoNivel === n, n === 0 ? 'Sin descuento' : 'Cyber ' + n + '%', 'set-nivel', n);
      }).join('') + '</div>';

    html += '</div>'; // end left card

    // ---- Right: totals + save ----
    html += '<div class="card">';
    html += '<div class="subsection-title">Resumen</div>';
    html += '<table style="width:100%;border-collapse:collapse;font-size:13px;">' +
      '<tr><td style="padding:6px 0;">Precio de lista</td><td style="padding:6px 0;text-align:right;">' + App.fmtMoney(t.lista) + '</td></tr>' +
      (t.lista !== t.dscto ? '<tr><td style="padding:6px 0;">Precio con descuento vigente</td><td style="padding:6px 0;text-align:right;">' + App.fmtMoney(t.dscto) + '</td></tr>' : '') +
      (t.descuentoCyber ? '<tr><td style="padding:6px 0;color:var(--green-dark);">Descuento Cyber (' + cfg.descuentoNivel + '%)</td><td style="padding:6px 0;text-align:right;color:var(--green-dark);">-' + App.fmtMoney(t.descuentoCyber) + '</td></tr>' : '') +
      '<tr><td style="padding:6px 0;font-weight:700;border-top:1px solid var(--border);">Subtotal</td><td style="padding:6px 0;text-align:right;font-weight:700;border-top:1px solid var(--border);">' + App.fmtMoney(t.subtotal) + '</td></tr>' +
      (cfg.conIva ? '<tr><td style="padding:6px 0;">IVA (' + Config.IVA_PCT_AMOB + '%)</td><td style="padding:6px 0;text-align:right;">' + App.fmtMoney(t.iva) + '</td></tr>' : '') +
      '<tr><td style="padding:10px 0;font-weight:900;font-size:16px;color:var(--accent-dark);border-top:2px solid var(--accent);">TOTAL</td><td style="padding:10px 0;text-align:right;font-weight:900;font-size:18px;color:var(--accent-dark);border-top:2px solid var(--accent);">' + App.fmtMoney(t.total) + '</td></tr>' +
      (t.ahorro ? '<tr><td colspan="2" style="padding:6px 0;color:var(--green-dark);font-size:12px;">🎉 Ahorro vs. precio de lista: ' + App.fmtMoney(t.ahorro) + '</td></tr>' : '') +
      '</table>';

    html += '<div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap;">' +
      '<button class="btn btn-primary" id="cotiz-save-btn"' + (selected ? '' : ' disabled title="Selecciona una unidad para guardar"') + '>Guardar cotización</button>' +
      '<button class="btn btn-ghost" id="cotiz-copy-btn">Copiar resumen</button>' +
      '</div>';
    if (!selected) {
      html += '<div class="text-muted" style="font-size:12px;margin-top:8px;">Selecciona una unidad arriba para poder guardar esta cotización en su historial.</div>';
    }

    html += '</div>'; // end right card
    html += '</div>'; // end grid

    // ---- History ----
    html += '<div class="subsection-title">Historial de cotizaciones' + (selected ? ' — ' + App.escapeHtml(selected.propiedad.address || ('#' + selected.propiedad.id)) : '') + '</div>';
    if (selected) {
      html += historialHtml(selected.propiedad);
    } else {
      html += '<div class="text-muted">Selecciona una unidad para ver su historial de cotizaciones.</div>';
    }

    root.innerHTML = html;
    wire(root);
  }

  function wire(root) {
    root.querySelectorAll('[data-set-tipologia]').forEach(function (b) {
      b.addEventListener('click', function () { cfg.tipologia = b.dataset.setTipologia; render(root); });
    });
    root.querySelectorAll('[data-set-estilo]').forEach(function (b) {
      b.addEventListener('click', function () { cfg.estilo = b.dataset.setEstilo; render(root); });
    });
    root.querySelectorAll('[data-set-nivel]').forEach(function (b) {
      b.addEventListener('click', function () { cfg.descuentoNivel = parseInt(b.dataset.setNivel, 10) || 0; render(root); });
    });
    const optAmoblado = root.querySelector('#cotiz-opt-amoblado');
    if (optAmoblado) optAmoblado.addEventListener('change', function (e) { cfg.incluirAmoblado = e.target.checked; render(root); });
    const optAdicionales = root.querySelector('#cotiz-opt-adicionales');
    if (optAdicionales) optAdicionales.addEventListener('change', function (e) { cfg.incluirAdicionales = e.target.checked; render(root); });
    const optAire = root.querySelector('#cotiz-opt-aire');
    if (optAire) optAire.addEventListener('change', function (e) { cfg.incluirAire = e.target.checked; render(root); });
    const optIva = root.querySelector('#cotiz-opt-iva');
    if (optIva) optIva.addEventListener('change', function (e) { cfg.conIva = e.target.checked; render(root); });

    const unitSelect = root.querySelector('#cotiz-unit-select');
    if (unitSelect) {
      unitSelect.addEventListener('change', function (e) {
        cfg.targetPropId = e.target.value;
        const found = getSelectedPropiedad();
        if (found) {
          cfg.paraNombre = found.client.name || '';
          cfg.paraEmail = found.client.email || '';
        }
        render(root);
      });
    }
    const nombreInput = root.querySelector('#cotiz-para-nombre');
    if (nombreInput) nombreInput.addEventListener('input', function (e) { cfg.paraNombre = e.target.value; });
    const emailInput = root.querySelector('#cotiz-para-email');
    if (emailInput) emailInput.addEventListener('input', function (e) { cfg.paraEmail = e.target.value; });

    const saveBtn = root.querySelector('#cotiz-save-btn');
    if (saveBtn) saveBtn.addEventListener('click', function () { saveCotizacion(root); });
    const copyBtn = root.querySelector('#cotiz-copy-btn');
    if (copyBtn) copyBtn.addEventListener('click', function () { copyResumen(); });

    root.querySelectorAll('[data-del-cotiz]').forEach(function (b) {
      b.addEventListener('click', function () { deleteCotizacion(root, b.dataset.delCotiz); });
    });
  }

  function saveCotizacion(root) {
    const found = getSelectedPropiedad();
    if (!found) { App.toast('Selecciona una unidad para guardar la cotización.', 'error'); return; }
    const t = calcTotales();
    const now = new Date();
    const cotizacion = {
      id: 'cotiz_' + Date.now() + '_' + Math.floor(Math.random() * 999),
      fecha: now.toISOString(),
      fechaStr: now.toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' }),
      total: t.total,
      subtotal: t.subtotal,
      ahorro: t.ahorro,
      tipologia: cfg.tipologia,
      tipologiaLabel: t.tpl.label,
      estilo: cfg.estilo,
      paraNombre: cfg.paraNombre || found.client.name || '',
      paraEmail: cfg.paraEmail || found.client.email || '',
      usuarioCreador: State.getState().userEmail || 'desconocido',
      config: {
        conIva: cfg.conIva,
        incluirAire: cfg.incluirAire,
        descuentoNivel: cfg.descuentoNivel || 0,
        incluirAmoblado: cfg.incluirAmoblado,
        itemsDesmarcados: {},
        incluirAdicionales: cfg.incluirAdicionales,
        adicionalesDesmarcados: [],
      },
    };
    found.propiedad.cotizaciones = Array.isArray(found.propiedad.cotizaciones) ? found.propiedad.cotizaciones : [];
    found.propiedad.cotizaciones.push(cotizacion);
    State.persistAndNotify();
    App.toast('Cotización guardada.', 'success');
  }

  function deleteCotizacion(root, cotizId) {
    const found = getSelectedPropiedad();
    if (!found) return;
    App.confirmAction('¿Eliminar esta cotización del historial?', function () {
      found.propiedad.cotizaciones = (found.propiedad.cotizaciones || []).filter(function (c) { return String(c.id) !== String(cotizId); });
      State.persistAndNotify();
      App.toast('Cotización eliminada.', 'success');
    });
  }

  function copyResumen() {
    const t = calcTotales();
    let texto = '🛋️ COTIZACIÓN DE AMOBLADO — ' + t.tpl.label + '\n';
    texto += 'Estilo: ' + (Config.ESTILOS_AMOB.find(function (e) { return e.key === cfg.estilo; }) || {}).label + '\n\n';
    if (cfg.incluirAmoblado) texto += '• Amoblado: ' + App.fmtMoney(t.tpl.amobDscto) + '\n';
    if (cfg.incluirAdicionales) texto += '• Adicionales: ' + App.fmtMoney(t.tpl.adicDscto) + '\n';
    if (cfg.incluirAire) texto += '• Aire acondicionado: ' + App.fmtMoney(Config.AIRE_COSTO_AMOB) + '\n';
    if (t.descuentoCyber) texto += '• Descuento Cyber ' + cfg.descuentoNivel + '%: -' + App.fmtMoney(t.descuentoCyber) + '\n';
    if (cfg.conIva) texto += '• IVA (' + Config.IVA_PCT_AMOB + '%): ' + App.fmtMoney(t.iva) + '\n';
    texto += '\nTOTAL: ' + App.fmtMoney(t.total) + (cfg.conIva ? ' (con IVA)' : ' (sin IVA)') + '\n';
    if (t.ahorro) texto += 'Ahorro vs. precio de lista: ' + App.fmtMoney(t.ahorro) + '\n';
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(function () { App.toast('Resumen copiado al portapapeles.', 'success'); });
    } else {
      App.toast('No se pudo copiar automáticamente.', 'error');
    }
  }

  window.DomusViews = window.DomusViews || {};
  window.DomusViews.cotizador = render;
})();
