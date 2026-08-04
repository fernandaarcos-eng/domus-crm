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

  // Cotizador de Amoblados — precios por tipología (valores actuales, en CLP,
  // sin IVA). "Full" = precio de lista; "Dscto" = precio con descuento
  // vigente. Estas cifras fueron verificadas contra cotizaciones reales ya
  // guardadas en la base de datos (coinciden exactamente con sus totales).
  const TIPOLOGIAS_AMOB = [
    { key: 'studio', label: 'Studio', emoji: '🏠', amobFull: 2922194, amobDscto: 2871875, adicLista: 521745, adicDscto: 408240 },
    { key: 'h1b1', label: '1 dormitorio, 1 baño', emoji: '🏘️', amobFull: 4127924, amobDscto: 3996135, adicLista: 662160, adicDscto: 595944 },
    { key: 'h2b1', label: '2 dormitorios, 1 baño', emoji: '🏡', amobFull: 5240310, amobDscto: 5103423, adicLista: 750570, adicDscto: 675513 },
    { key: 'h2b2', label: '2 dormitorios, 2 baños', emoji: '🏰', amobFull: 5297295, amobDscto: 5222875, adicLista: 822525, adicDscto: 740272 },
  ];
  const ESTILOS_AMOB = [
    { key: 'nordico', label: 'Nórdico', emoji: '❄️', desc: 'Minimalista, blancos y maderas claras' },
    { key: 'rustico', label: 'Rústico', emoji: '🌲', desc: 'Maderas oscuras, tonos tierra' },
    { key: 'industrial', label: 'Industrial', emoji: '⚙️', desc: 'Metales, negros y grises' },
    { key: 'midcentury', label: 'Mid Century', emoji: '🎨', desc: 'Colores vivos, líneas curvas' },
  ];
  const DESCUENTO_NIVELES_AMOB = [0, 5, 10, 15];
  const AIRE_COSTO_AMOB = 598990;
  const IVA_PCT_AMOB = 19;

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
    TIPOLOGIAS_AMOB,
    ESTILOS_AMOB,
    DESCUENTO_NIVELES_AMOB,
    AIRE_COSTO_AMOB,
    IVA_PCT_AMOB,
    SAVE_DEBOUNCE_MS,
    SAVE_MAX_RETRIES,
    SAVE_RETRY_BASE_MS,
    LOCAL_STORAGE_KEYS,
  };
})(window);
