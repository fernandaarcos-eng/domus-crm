// app.js — bootstrap, navigation, shared UI helpers, login/demo wiring.
(function () {
  'use strict';
  const Config = window.DomusConfig;
  const DomusData = window.DomusData;
  const Api = window.DomusApi;
  const State = window.DomusState;

  // ---------- shared helpers used by every view ----------
  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function fmtMoney(n) {
    n = Number(n) || 0;
    return '$' + n.toLocaleString('es-CL', { maximumFractionDigits: 0 });
  }

  function fmtDate(d) {
    if (!d) return '—';
    try {
      const dt = new Date(d + 'T00:00:00');
      if (isNaN(dt.getTime())) return d;
      return dt.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (e) { return d; }
  }

  // Views re-render their whole view-root on every keystroke in a search box
  // (State.setState -> notify -> render), which replaces the <input> with a
  // brand-new DOM node and drops focus — so without this, typing a second
  // letter requires clicking back into the box first. captureFocus/
  // restoreFocus save and reapply focus + cursor position across that
  // innerHTML swap. Call captureFocus(root) right before re-rendering and
  // restoreFocus(root, snap) right after root.innerHTML is replaced.
  function captureFocus(root) {
    const el = document.activeElement;
    if (!el || !root || !root.contains(el) || !el.id) return null;
    const snap = { id: el.id };
    if (typeof el.selectionStart === 'number') {
      snap.selectionStart = el.selectionStart;
      snap.selectionEnd = el.selectionEnd;
    }
    return snap;
  }

  function restoreFocus(root, snap) {
    if (!snap) return;
    const el = (root && root.querySelector('#' + snap.id)) || document.getElementById(snap.id);
    if (!el) return;
    el.focus();
    if (snap.selectionStart != null && typeof el.setSelectionRange === 'function') {
      try { el.setSelectionRange(snap.selectionStart, snap.selectionEnd); } catch (e) { /* not a text-selectable input */ }
    }
  }

  function todayStr() {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + mm + '-' + dd;
  }

  function currentMonthStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }

  // Appends one entry to p.stage_history. Called whenever a unit's stage
  // actually changes (including on creation, and when a deal is marked
  // lost) so Resumen can compute ciclo/metas from real transition dates.
  function pushStageHistory(p, stage) {
    if (!Array.isArray(p.stage_history)) p.stage_history = [];
    p.stage_history.push({ stage: stage, date: todayStr(), vendedora: p.vendedora || State.getState().userEmail || '' });
  }

  let toastTimer = 0;
  function toast(message, type) {
    const wrap = document.getElementById('toast-wrap');
    if (!wrap) return;
    const el = document.createElement('div');
    el.className = 'toast' + (type ? ' ' + type : '');
    el.textContent = message;
    wrap.appendChild(el);
    setTimeout(function () {
      el.style.transition = 'opacity .3s';
      el.style.opacity = '0';
      setTimeout(function () { el.remove(); }, 300);
    }, 4200);
  }

  function openModal(innerHtml) {
    closeModal();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'active-modal-overlay';
    overlay.innerHTML = '<div class="modal">' + innerHtml + '</div>';
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal();
    });
    document.body.appendChild(overlay);
    requestAnimationFrame(function () { overlay.classList.add('open'); });
    return overlay;
  }

  function closeModal() {
    const existing = document.getElementById('active-modal-overlay');
    if (existing) existing.remove();
  }

  function setView(viewName) {
    State.setState({ view: viewName });
  }

  function selectClient(clientId) {
    State.setState({ selectedClientId: clientId });
  }

  const UNIT_FIELD_GROUPS = [
    { title: 'Datos comerciales', fields: [
      ['comuna', 'Comuna'], ['address', 'Dirección'], ['origen', 'Origen'],
      ['vendedora', 'Vendedora asignada'], ['valor_estimado_mensual', 'Valor estimado mensual (CLP)'],
    ] },
    { title: 'Características', fields: [
      ['dorm', 'Dormitorios'], ['banos', 'Baños'], ['camas', 'Camas'], ['sofa_cama', 'Sofá cama'],
      ['estac', 'Estacionamiento'], ['ac', 'Aire acondicionado'], ['calef', 'Calefacción'], ['lavadora', 'Lavadora'],
    ] },
    { title: 'Acceso y equipamiento', fields: [
      ['wifi', 'WiFi'], ['claves', 'Claves'], ['equipamiento', 'Equipamiento'], ['datos_admin', 'Datos administración'],
    ] },
    { title: 'Otros', fields: [
      ['comodidades', 'Comodidades del edificio'], ['notes', 'Notas'],
    ] },
  ];

  function unitEditFormHtml(p) {
    const stageOptions = Config.STAGES.map(function (s) {
      return '<option value="' + s.key + '"' + (p.stage === s.key ? ' selected' : '') + '>' + escapeHtml(s.label) + '</option>';
    }).join('');
    const tipoOptions = Object.keys(Config.TIPO_CONTRATO_LABELS).map(function (k) {
      return '<option value="' + k + '"' + (p.tipo_contrato === k ? ' selected' : '') + '>' + escapeHtml(Config.TIPO_CONTRATO_LABELS[k]) + '</option>';
    }).join('');
    const vendedoraOptions = '<option value="">— Sin asignar —</option>' + Object.keys(Config.VENDEDORAS).map(function (email) {
      return '<option value="' + escapeHtml(email) + '"' + (p.vendedora === email ? ' selected' : '') + '>' + escapeHtml(Config.VENDEDORAS[email]) + '</option>';
    }).join('');
    let fieldsHtml = '';
    UNIT_FIELD_GROUPS.forEach(function (group) {
      fieldsHtml += '<div class="form-section">' + escapeHtml(group.title) + '</div><div class="form-grid">';
      group.fields.forEach(function (f) {
        const key = f[0], label = f[1];
        if (key === 'vendedora') {
          fieldsHtml += '<div class="form-group full"><label>' + escapeHtml(label) + '</label>' +
            '<select data-field="vendedora">' + vendedoraOptions + '</select></div>';
          return;
        }
        const isTextarea = ['comodidades', 'notes', 'equipamiento', 'claves', 'datos_admin', 'wifi'].indexOf(key) !== -1;
        fieldsHtml += '<div class="form-group full">' +
          '<label>' + escapeHtml(label) + '</label>' +
          (isTextarea
            ? '<textarea data-field="' + key + '">' + escapeHtml(p[key] || '') + '</textarea>'
            : '<input type="text" data-field="' + key + '" value="' + escapeHtml(p[key] || '') + '">') +
          '</div>';
      });
      fieldsHtml += '</div>';
    });

    const perdidoNote = p.perdido
      ? '<div class="card" style="border-color:var(--red);background:var(--red-light);margin-bottom:16px;">' +
        '<b>Marcado como perdido</b> — ' + escapeHtml(p.fecha_perdido || '') + (p.motivo_perdida ? ' · ' + escapeHtml(p.motivo_perdida) : '') +
        '</div>'
      : '';

    return (
      '<div class="modal-header"><div class="modal-title">Editar unidad — ' + escapeHtml(p.address || ('#' + p.id)) + '</div>' +
      '<button class="modal-close" data-close>&times;</button></div>' +
      '<div class="modal-body">' +
      perdidoNote +
      '<div class="form-section">Estado</div>' +
      '<div class="form-grid">' +
      '<div class="form-group"><label>Etapa del pipeline</label><select data-field="stage">' + stageOptions + '</select></div>' +
      '<div class="form-group"><label>Tipo de contrato</label><select data-field="tipo_contrato">' + tipoOptions + '</select></div>' +
      '</div>' +
      fieldsHtml +
      '</div>' +
      '<div class="modal-footer" style="justify-content:space-between;">' +
      '<button class="btn btn-ghost" id="unit-delete-btn" style="color:var(--red-dark);">🗑 Eliminar unidad</button>' +
      '<div style="display:flex;gap:8px;">' +
      '<button class="btn btn-ghost" data-close>Cancelar</button>' +
      (p.perdido
        ? '<button class="btn btn-ghost" id="unit-reopen-btn">Reabrir</button>'
        : '<button class="btn btn-ghost" id="unit-mark-lost-btn" style="color:var(--red-dark);">Marcar como perdido</button>') +
      '<button class="btn btn-primary" id="unit-save-btn">Guardar</button>' +
      '</div>' +
      '</div>'
    );
  }

  function markLostFormHtml() {
    const motivoOptions = Config.MOTIVOS_PERDIDA.map(function (m) {
      return '<option value="' + escapeHtml(m) + '">' + escapeHtml(m) + '</option>';
    }).join('');
    return (
      '<div class="modal-header"><div class="modal-title">Marcar como perdido</div><button class="modal-close" data-close>&times;</button></div>' +
      '<div class="modal-body"><div class="form-grid">' +
      '<div class="form-group full"><label>Motivo</label><select id="lost-motivo">' + motivoOptions + '</select></div>' +
      '</div></div>' +
      '<div class="modal-footer"><button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-danger" id="lost-save-btn">Marcar como perdido</button></div>'
    );
  }

  function openMarkLostModal(propId) {
    const found = State.findPropiedad(propId);
    if (!found) return;
    const p = found.propiedad;
    const overlay = openModal(markLostFormHtml());
    overlay.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', closeModal); });
    overlay.querySelector('#lost-save-btn').addEventListener('click', function () {
      const motivo = document.getElementById('lost-motivo').value;
      p.perdido = true;
      p.fecha_perdido = todayStr();
      p.motivo_perdida = motivo;
      pushStageHistory(p, 'perdido');
      closeModal();
      State.persistAndNotify();
      toast('Marcado como perdido.', 'success');
    });
  }

  function reopenDeal(propId) {
    const found = State.findPropiedad(propId);
    if (!found) return;
    const p = found.propiedad;
    confirmAction('¿Reabrir este deal? Se quitará la marca de perdido.', function () {
      p.perdido = false;
      p.fecha_perdido = '';
      p.motivo_perdida = '';
      State.persistAndNotify();
      toast('Deal reabierto.', 'success');
    });
  }

  // Elimina permanentemente una unidad (fila en Supabase incluida). Es
  // irreversible, así que se confirma con la dirección exacta antes de tocar
  // nada, y cualquier error de red deja la unidad intacta (deletePropiedades
  // no toca el estado local si el DELETE en la nube falla).
  function deletePropiedad(propId) {
    const found = State.findPropiedad(propId);
    if (!found) return;
    const p = found.propiedad;
    const label = p.address || ('Unidad #' + p.id);
    confirmAction('¿Eliminar permanentemente "' + label + '"? Esta acción no se puede deshacer: la unidad y su historial se borran de la base de datos.', function () {
      toast('Eliminando unidad…', 'info');
      State.deletePropiedades([p.id]).then(function () {
        toast('Unidad eliminada.', 'success');
      }).catch(function (err) {
        toast('No se pudo eliminar: ' + err.message, 'error');
      });
    });
  }

  function openUnitEditModal(propId) {
    const found = State.findPropiedad(propId);
    if (!found) return;
    const p = found.propiedad;
    const overlay = openModal(unitEditFormHtml(p));
    overlay.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', closeModal); });
    const lostBtn = overlay.querySelector('#unit-mark-lost-btn');
    if (lostBtn) lostBtn.addEventListener('click', function () { openMarkLostModal(propId); });
    const reopenBtn = overlay.querySelector('#unit-reopen-btn');
    if (reopenBtn) reopenBtn.addEventListener('click', function () { reopenDeal(propId); });
    const deleteBtn = overlay.querySelector('#unit-delete-btn');
    if (deleteBtn) deleteBtn.addEventListener('click', function () { deletePropiedad(propId); });
    overlay.querySelector('#unit-save-btn').addEventListener('click', function () {
      const prevStage = p.stage;
      overlay.querySelectorAll('[data-field]').forEach(function (input) {
        p[input.dataset.field] = input.value;
      });
      if (p.stage !== prevStage) pushStageHistory(p, p.stage);
      closeModal();
      State.persistAndNotify();
      toast('Unidad actualizada.', 'success');
    });
  }

  function clientEditFormHtml(c) {
    const n = (c.propiedades || []).length;
    return (
      '<div class="modal-header"><div class="modal-title">' + (c.__isNew ? 'Nuevo cliente' : 'Editar cliente') + '</div>' +
      '<button class="modal-close" data-close>&times;</button></div>' +
      '<div class="modal-body"><div class="form-grid">' +
      '<div class="form-group full"><label>Nombre</label><input type="text" data-field="name" value="' + escapeHtml(c.name || '') + '"></div>' +
      '<div class="form-group"><label>Correo</label><input type="email" data-field="email" value="' + escapeHtml(c.email || '') + '"></div>' +
      '<div class="form-group"><label>Teléfono</label><input type="text" data-field="phone" value="' + escapeHtml(c.phone || '') + '"></div>' +
      '</div></div>' +
      '<div class="modal-footer" style="justify-content:space-between;">' +
      (c.__isNew ? '<span></span>' : '<button class="btn btn-ghost" id="client-delete-btn" style="color:var(--red-dark);">🗑 Eliminar cliente' + (n ? ' (' + n + (n === 1 ? ' unidad)' : ' unidades)') : '') + '</button>') +
      '<div style="display:flex;gap:8px;"><button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary" id="client-save-btn">Guardar</button></div>' +
      '</div>'
    );
  }

  // Elimina permanentemente un cliente y TODAS sus unidades (cada unidad es
  // su propia fila en Supabase). Irreversible — se confirma mostrando el
  // nombre exacto y cuántas unidades se van a borrar con él.
  function deleteClient(clientId) {
    const client = State.findClientById(clientId);
    if (!client) return;
    const n = (client.propiedades || []).length;
    const label = client.name || 'este cliente';
    const unidadesTxt = n ? (' y ' + n + (n === 1 ? ' unidad' : ' unidades')) : '';
    confirmAction('¿Eliminar permanentemente a "' + label + '"' + unidadesTxt + '? Esta acción no se puede deshacer: todos sus datos se borran de la base de datos.', function () {
      toast('Eliminando cliente…', 'info');
      State.deleteClient(clientId).then(function () {
        toast('Cliente eliminado.', 'success');
      }).catch(function (err) {
        toast('No se pudo eliminar: ' + err.message, 'error');
      });
    });
  }

  function openClientEditModal(clientId) {
    const client = State.findClientById(clientId);
    if (!client) return;
    const overlay = openModal(clientEditFormHtml(client));
    overlay.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', closeModal); });
    const deleteBtn = overlay.querySelector('#client-delete-btn');
    if (deleteBtn) deleteBtn.addEventListener('click', function () { deleteClient(clientId); });
    overlay.querySelector('#client-save-btn').addEventListener('click', function () {
      overlay.querySelectorAll('[data-field]').forEach(function (input) {
        client[input.dataset.field] = input.value;
      });
      closeModal();
      State.persistAndNotify();
      toast('Cliente actualizado.', 'success');
    });
  }

  function openNewClientWithUnitModal() {
    const state = State.getState();
    const html =
      '<div class="modal-header"><div class="modal-title">Nuevo cliente + unidad</div><button class="modal-close" data-close>&times;</button></div>' +
      '<div class="modal-body"><div class="form-grid">' +
      '<div class="form-group full"><label>Nombre</label><input type="text" id="nc-name"></div>' +
      '<div class="form-group"><label>Correo</label><input type="email" id="nc-email"></div>' +
      '<div class="form-group"><label>Teléfono</label><input type="text" id="nc-phone"></div>' +
      '<div class="form-group full"><label>Dirección de la unidad</label><input type="text" id="nc-address"></div>' +
      '<div class="form-group"><label>Comuna</label><input type="text" id="nc-comuna"></div>' +
      '</div></div>' +
      '<div class="modal-footer"><button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary" id="nc-save-btn">Crear</button></div>';
    const overlay = openModal(html);
    overlay.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', closeModal); });
    overlay.querySelector('#nc-save-btn').addEventListener('click', function () {
      const name = document.getElementById('nc-name').value.trim();
      const email = document.getElementById('nc-email').value.trim();
      const phone = document.getElementById('nc-phone').value.trim();
      const address = document.getElementById('nc-address').value.trim();
      const comuna = document.getElementById('nc-comuna').value.trim();
      if (!name) { toast('El nombre es obligatorio.', 'error'); return; }
      const client = DomusData.createClient({ name: name, email: email, phone: phone });
      const propId = DomusData.nextPropertyId(State.getAllPropiedades());
      const prop = DomusData.createPropiedad(propId, client.id, { address: address, comuna: comuna, vendedora: State.getState().userEmail || '' });
      pushStageHistory(prop, 'prospecto');
      client.propiedades.push(prop);
      state.clients.push(client);
      closeModal();
      State.persistAndNotify();
      toast('Cliente y unidad creados.', 'success');
    });
  }

  function confirmAction(message, onConfirm) {
    const html =
      '<div class="modal-header"><div class="modal-title">Confirmar</div><button class="modal-close" data-close>&times;</button></div>' +
      '<div class="modal-body">' + escapeHtml(message) + '</div>' +
      '<div class="modal-footer"><button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-danger" id="confirm-btn">Confirmar</button></div>';
    const overlay = openModal(html);
    overlay.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', closeModal); });
    overlay.querySelector('#confirm-btn').addEventListener('click', function () {
      closeModal();
      onConfirm();
    });
  }

  window.DomusApp = {
    escapeHtml: escapeHtml,
    fmtMoney: fmtMoney,
    fmtDate: fmtDate,
    todayStr: todayStr,
    currentMonthStr: currentMonthStr,
    captureFocus: captureFocus,
    restoreFocus: restoreFocus,
    toast: toast,
    openModal: openModal,
    closeModal: closeModal,
    setView: setView,
    selectClient: selectClient,
    openUnitEditModal: openUnitEditModal,
    openClientEditModal: openClientEditModal,
    openNewClientWithUnitModal: openNewClientWithUnitModal,
    confirmAction: confirmAction,
  };

  // ---------- rendering / navigation ----------
  const VIEW_TITLES = {
    pipeline: 'Pipeline de ventas',
    clientes: 'Clientes',
    departamentos: 'Departamentos',
    resumen: 'Resumen',
    contratos: 'Contratos y Pagos',
    cotizador: 'Cotizador de Amoblados',
    equipo: 'Equipo y Claves',
    proximamente: 'Próximamente',
  };

  function renderProximamente(root) {
    root.innerHTML =
      '<div class="empty">' +
      '<div class="empty-title">Próximamente</div>' +
      '<p>Generación de contratos, gestión de fotografía, alianzas, criterios V4, formularios y propietarios agrupados se incorporarán en una próxima etapa.</p>' +
      '</div>';
  }

  function render() {
    const state = State.getState();
    const root = document.getElementById('view-root');
    document.getElementById('page-title').textContent = VIEW_TITLES[state.view] || '';

    document.querySelectorAll('.nav-item').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.view === state.view);
    });

    if (state.loading) {
      root.innerHTML = '<div class="empty"><div class="empty-title">Cargando datos…</div></div>';
      return;
    }

    const views = window.DomusViews || {};
    if (state.view === 'proximamente') { renderProximamente(root); return; }
    const fn = views[state.view];
    if (typeof fn === 'function') {
      fn(root);
    } else {
      root.innerHTML = '<div class="empty"><div class="empty-title">Vista no encontrada</div></div>';
    }
  }

  function updateSaveIndicator(status, extra) {
    const el = document.getElementById('save-indicator');
    const text = document.getElementById('save-indicator-text');
    if (!el || !text) return;
    el.classList.remove('idle', 'saving', 'saved', 'error');
    el.classList.add(status);
    const labels = {
      idle: 'Sin cambios',
      saving: 'Guardando…',
      saved: 'Guardado',
      error: 'Error al guardar (respaldo local activo) — click para ver detalle',
    };
    text.textContent = labels[status] || status;
    if (status === 'error' && extra) {
      toast('No se pudo guardar en la nube: ' + extra + '. Tus cambios quedaron respaldados en este navegador.', 'error');
    }
  }

  // El toast de error se desvanece solo a los pocos segundos, así que el
  // indicador "Error al guardar" queda clickeable mientras el estado siga en
  // error: reabre el detalle exacto (con el código/mensaje real de Supabase)
  // y permite reintentar el guardado sin tener que editar algo primero.
  function openSaveErrorModal() {
    const detail = Api.getLastErrorDetail() || 'Error desconocido.';
    const html =
      '<div class="modal-header"><div class="modal-title">Error al guardar en la nube</div><button class="modal-close" data-close>&times;</button></div>' +
      '<div class="modal-body">' +
      '<p>' + escapeHtml(detail) + '</p>' +
      '<p class="text-muted">Tus cambios quedaron respaldados en este navegador y no se han perdido, pero no se han sincronizado con Supabase. Si cierras esta pestaña o cambias de navegador antes de que el guardado funcione, esos cambios no estarán disponibles en otros dispositivos.</p>' +
      '</div>' +
      '<div class="modal-footer"><button class="btn btn-ghost" data-close>Cerrar</button><button class="btn btn-primary" id="save-retry-btn">Reintentar guardado</button></div>';
    const overlay = openModal(html);
    overlay.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', closeModal); });
    overlay.querySelector('#save-retry-btn').addEventListener('click', function () {
      closeModal();
      toast('Reintentando guardado…', 'info');
      State.persistAndNotify();
    });
  }

  // ---------- login screen ----------
  function showLogin() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app').classList.remove('visible');
  }

  function showApp(userLabel, demo) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').classList.add('visible');
    document.getElementById('user-email-label').textContent = userLabel || '—';
    document.getElementById('user-avatar').textContent = (userLabel || '?').charAt(0).toUpperCase();
    document.getElementById('demo-pill').style.display = demo ? 'block' : 'none';
  }

  async function bootAuthenticated(userLabel, demo) {
    showApp(userLabel, demo);
    State.setState({ demoMode: !!demo, userEmail: userLabel, loading: true, loadError: '' });
    try {
      let rows;
      if (demo) {
        const res = await fetch('data/seed_leads.json');
        if (!res.ok) throw new Error('No se pudo cargar data/seed_leads.json');
        rows = await res.json();
      } else {
        rows = await Api.loadFromCloud();
      }
      State.loadRows(rows);
      render();
    } catch (err) {
      console.error(err);
      // Fall back to local backup if the network read failed, so the app is
      // still usable and nobody loses visibility into their data.
      const backup = Api.loadBackupLocal();
      if (backup && backup.rows && backup.rows.length) {
        State.loadRows(backup.rows);
        toast('No se pudo conectar a Supabase. Mostrando el último respaldo local (' + new Date(backup.savedAt).toLocaleString('es-CL') + ').', 'error');
        render();
      } else {
        State.setState({ loading: false, loadError: err.message });
        toast('Error cargando datos: ' + err.message, 'error');
        render();
      }
    }
  }

  function wireNav() {
    document.getElementById('sidebar-nav').addEventListener('click', function (e) {
      const btn = e.target.closest('.nav-item');
      if (!btn || btn.classList.contains('disabled')) return;
      setView(btn.dataset.view);
    });
    document.getElementById('logout-btn').addEventListener('click', function () {
      Api.logout();
      State.setState({ clients: [], loading: true, demoMode: false, userEmail: '' });
      showLogin();
    });
  }

  function wireLogin() {
    const form = document.getElementById('login-form');
    const errEl = document.getElementById('login-error');
    const submitBtn = document.getElementById('login-submit');
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      errEl.textContent = '';
      submitBtn.disabled = true;
      submitBtn.textContent = 'Ingresando…';
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;
      try {
        await Api.login(email, password);
        await bootAuthenticated(email, false);
      } catch (err) {
        errEl.textContent = err.message || 'Error al iniciar sesión.';
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Iniciar sesión';
      }
    });

    document.getElementById('demo-btn').addEventListener('click', async function () {
      await bootAuthenticated('demo@domus-rentals.com (demo)', true);
    });
  }

  function init() {
    wireNav();
    wireLogin();
    State.subscribe(render);
    Api.onStatusChange(updateSaveIndicator);
    Api.onAuthExpired(function () {
      toast('Tu sesión expiró. Vuelve a iniciar sesión.', 'error');
      showLogin();
    });
    const saveIndicatorEl = document.getElementById('save-indicator');
    if (saveIndicatorEl) {
      saveIndicatorEl.addEventListener('click', function () {
        if (Api.getSaveStatus() === 'error') openSaveErrorModal();
      });
    }

    if (Api.isLoggedIn()) {
      bootAuthenticated(Api.getStoredEmail(), false);
    } else {
      showLogin();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
