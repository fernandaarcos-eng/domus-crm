// config.js — Supabase config + shared constants (no DOM, no network calls here)
(function (global) {
  'use strict';

  const SUPA_URL = 'https://nahftiusccznyrqivttj.supabase.co';
  const SUPA_KEY = 'sb_publishable_FBPkpPiX0qWwFw629nkYBQ_pConS-q5'; // publishable/anon key, safe in frontend

  // Pipeline stage order (per UNIT / propiedad, not per client)
  const STAGES = [
    { key: 'prospecto', label: 'Prospecto' },
    { key: 'reunion_agendada', label: 'Reunión agendada' },
    { key: 'reunion_cursada', label: 'Reunión cursada' },
    { key: 'resultado_reunion', label: 'Resultado reunión' },
    { key: 'correo_datos', label: 'Correo de datos' },
    { key: 'contrato_enviado', label: 'Contrato enviado' },
    { key: 'contrato_firmado', label: 'Contrato firmado' },
    { key: 'amob_contrato_firmado', label: 'Amob. contrato firmado' },
    { key: 'amob_contrato_enviado', label: 'Amob. contrato enviado' },
    { key: 'amob_proceso', label: 'Amoblamiento en proceso' },
    { key: 'amob_pagado', label: 'Amoblamiento pagado' },
    { key: 'foto_tomada', label: 'Foto tomada' },
    { key: 'foto_editada', label: 'Foto editada' },
    { key: 'foto_publicada', label: 'Foto publicada' },
    { key: 'cliente_activo', label: 'Cliente activo' },
  ];

  const STAGE_LABELS = STAGES.reduce((acc, s) => { acc[s.key] = s.label; return acc; }, {});

  const TIPO_CONTRATO_LABELS = {
    admin: 'Administración (sin muebles)',
    admin_amob: 'Administración + Amoblamiento',
  };

  const RESERVA_ESTADOS = [
    { key: 'confirmada', label: 'Confirmada' },
    { key: 'en_curso', label: 'En curso' },
    { key: 'finalizada', label: 'Finalizada' },
    { key: 'cancelada', label: 'Cancelada' },
  ];

  const PLATAFORMAS = ['Airbnb', 'Booking', 'Expedia', 'Directo', 'Otro'];

  const SAVE_DEBOUNCE_MS = 1500;
  const SAVE_MAX_RETRIES = 3;
  const SAVE_RETRY_BASE_MS = 800;

  const LOCAL_STORAGE_KEYS = {
    token: 'domus_crm_token',
    email: 'domus_crm_email',
    backup: 'domus_crm_backup_rows',
    demo: 'domus_crm_demo_mode',
  };

  global.DomusConfig = {
    SUPA_URL,
    SUPA_KEY,
    STAGES,
    STAGE_LABELS,
    TIPO_CONTRATO_LABELS,
    RESERVA_ESTADOS,
    PLATAFORMAS,
    SAVE_DEBOUNCE_MS,
    SAVE_MAX_RETRIES,
    SAVE_RETRY_BASE_MS,
    LOCAL_STORAGE_KEYS,
  };
})(window);
