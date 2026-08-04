// api.js — Supabase auth + REST access, debounced/retried saves, localStorage backup.
(function (global) {
  'use strict';
  const cfg = global.DomusConfig;
  const KEYS = cfg.LOCAL_STORAGE_KEYS;

  let saveTimer = null;
  let saveStatus = 'idle'; // idle | saving | saved | error
  let statusListeners = [];
  let authExpiredListeners = [];
  let pendingRows = null; // rows queued for the next debounced flush
  let flushing = false;

  function setStatus(s, extra) {
    saveStatus = s;
    statusListeners.forEach(function (fn) { try { fn(s, extra); } catch (e) { /* noop */ } });
  }

  function onStatusChange(fn) { statusListeners.push(fn); }
  function onAuthExpired(fn) { authExpiredListeners.push(fn); }
  function getSaveStatus() { return saveStatus; }

  function getToken() { return localStorage.getItem(KEYS.token) || ''; }
  function getStoredEmail() { return localStorage.getItem(KEYS.email) || ''; }
  function isLoggedIn() { return !!getToken(); }

  function clearSession() {
    localStorage.removeItem(KEYS.token);
    localStorage.removeItem(KEYS.email);
  }

  async function login(email, password) {
    const res = await fetch(cfg.SUPA_URL + '/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: cfg.SUPA_KEY,
      },
      body: JSON.stringify({ email: email, password: password }),
    });
    if (!res.ok) {
      let msg = 'No se pudo iniciar sesión.';
      try {
        const j = await res.json();
        if (j && (j.error_description || j.msg || j.error)) msg = j.error_description || j.msg || j.error;
      } catch (e) { /* ignore parse errors */ }
      throw new Error(msg);
    }
    const json = await res.json();
    if (!json.access_token) throw new Error('Respuesta de autenticación inválida.');
    localStorage.setItem(KEYS.token, json.access_token);
    localStorage.setItem(KEYS.email, email);
    return json;
  }

  function logout() {
    clearSession();
  }

  // Generic authenticated fetch against the Supabase REST endpoint.
  async function supaFetch(path, options) {
    options = options || {};
    const headers = Object.assign({
      apikey: cfg.SUPA_KEY,
      Authorization: 'Bearer ' + getToken(),
    }, options.headers || {});
    const res = await fetch(cfg.SUPA_URL + path, Object.assign({}, options, { headers: headers }));
    if (res.status === 401) {
      clearSession();
      authExpiredListeners.forEach(function (fn) { try { fn(); } catch (e) { /* noop */ } });
      throw new Error('Sesión expirada. Vuelve a iniciar sesión.');
    }
    return res;
  }

  // loadFromCloud() -> flat rows array (each row = the `data` jsonb blob, with `id` set)
  async function loadFromCloud() {
    const res = await supaFetch('/rest/v1/leads?select=id,data&order=id.asc&limit=1000', { method: 'GET' });
    if (!res.ok) {
      const text = await res.text().catch(function () { return ''; });
      throw new Error('Error cargando datos (' + res.status + '). ' + text);
    }
    const json = await res.json();
    const rows = (json || []).map(function (rec) {
      const flat = Object.assign({}, rec.data || {});
      flat.id = (rec.data && rec.data.id != null) ? rec.data.id : rec.id;
      return flat;
    });
    saveBackupLocal(rows);
    return rows;
  }

  function saveBackupLocal(rows) {
    try {
      localStorage.setItem(KEYS.backup, JSON.stringify({ rows: rows, savedAt: new Date().toISOString() }));
    } catch (e) { /* storage full or unavailable — non-fatal */ }
  }

  function loadBackupLocal() {
    try {
      const raw = localStorage.getItem(KEYS.backup);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  }

  function sleep(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }

  async function upsertRows(rows) {
    const body = rows.map(function (row) {
      return { id: row.id, data: row, updated_at: new Date().toISOString() };
    });
    const res = await supaFetch('/rest/v1/leads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(function () { return ''; });
      throw new Error('Error guardando (' + res.status + '). ' + text);
    }
    return true;
  }

  async function flushWithRetry(rows) {
    flushing = true;
    setStatus('saving');
    let attempt = 0;
    let lastErr = null;
    while (attempt < cfg.SAVE_MAX_RETRIES) {
      try {
        await upsertRows(rows);
        saveBackupLocal(rows);
        setStatus('saved');
        flushing = false;
        // If more edits queued while we were saving, flush those too.
        if (pendingRows && pendingRows !== rows) {
          const next = pendingRows;
          pendingRows = null;
          return flushWithRetry(next);
        }
        pendingRows = null;
        return true;
      } catch (err) {
        lastErr = err;
        attempt += 1;
        if (attempt < cfg.SAVE_MAX_RETRIES) {
          await sleep(cfg.SAVE_RETRY_BASE_MS * Math.pow(2, attempt - 1));
        }
      }
    }
    // All retries failed: keep data safe locally, surface error.
    saveBackupLocal(rows);
    flushing = false;
    setStatus('error', lastErr ? lastErr.message : 'Error desconocido');
    return false;
  }

  // scheduleSave(rows): debounce rapid edits (SAVE_DEBOUNCE_MS after the last call)
  // before writing to Supabase. Always keeps a localStorage backup immediately.
  function scheduleSave(rows) {
    saveBackupLocal(rows);
    pendingRows = rows;
    setStatus('idle');
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      saveTimer = null;
      if (!flushing) {
        const toSave = pendingRows;
        pendingRows = null;
        flushWithRetry(toSave);
      }
    }, cfg.SAVE_DEBOUNCE_MS);
  }

  // Demo mode: never touches the network, just persists to localStorage and
  // reports a "saved" status so the UI behaves consistently.
  function saveLocalOnly(rows) {
    saveBackupLocal(rows);
    setStatus('saving');
    setTimeout(function () { setStatus('saved'); }, 150);
  }

  global.DomusApi = {
    login: login,
    logout: logout,
    isLoggedIn: isLoggedIn,
    getStoredEmail: getStoredEmail,
    loadFromCloud: loadFromCloud,
    scheduleSave: scheduleSave,
    saveLocalOnly: saveLocalOnly,
    loadBackupLocal: loadBackupLocal,
    onStatusChange: onStatusChange,
    onAuthExpired: onAuthExpired,
    getSaveStatus: getSaveStatus,
  };
})(window);
