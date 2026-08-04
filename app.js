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
    const plataformasChecks = Config.PLATAFORMAS.map(function (pl) {
      const checked = (p.plataformas || []).indexOf(pl) !== -1 ? ' checked' : '';
      return '<label style="display:flex;align-items:center;gap:6px;font-weight:400;"><input type="checkbox" style="width:auto;" name="plataforma" value="' + pl + '"' + checked + '> ' + pl + '</label>';
    }).join('');

    let fieldsHtml = '';
    UNIT_FIELD_GROUPS.forEach(function (group) {
      fieldsHtml += '<div class="form-section">' + escapeHtml(group.title) + '</div><div class="form-grid">';
      group.fields.forEach(function (f) {
        const key = f[0], label = f[1];
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

    return (
      '<div class="modal-header"><div class="modal-title">Editar unidad — ' + escapeHtml(p.address || ('#' + p.id)) + '</div>' +
      '<button class="modal-close" data-close>&times;</button></div>' +
      '<div class="modal-body">' +
      '<div class="form-section">Estado</div>' +
      '<div class="form-grid">' +
      '<div class="form-group"><label>Etapa del pipeline</label><select data-field="stage">' + stageOptions + '</select></div>' +
      '<div class="form-group"><label>Tipo de contrato</label><select data-field="tipo_contrato">' + tipoOptions + '</select></div>' +
      '<div class="form-group full"><label>Plataformas</label><div style="display:flex;gap:14px;flex-wrap:wrap;">' + plataformasChecks + '</div></div>' +
      '</div>' +
      fieldsHtml +
      '</div>' +
      '<div class="modal-footer">' +
      '<button class="btn btn-ghost" data-close>Cancelar</button>' +
      '<button class="btn btn-primary" id="unit-save-btn">Guardar</button>' +
      '</div>'
    );
  }

  function openUnitEditModal(propId) {
    const found = State.findPropiedad(propId);
    if (!found) return;
    const p = found.propiedad;
    const overlay = openModal(unitEditFormHtml(p));
    overlay.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', closeModal); });
    overlay.querySelector('#unit-save-btn').addEventListener('click', function () {
      overlay.querySelectorAll('[data-field]').forEach(function (input) {
        p[input.dataset.field] = input.value;
      });
      p.plataformas = Array.from(overlay.querySelectorAll('input[name="plataforma"]:checked')).map(function (c) { return c.value; });
      closeModal();
      State.persistAndNotify();
      toast('Unidad actualizada.', 'success');
    });
  }

  function clientEditFormHtml(c) {
    return (
      '<div class="modal-header"><div class="modal-title">' + (c.__isNew ? 'Nuevo cliente' : 'Editar cliente') + '</div>' +
      '<button class="modal-close" data-close>&times;</button></div>' +
      '<div class="modal-body"><div class="form-grid">' +
      '<div class="form-group full"><label>Nombre</label><input type="text" data-field="name" value="' + escapeHtml(c.name || '') + '"></div>' +
      '<div class="form-group"><label>Correo</label><input type="email" data-field="email" value="' + escapeHtml(c.email || '') + '"></div>' +
      '<div class="form-group"><label>Teléfono</label><input type="text" data-field="phone" value="' + escapeHtml(c.phone || '') + '"></div>' +
      '</div></div>' +
      '<div class="modal-footer"><button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary" id="client-save-btn">Guardar</button></div>'
    );
  }

  function openClientEditModal(clientId) {
    const client = State.findClientById(clientId);
    if (!client) return;
    const overlay = openModal(clientEditFormHtml(client));
    overlay.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', closeModal); });
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
      const prop = DomusData.createPropiedad(propId, client.id, { address: address, comuna: comuna });
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
    finanzas: 'Finanzas y Logística',
    reservas: 'Reservas',
    contratos: 'Contratos y Pagos',
    equipo: 'Equipo y Claves',
    correos: 'Correos tipo',
    proximamente: 'Próximamente',
  };

  function renderProximamente(root) {
    root.innerHTML =
      '<div class="empty">' +
      '<div class="empty-title">Próximamente</div>' +
      '<p>Cotizador de amoblados, generación de contratos, gestión de fotografía, alianzas, criterios V4, formularios y propietarios agrupados se incorporarán en una próxima etapa.</p>' +
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
      error: 'Error al guardar (respaldo local activo)',
    };
    text.textContent = labels[status] || status;
    if (status === 'error' && extra) {
      toast('No se pudo guardar en la nube: ' + extra + '. Tus cambios quedaron respaldados en este navegador.', 'error');
    }
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
        const res = await fetch('seed_leads.json');
        if (!res.ok) throw new Error('No se pudo cargar seed_leads.json');
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
