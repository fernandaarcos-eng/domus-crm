// state.js — in-memory app state + simple pub/sub re-render-on-change pattern.
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
    loadRows: loadRows,
  };
})(window);
