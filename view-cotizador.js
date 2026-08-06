// view-cotizador.js — Cotizador de Amoblados: calcula el costo de amoblar una
// unidad (precio de lista, descuento vigente, descuento por ítems removidos,
// descuento Cyber por nivel, IVA opcional) y permite guardar la cotización en
// el historial de la unidad (mismo formato que las cotizaciones ya
// existentes en la base de datos: id, fecha, tipologia, tipologiaLabel,
// estilo, config, subtotal, total, ahorro, paraNombre, paraEmail).
//
// El detalle de ítems (checkbox por mueble) sólo aplica a las secciones que
// componen el paquete de "Amoblado" — la sección "ADICIONALES" del catálogo
// se maneja aparte con el toggle "Adicionales", que usa su propio precio, así
// que no se mezcla con el desmarcado individual.
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
    itemsDesmarcados: {}, // { [tipologiaKey]: ['sectorIdx-itemIdx', ...] }
  };

  let detalleAbierto = false;
  let unitSearch = ''; // filtra el selector de unidad por dirección o cliente

  function findTipologia(key) {
    return Config.TIPOLOGIAS_AMOB.find(function (t) { return t.key === key; }) || Config.TIPOLOGIAS_AMOB[0];
  }

  function calcDescuentoPorItems(tipKey, tpl) {
    const desmarcados = cfg.itemsDesmarcados[tipKey] || [];
    let descLista = 0, descDscto = 0;
    desmarcados.forEach(function (key) {
      const parts = key.split('-').map(Number);
      const si = parts[0], ii = parts[1];
      const sector = tpl.sectores[si];
      const item = sector && sector.items[ii];
      if (!item) return;
      descLista += item[3] || 0;
      descDscto += item[4] || 0;
    });
    return { descLista: descLista, descDscto: descDscto };
  }

  function calcTotales() {
    const tpl = findTipologia(cfg.tipologia);
    const itemsDesc = calcDescuentoPorItems(cfg.tipologia, tpl);
    let lista = 0, dscto = 0;
    if (cfg.incluirAmoblado) {
      lista += Math.max(0, tpl.amobFull - itemsDesc.descLista);
      dscto += Math.max(0, tpl.amobDscto - itemsDesc.descDscto);
    }
    if (cfg.incluirAdicionales) { lista += tpl.adicLista; dscto += tpl.adicDscto; }
    if (cfg.incluirAire) { lista += Config.AIRE_COSTO_AMOB; dscto += Config.AIRE_COSTO_AMOB; }
    const nivel = cfg.descuentoNivel || 0;
    const descuentoCyber = nivel > 0 ? Math.round(dscto * (nivel / 100)) : 0;
    const subtotal = Math.max(0, dscto - descuentoCyber);
    const iva = cfg.conIva ? Math.round(subtotal * (Config.IVA_PCT_AMOB / 100)) : 0;
    const total = subtotal + iva;
    const ahorro = Math.max(0, lista - subtotal);
    return { tpl: tpl, lista: lista, dscto: dscto, descuentoCyber: descuentoCyber, subtotal: subtotal, iva: iva, total: total, ahorro: ahorro, itemsDesc: itemsDesc };
  }

  function allUnitsGrouped() {
    return State.getState().clients;
  }

  function getSelectedPropiedad() {
    if (!cfg.targetPropId) return null;
    const found = State.findPropiedad(cfg.targetPropId);
    return found ? found : null;
  }

  function toggleItemDesmarcado(tipKey, key) {
    if (!cfg.itemsDesmarcados[tipKey]) cfg.itemsDesmarcados[tipKey] = [];
    const arr = cfg.itemsDesmarcados[tipKey];
    const idx = arr.indexOf(key);
    if (idx !== -1) arr.splice(idx, 1); else arr.push(key);
  }

  function chipBtn(active, label, dataAttr, dataVal) {
    return '<button type="button" class="btn btn-sm" data-' + dataAttr + '="' + App.escapeHtml(dataVal) + '" style="border:2px solid ' +
      (active ? 'var(--accent)' : 'var(--border)') + ';background:' + (active ? 'var(--accent)' : 'var(--surface)') +
      ';color:' + (active ? '#fff' : 'var(--text2)') + ';border-radius:20px;font-weight:700;margin:0 6px 6px 0;">' +
      App.escapeHtml(label) + '</button>';
  }

  function unitMatchesSearch(client, p, q) {
    if (!q) return true;
    return (client.name || '').toLowerCase().includes(q) ||
      (p.address || '').toLowerCase().includes(q) ||
      (p.comuna || '').toLowerCase().includes(q);
  }

  function unitSelectHtml() {
    const clients = allUnitsGrouped();
    const q = unitSearch.trim().toLowerCase();
    let html = '<select id="cotiz-unit-select"><option value="">— Cotización libre (sin unidad) —</option>';
    let anyMatch = false;
    clients.forEach(function (c) {
      if (!(c.propiedades || []).length) return;
      // La unidad ya seleccionada siempre se incluye, aunque no calce con el
      // filtro actual — si no, escribir en el buscador borraría la selección
      // vigente en vez de simplemente acotar las opciones.
      const matching = c.propiedades.filter(function (p) {
        return unitMatchesSearch(c, p, q) || String(p.id) === String(cfg.targetPropId);
      });
      if (!matching.length) return;
      anyMatch = true;
      html += '<optgroup label="' + App.escapeHtml(c.name || 'Sin nombre') + '">';
      matching.forEach(function (p) {
        html += '<option value="' + App.escapeHtml(p.id) + '"' + (String(p.id) === String(cfg.targetPropId) ? ' selected' : '') + '>' +
          App.escapeHtml(p.address || ('Unidad #' + p.id)) + '</option>';
      });
      html += '</optgroup>';
    });
    html += '</select>';
    if (q && !anyMatch) {
      html += '<div class="text-muted" style="font-size:12px;margin-top:4px;">Sin unidades que coincidan con "' + App.escapeHtml(unitSearch) + '".</div>';
    }
    return html;
  }

  function detalleItemsHtml(tpl) {
    const desmarcados = cfg.itemsDesmarcados[cfg.tipologia] || [];
    let html = '';
    tpl.sectores.forEach(function (s, si) {
      if (s.nombre === 'ADICIONALES') return; // controlado por el toggle "Adicionales" de arriba
      html += '<div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.03em;color:var(--text2);margin:12px 0 4px;">' + App.escapeHtml(s.nombre) + '</div>';
      html += '<table style="width:100%;border-collapse:collapse;font-size:12px;">';
      s.items.forEach(function (item, ii) {
        const key = si + '-' + ii;
        const checked = desmarcados.indexOf(key) === -1;
        const precio = item[4] != null ? item[4] : item[3];
        html += '<tr' + (checked ? '' : ' style="opacity:.45;"') + '>' +
          '<td style="padding:3px 6px 3px 0;width:20px;"><input type="checkbox" data-item-toggle="' + key + '"' + (checked ? ' checked' : '') + ' style="width:auto;"></td>' +
          '<td style="padding:3px 6px;">' + App.escapeHtml(item[0]) + (item[1] > 1 ? ' ×' + item[1] : '') + '</td>' +
          '<td style="padding:3px 0;text-align:right;color:var(--text2);white-space:nowrap;">' + (precio != null ? App.fmtMoney(precio) : '—') + '</td>' +
          '</tr>';
      });
      html += '</table>';
    });
    html += '<div class="text-muted" style="font-size:11px;margin-top:10px;">Los ítems de "Adicionales" (cortinas, chapa electrónica, luminarias, estacionamiento) se activan con el toggle "Adicionales" de arriba y no se desmarcan aquí.</div>';
    return html;
  }

  function historialHtml(p) {
    const cot = (p.cotizaciones || []).slice().sort(function (a, b) { return (b.fecha || '').localeCompare(a.fecha || ''); });
    if (!cot.length) return '<div class="text-muted">Sin cotizaciones guardadas para esta unidad.</div>';
    return cot.map(function (c) {
      const nivel = c.config && c.config.descuentoNivel ? c.config.descuentoNivel : 0;
      const nDesmarcados = c.config && c.config.itemsDesmarcados && c.config.itemsDesmarcados[c.tipologia] ? c.config.itemsDesmarcados[c.tipologia].length : 0;
      return '<div class="card" style="display:flex;justify-content:space-between;align-items:center;gap:10px;">' +
        '<div>' +
        '<div style="font-weight:700;">' + App.escapeHtml(c.tipologiaLabel || c.tipologia || 'Cotización') + ' · ' + App.escapeHtml(c.estilo || '—') + '</div>' +
        '<div class="text-muted" style="font-size:12px;">' + App.escapeHtml(c.fechaStr || '') + (nivel ? ' · Cyber ' + nivel + '%' : '') +
        (nDesmarcados ? ' · ' + nDesmarcados + ' ítem(s) removido(s)' : '') +
        (c.paraNombre ? ' · Para: ' + App.escapeHtml(c.paraNombre) : '') + '</div>' +
        '</div>' +
        '<div style="text-align:right;white-space:nowrap;">' +
        '<div style="font-weight:800;">' + App.fmtMoney(c.total) + '</div>' +
        (c.ahorro ? '<div class="text-muted" style="font-size:11px;">Ahorro ' + App.fmtMoney(c.ahorro) + '</div>' : '') +
        '</div>' +
        '<button class="btn btn-ghost btn-sm" data-download-cotiz="' + App.escapeHtml(c.id) + '">⬇ Descargar</button>' +
        '<button class="btn btn-ghost btn-sm" data-del-cotiz="' + App.escapeHtml(c.id) + '">Eliminar</button>' +
        '</div>';
    }).join('');
  }

  // ---------- descarga de cotización para el cliente (sin precio por ítem) ----------
  //
  // El documento que ve el cliente sólo muestra los nombres de los ítems
  // incluidos (agrupados por sector) y los totales agregados (subtotal, IVA,
  // total, ahorro) — nunca el precio individual de cada mueble, para no
  // exponer el desglose de costos interno. Se genera como una página HTML
  // imprimible en una pestaña nueva; el botón "Guardar como PDF / Imprimir"
  // usa el diálogo de impresión del navegador (destino "Guardar como PDF"),
  // sin depender de librerías externas.

  function fmtFechaLabel(fechaIso) {
    try {
      const d = fechaIso ? new Date(fechaIso) : new Date();
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch (e) { return ''; }
  }

  // Lista (sin precios) los ítems incluidos en la cotización, agrupados por
  // sector. Respeta los ítems desmarcados del "Amoblado completo" y agrega
  // "ADICIONALES" completo cuando ese toggle está activo (no tiene desmarcado
  // individual, ver nota en el encabezado del archivo).
  function itemsIncluidosHtml(tpl, itemsDesmarcados, incluirAmoblado, incluirAdicionales) {
    function listaItems(items) {
      return '<ul class="pdf-item-list">' + items.map(function (item) {
        return '<li>' + App.escapeHtml(item[0]) + (item[1] > 1 ? ' <span class="pdf-qty">×' + item[1] + '</span>' : '') + '</li>';
      }).join('') + '</ul>';
    }
    let html = '';
    if (incluirAmoblado) {
      tpl.sectores.forEach(function (s, si) {
        if (s.nombre === 'ADICIONALES') return;
        const items = s.items.filter(function (item, ii) { return itemsDesmarcados.indexOf(si + '-' + ii) === -1; });
        if (!items.length) return;
        html += '<div class="pdf-sector-title">' + App.escapeHtml(s.nombre) + '</div>' + listaItems(items);
      });
    }
    if (incluirAdicionales) {
      const adic = tpl.sectores.find(function (s) { return s.nombre === 'ADICIONALES'; });
      if (adic && adic.items.length) {
        html += '<div class="pdf-sector-title">ADICIONALES</div>' + listaItems(adic.items);
      }
    }
    return html;
  }

  function buildQuotePrintHtml(data) {
    const iva = data.conIva ? Math.max(0, data.total - data.subtotal) : 0;
    return '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">' +
      '<title>Cotización — ' + App.escapeHtml(data.direccion || 'Domus Rentals') + '</title>' +
      '<style>' +
      'body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1a1a1a;max-width:720px;margin:0 auto;padding:40px 32px;}' +
      'h1{font-size:22px;margin:0 0 4px;}' +
      '.pdf-sub{color:#666;font-size:13px;margin-bottom:24px;}' +
      '.pdf-brand{font-size:13px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#7a5cff;margin-bottom:6px;}' +
      '.pdf-meta{display:grid;grid-template-columns:1fr 1fr;gap:6px 24px;font-size:13px;margin-bottom:28px;padding:16px;background:#f7f6fb;border-radius:10px;}' +
      '.pdf-meta b{color:#444;}' +
      '.pdf-sector-title{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.03em;color:#7a5cff;margin:18px 0 6px;border-bottom:1px solid #eee;padding-bottom:4px;}' +
      '.pdf-item-list{list-style:none;margin:0;padding:0;columns:2;column-gap:24px;}' +
      '.pdf-item-list li{font-size:13px;padding:3px 0;break-inside:avoid;}' +
      '.pdf-qty{color:#888;}' +
      '.pdf-totales{margin-top:28px;border-top:2px solid #1a1a1a;padding-top:12px;}' +
      '.pdf-totales table{width:100%;border-collapse:collapse;font-size:14px;}' +
      '.pdf-totales td{padding:5px 0;}' +
      '.pdf-totales .pdf-total-row td{font-weight:800;font-size:19px;padding-top:10px;}' +
      '.pdf-ahorro{margin-top:10px;background:#eafbea;color:#1d7a35;padding:8px 12px;border-radius:8px;font-size:13px;font-weight:700;}' +
      '.pdf-footer{margin-top:36px;font-size:11px;color:#999;text-align:center;}' +
      '.pdf-noprint{margin:20px 0;text-align:center;}' +
      '.pdf-noprint button{font-size:14px;padding:10px 20px;border-radius:8px;border:none;background:#7a5cff;color:#fff;cursor:pointer;}' +
      '@media print{.pdf-noprint{display:none;}body{padding:0;}}' +
      '</style></head><body>' +
      '<div class="pdf-brand">Domus Rentals</div>' +
      '<h1>Cotización de Amoblado</h1>' +
      '<div class="pdf-sub">' + App.escapeHtml(data.fechaLabel || '') + '</div>' +
      '<div class="pdf-meta">' +
      (data.paraNombre ? '<div><b>Para:</b> ' + App.escapeHtml(data.paraNombre) + '</div>' : '') +
      (data.paraEmail ? '<div><b>Correo:</b> ' + App.escapeHtml(data.paraEmail) + '</div>' : '') +
      (data.direccion ? '<div><b>Unidad:</b> ' + App.escapeHtml(data.direccion) + '</div>' : '') +
      '<div><b>Tipología:</b> ' + App.escapeHtml(data.tipoLabel || '') + '</div>' +
      '<div><b>Estilo:</b> ' + App.escapeHtml(data.estiloLabel || '') + '</div>' +
      '</div>' +
      (data.itemsHtml ? '<div class="pdf-sector-title" style="margin-top:0;">Incluye</div>' + data.itemsHtml : '') +
      '<div class="pdf-totales"><table>' +
      '<tr><td>Subtotal</td><td style="text-align:right;">' + App.fmtMoney(data.subtotal) + '</td></tr>' +
      (data.conIva ? '<tr><td>IVA</td><td style="text-align:right;">' + App.fmtMoney(iva) + '</td></tr>' : '') +
      '<tr class="pdf-total-row"><td>TOTAL' + (data.conIva ? ' (IVA incluido)' : '') + '</td><td style="text-align:right;">' + App.fmtMoney(data.total) + '</td></tr>' +
      '</table></div>' +
      (data.ahorro ? '<div class="pdf-ahorro">🎉 Ahorro incluido en esta cotización: ' + App.fmtMoney(data.ahorro) + '</div>' : '') +
      '<div class="pdf-noprint"><button onclick="window.print()">Guardar como PDF / Imprimir</button></div>' +
      '<div class="pdf-footer">Cotización generada por Domus Rentals. Sujeta a disponibilidad y confirmación.</div>' +
      '</body></html>';
  }

  function openQuotePrintWindow(html) {
    const win = window.open('', '_blank');
    if (!win) {
      App.toast('El navegador bloqueó la ventana. Permite ventanas emergentes para descargar la cotización.', 'error');
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
  }

  function descargarCotizacionActual() {
    const t = calcTotales();
    const selected = getSelectedPropiedad();
    const itemsDesmarcados = cfg.itemsDesmarcados[cfg.tipologia] || [];
    const estiloObj = Config.ESTILOS_AMOB.find(function (e) { return e.key === cfg.estilo; });
    const html = buildQuotePrintHtml({
      tipoLabel: t.tpl.label,
      estiloLabel: estiloObj ? estiloObj.label : cfg.estilo,
      direccion: selected ? (selected.propiedad.address || '') : '',
      paraNombre: cfg.paraNombre,
      paraEmail: cfg.paraEmail,
      fechaLabel: fmtFechaLabel(new Date().toISOString()),
      itemsHtml: itemsIncluidosHtml(t.tpl, itemsDesmarcados, cfg.incluirAmoblado, cfg.incluirAdicionales),
      subtotal: t.subtotal,
      conIva: cfg.conIva,
      total: t.total,
      ahorro: t.ahorro,
    });
    openQuotePrintWindow(html);
  }

  function descargarCotizacionHistorial(propiedad, c) {
    const tpl = findTipologia(c.tipologia);
    const estiloObj = Config.ESTILOS_AMOB.find(function (e) { return e.key === c.estilo; });
    const cfgSnap = c.config || {};
    const itemsDesmarcados = (cfgSnap.itemsDesmarcados && cfgSnap.itemsDesmarcados[c.tipologia]) || [];
    const html = buildQuotePrintHtml({
      tipoLabel: c.tipologiaLabel || tpl.label,
      estiloLabel: estiloObj ? estiloObj.label : (c.estilo || ''),
      direccion: propiedad.address || '',
      paraNombre: c.paraNombre || '',
      paraEmail: c.paraEmail || '',
      fechaLabel: fmtFechaLabel(c.fecha),
      itemsHtml: itemsIncluidosHtml(tpl, itemsDesmarcados, cfgSnap.incluirAmoblado !== false, !!cfgSnap.incluirAdicionales),
      subtotal: c.subtotal,
      conIva: !!cfgSnap.conIva,
      total: c.total,
      ahorro: c.ahorro,
    });
    openQuotePrintWindow(html);
  }

  function downloadCotizacionHistorial(cotizId) {
    const found = getSelectedPropiedad();
    if (!found) return;
    const c = (found.propiedad.cotizaciones || []).find(function (x) { return String(x.id) === String(cotizId); });
    if (!c) return;
    descargarCotizacionHistorial(found.propiedad, c);
  }

  function render(root) {
    const focusSnap = App.captureFocus(root);
    const t = calcTotales();
    const selected = getSelectedPropiedad();
    const nDesmarcados = (cfg.itemsDesmarcados[cfg.tipologia] || []).length;

    let html = '<div class="toolbar"><div class="toolbar-left">' +
      '<span class="text-muted" style="font-size:12px;">Calcula el costo de amoblar una unidad y guarda la cotización en su historial.</span>' +
      '</div></div>';

    html += '<div style="display:grid;grid-template-columns:1.1fr 1fr;gap:16px;align-items:start;">';

    // ---- Left: configuration card ----
    html += '<div class="card">';
    html += '<div class="subsection-title">Unidad / destinatario</div>';
    html += '<div class="form-grid">' +
      '<div class="form-group full"><label>Buscar unidad</label>' +
      '<div class="search-box">🔎 <input type="text" id="cotiz-unit-search" placeholder="Buscar por dirección, comuna o cliente…" value="' + App.escapeHtml(unitSearch) + '"></div>' +
      '</div>' +
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

    html += '<div class="subsection-title" style="display:flex;align-items:center;justify-content:space-between;">' +
      '<span>Ítems del amoblado' + (nDesmarcados ? ' <span class="badge badge-amber">' + nDesmarcados + ' removido(s)</span>' : '') + '</span>' +
      '<button type="button" class="btn btn-ghost btn-sm" id="cotiz-toggle-detalle">' + (detalleAbierto ? 'Ocultar' : 'Ver detalle') + '</button>' +
      '</div>';
    if (detalleAbierto) {
      html += detalleItemsHtml(t.tpl);
    } else {
      html += '<div class="text-muted" style="font-size:12px;">Desmarca muebles individuales (por ejemplo, si el propietario ya tiene cama o refrigerador) para descontarlos del total.</div>';
    }

    html += '</div>'; // end left card

    // ---- Right: totals + save ----
    html += '<div class="card">';
    html += '<div class="subsection-title">Resumen</div>';
    html += '<table style="width:100%;border-collapse:collapse;font-size:13px;">' +
      '<tr><td style="padding:6px 0;">Precio de lista</td><td style="padding:6px 0;text-align:right;">' + App.fmtMoney(t.lista) + '</td></tr>' +
      (t.lista !== t.dscto ? '<tr><td style="padding:6px 0;">Precio con descuento vigente</td><td style="padding:6px 0;text-align:right;">' + App.fmtMoney(t.dscto) + '</td></tr>' : '') +
      (t.itemsDesc.descDscto ? '<tr><td style="padding:6px 0;color:var(--green-dark);">Descuento por ' + nDesmarcados + ' ítem(s) removido(s)</td><td style="padding:6px 0;text-align:right;color:var(--green-dark);">-' + App.fmtMoney(t.itemsDesc.descDscto) + '</td></tr>' : '') +
      (t.descuentoCyber ? '<tr><td style="padding:6px 0;color:var(--green-dark);">Descuento Cyber (' + cfg.descuentoNivel + '%)</td><td style="padding:6px 0;text-align:right;color:var(--green-dark);">-' + App.fmtMoney(t.descuentoCyber) + '</td></tr>' : '') +
      '<tr><td style="padding:6px 0;font-weight:700;border-top:1px solid var(--border);">Subtotal</td><td style="padding:6px 0;text-align:right;font-weight:700;border-top:1px solid var(--border);">' + App.fmtMoney(t.subtotal) + '</td></tr>' +
      (cfg.conIva ? '<tr><td style="padding:6px 0;">IVA (' + Config.IVA_PCT_AMOB + '%)</td><td style="padding:6px 0;text-align:right;">' + App.fmtMoney(t.iva) + '</td></tr>' : '') +
      '<tr><td style="padding:10px 0;font-weight:900;font-size:16px;color:var(--accent-dark);border-top:2px solid var(--accent);">TOTAL</td><td style="padding:10px 0;text-align:right;font-weight:900;font-size:18px;color:var(--accent-dark);border-top:2px solid var(--accent);">' + App.fmtMoney(t.total) + '</td></tr>' +
      (t.ahorro ? '<tr><td colspan="2" style="padding:6px 0;color:var(--green-dark);font-size:12px;">🎉 Ahorro vs. precio de lista: ' + App.fmtMoney(t.ahorro) + '</td></tr>' : '') +
      '</table>';

    html += '<div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap;">' +
      '<button class="btn btn-primary" id="cotiz-save-btn"' + (selected ? '' : ' disabled title="Selecciona una unidad para guardar"') + '>Guardar cotización</button>' +
      '<button class="btn btn-ghost" id="cotiz-copy-btn">Copiar resumen</button>' +
      '<button class="btn btn-ghost" id="cotiz-download-btn">⬇ Descargar para el cliente</button>' +
      '</div>' +
      '<div class="text-muted" style="font-size:11px;margin-top:6px;">La versión para el cliente no muestra el precio de cada mueble, sólo lo incluido y el total.</div>';
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
    App.restoreFocus(root, focusSnap);
    wire(root);
  }

  function wire(root) {
    const unitSearchInput = root.querySelector('#cotiz-unit-search');
    if (unitSearchInput) {
      unitSearchInput.addEventListener('input', function (e) {
        unitSearch = e.target.value;
        render(root);
      });
    }
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

    const toggleDetalle = root.querySelector('#cotiz-toggle-detalle');
    if (toggleDetalle) toggleDetalle.addEventListener('click', function () { detalleAbierto = !detalleAbierto; render(root); });

    root.querySelectorAll('[data-item-toggle]').forEach(function (cb) {
      cb.addEventListener('change', function (e) {
        toggleItemDesmarcado(cfg.tipologia, e.target.dataset.itemToggle);
        render(root);
      });
    });

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
    const downloadBtn = root.querySelector('#cotiz-download-btn');
    if (downloadBtn) downloadBtn.addEventListener('click', function () { descargarCotizacionActual(); });

    root.querySelectorAll('[data-del-cotiz]').forEach(function (b) {
      b.addEventListener('click', function () { deleteCotizacion(root, b.dataset.delCotiz); });
    });
    root.querySelectorAll('[data-download-cotiz]').forEach(function (b) {
      b.addEventListener('click', function () { downloadCotizacionHistorial(b.dataset.downloadCotiz); });
    });
  }

  function saveCotizacion(root) {
    const found = getSelectedPropiedad();
    if (!found) { App.toast('Selecciona una unidad para guardar la cotización.', 'error'); return; }
    const t = calcTotales();
    const now = new Date();
    const itemsDesmarcadosOut = {};
    const arrDesmarcados = cfg.itemsDesmarcados[cfg.tipologia] || [];
    if (arrDesmarcados.length) itemsDesmarcadosOut[cfg.tipologia] = arrDesmarcados.slice();
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
        itemsDesmarcados: itemsDesmarcadosOut,
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
    if (cfg.incluirAmoblado) texto += '• Amoblado: ' + App.fmtMoney(t.tpl.amobDscto - t.itemsDesc.descDscto) + '\n';
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
