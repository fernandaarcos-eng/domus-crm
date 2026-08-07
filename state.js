// state.js — in-memory app state + simple pub/sub re-render-on-change pattern.
// (redeploy trigger)
(function (global) {
  'use strict';
  const DomusData = global.DomusData;
  const DomusApi = global.DomusApi;

  const state = {
    clients: [],
    view: 'pipeline',
    search: '',
    selectedClientId: null,
    demoMode: false,
    userEmail: '',
    saveStatus: 'idle',
    saveError: '',
    loading: true,
    loadError: '',
  };

  let listeners = [];
  function subscribe(fn) { listeners.push(fn); return function unsubscribe() { listeners = listeners.filter(function (f) { return f !== fn; }); }; }
  function notify() { listeners.forEach(function (fn) { try { fn(state); } catch (e) { console.error(e); } }); }

  function setState(patch) {
    Object.assign(state, patch);
    notify();
  }

  function getState() { return state; }

  function getAllPropiedades() {
    const list = [];
    state.clients.forEach(function (c) { (c.propiedades || []).forEach(function (p) { list.push(p); }); });
    return list;
  }

  function findClientById(clientId) {
    return state.clients.find(function (c) { return String(c.id) === String(clientId); }) || null;
  }

  function findPropiedad(propId) {
    for (const c of state.clients) {
      const p = (c.propiedades || []).find(function (pp) { return String(pp.id) === String(propId); });
      if (p) return { client: c, propiedad: p };
    }
    return null;
  }

  // Call after any mutation to clients/propiedades: persists (cloud or local
  // depending on demo mode) and re-renders the UI.
  function persistAndNotify() {
    const rows = DomusData.clientsToFlatRows(state.clients);
    if (state.demoMode) {
      DomusApi.saveLocalOnly(rows);
    } else {
      DomusApi.scheduleSave(rows);
    }
    notify();
  }

  // Elimina permanentemente una o más propiedades (unidades) por id. Fuera de
  // modo demo, primero se borran como filas reales en Supabase (DELETE) — si
  // eso falla, la promesa rechaza y el estado local queda sin tocar, para no
  // mostrar algo como "eliminado" si en realidad la fila sigue en la nube. Si
  // un cliente se queda sin ninguna unidad, también se quita del listado: no
  // le queda nada que persistir ni que mostrar.
  async function deletePropiedades(ids) {
    if (!state.demoMode) {
      await DomusApi.deleteRows(ids);
    }
    const idSet = new Set(ids.map(String));
    state.clients.forEach(function (c) {
      c.propiedades = (c.propiedades || []).filter(function (p) { return !idSet.has(String(p.id)); });
    });
    state.clients = state.clients.filter(function (c) { return (c.propiedades || []).length > 0; });
    if (state.demoMode) {
      const rows = DomusData.clientsToFlatRows(state.clients);
      DomusApi.saveLocalOnly(rows);
    }
    notify();
  }

  // Elimina permanentemente un cliente y TODAS sus unidades (cada unidad es
  // su propia fila en Supabase, así que esto es equivalente a deletePropiedades
  // con todos los ids de ese cliente).
  async function deleteClient(clientId) {
    const client = findClientById(clientId);
    if (!client) return;
    const ids = (client.propiedades || []).map(function (p) { return p.id; });
    await deletePropiedades(ids);
  }

  function loadRows(rows) {
    const result = DomusData.flatRowsToClients(rows);
    state.clients = result.clients;
    state.loading = false;
    notify();
  }

  global.DomusState = {
    subscribe: subscribe,
    setState: setState,
    getState: getState,
    getAllPropiedades: getAllPropiedades,
    findClientById: findClientById,
    findPropiedad: findPropiedad,
    persistAndNotify: persistAndNotify,
    deletePropiedades: deletePropiedades,
    deleteClient: deleteClient,
    loadRows: loadRows,
  };
})(window);
