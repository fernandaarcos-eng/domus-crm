// data.js — pure normalization logic: flat Supabase rows <-> Cliente/Propiedad model.
// No DOM access here, so this file can be loaded and unit-tested under plain node.
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.DomusData = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function normalizeEmail(email) {
    return (email || '').toString().trim().toLowerCase();
  }

  function normalizePhoneDigits(phone) {
    return (phone || '').toString().replace(/\D+/g, '');
  }

  // Grouping rule: email (normalized) first, else normalized phone digits, else
  // treat the row as its own unlinked single-unit client.
  function groupKeyForRow(row) {
    const email = normalizeEmail(row.email);
    if (email) return 'email:' + email;
    const phoneDigits = normalizePhoneDigits(row.phone);
    if (phoneDigits) return 'phone:' + phoneDigits;
    return 'row:' + row.id;
  }

  const PROPIEDAD_DEFAULTS = {
    address: '', comuna: '', origen: '', stage: 'prospecto', tipo_contrato: 'admin',
    dorm: '', banos: '', camas: '', sofa_cama: '', estac: '', ac: '', calef: '',
    wifi: '', lavadora: '', comodidades: '', datos_admin: '',
    claves: '', equipamiento: '', notes: '',
    // Contract documents (Google Drive links / uploaded file refs). Kept as
    // separate fields on purpose — they're genuinely different contract types.
    contrato_admin_depto: null, contrato_amob_depto: null, contrato_admin_cliente: null,
    // Payment / bank account info. cuentas_cliente is the current array format;
    // the cuenta_* fields below are the legacy single-account format some older
    // rows still only have (superseded by cuentas_cliente when both exist).
    cuentas_cliente: [], monto_pagado: '', pagos_amob: [],
    cuenta_banco: '', cuenta_email: '', cuenta_numero: '', cuenta_rut: '', cuenta_tipo: '', cuenta_titular: '',
  };

  function rowToPropiedad(row, clientId) {
    // Shallow-copy the row so any unknown/future fields survive the round trip,
    // then normalize the ones we care about and strip client-level fields.
    const p = Object.assign({}, PROPIEDAD_DEFAULTS, row);
    p.id = row.id;
    p.clientId = clientId;
    delete p.name;
    delete p.phone;
    delete p.email;
    p.plataformas = Array.isArray(row.plataformas) ? row.plataformas.slice() : [];
    p.finanzas = Array.isArray(row.finanzas) ? row.finanzas.slice() : [];
    p.reservas = Array.isArray(row.reservas) ? row.reservas.slice() : [];
    // Same array-copy treatment as above: PROPIEDAD_DEFAULTS holds [] literals
    // for documentation/shape purposes, but Object.assign would otherwise hand
    // every propiedad missing the field the SAME shared array instance, so we
    // always re-derive a fresh per-row array here.
    p.cuentas_cliente = Array.isArray(row.cuentas_cliente) ? row.cuentas_cliente.slice() : [];
    p.pagos_amob = Array.isArray(row.pagos_amob) ? row.pagos_amob.slice() : [];
    p.stage = row.stage || 'prospecto';
    p.tipo_contrato = row.tipo_contrato || 'admin';
    return p;
  }

  // flatRowsToClients(rows) -> { clients, propiedades }
  // rows: array of flat records as stored in Supabase `data` column (each includes its own `id`).
  function flatRowsToClients(rows) {
    const clientsByKey = new Map();
    (rows || []).forEach(function (row) {
      const key = groupKeyForRow(row);
      let client = clientsByKey.get(key);
      if (!client) {
        client = { id: key, name: row.name || '', phone: row.phone || '', email: row.email || '', propiedades: [] };
        clientsByKey.set(key, client);
      } else {
        if (!client.name && row.name) client.name = row.name;
        if (!client.phone && row.phone) client.phone = row.phone;
        if (!client.email && row.email) client.email = row.email;
      }
      client.propiedades.push(rowToPropiedad(row, client.id));
    });
    const clients = Array.from(clientsByKey.values());
    const propiedades = [];
    clients.forEach(function (c) { c.propiedades.forEach(function (p) { propiedades.push(p); }); });
    return { clients: clients, propiedades: propiedades };
  }

  // clientsToFlatRows(clients) -> rows ready to upsert back to Supabase `leads` table.
  function clientsToFlatRows(clients) {
    const rows = [];
    (clients || []).forEach(function (client) {
      (client.propiedades || []).forEach(function (p) {
        const row = Object.assign({}, p);
        row.name = client.name || '';
        row.phone = client.phone || '';
        row.email = client.email || '';
        delete row.clientId;
        rows.push(row);
      });
    });
    return rows;
  }

  function nextPropertyId(propiedades) {
    let max = 0;
    (propiedades || []).forEach(function (p) {
      const n = typeof p.id === 'number' ? p.id : parseInt(p.id, 10);
      if (!isNaN(n) && n > max) max = n;
    });
    return max + 1;
  }

  function createClient(fields) {
    fields = fields || {};
    const email = normalizeEmail(fields.email);
    const phone = normalizePhoneDigits(fields.phone);
    const id = email ? 'email:' + email : (phone ? 'phone:' + phone : 'row:new-' + Date.now() + '-' + Math.floor(Math.random() * 10000));
    return { id: id, name: fields.name || '', phone: fields.phone || '', email: fields.email || '', propiedades: [] };
  }

  function createPropiedad(id, clientId, overrides) {
    const p = Object.assign({ id: id, clientId: clientId }, PROPIEDAD_DEFAULTS, {
      plataformas: [], finanzas: [], reservas: [],
    }, overrides || {});
    return p;
  }

  return {
    normalizeEmail: normalizeEmail,
    normalizePhoneDigits: normalizePhoneDigits,
    groupKeyForRow: groupKeyForRow,
    flatRowsToClients: flatRowsToClients,
    clientsToFlatRows: clientsToFlatRows,
    nextPropertyId: nextPropertyId,
    createClient: createClient,
    createPropiedad: createPropiedad,
  };
});
