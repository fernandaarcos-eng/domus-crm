// view-correos.js — "Correos tipo": copyable email templates for common pipeline moments.
// Minimal port of the old app's CORREOS concept: a static list of templates the
// team can copy and personalize, tied loosely to pipeline stages.
(function () {
  'use strict';
  const App = window.DomusApp;

  const CORREOS = [
    {
      stage: 'Reunión agendada',
      title: 'Confirmación de reunión',
      body: 'Hola {{nombre}},\n\nConfirmamos nuestra reunión para revisar la administración de tu propiedad en {{direccion}}. Quedamos atentos a cualquier ajuste de horario.\n\nSaludos,\nEquipo Domus Rentals',
    },
    {
      stage: 'Resultado reunión',
      title: 'Seguimiento post-reunión',
      body: 'Hola {{nombre}},\n\nGracias por tu tiempo en la reunión. Como conversamos, te dejamos un resumen de la propuesta de administración para {{direccion}} y los próximos pasos.\n\nQuedamos atentos a tus comentarios.\n\nSaludos,\nEquipo Domus Rentals',
    },
    {
      stage: 'Correo de datos',
      title: 'Solicitud de datos de la propiedad',
      body: 'Hola {{nombre}},\n\nPara avanzar con la publicación de tu departamento en {{direccion}}, necesitamos que nos compartas: datos de acceso/wifi, estacionamiento, equipamiento disponible y cualquier clave relevante (conserjería, edificio, etc.).\n\nGracias,\nEquipo Domus Rentals',
    },
    {
      stage: 'Contrato enviado',
      title: 'Envío de contrato de administración',
      body: 'Hola {{nombre}},\n\nTe adjuntamos el contrato de administración para tu unidad en {{direccion}}. Cualquier duda, quedamos atentos antes de la firma.\n\nSaludos,\nEquipo Domus Rentals',
    },
    {
      stage: 'Contrato firmado',
      title: 'Confirmación de contrato firmado',
      body: 'Hola {{nombre}},\n\n¡Contrato firmado! Ahora comenzamos con la preparación de fotografías y publicación de tu unidad en {{direccion}}.\n\nSaludos,\nEquipo Domus Rentals',
    },
    {
      stage: 'Foto publicada',
      title: 'Publicación en plataformas',
      body: 'Hola {{nombre}},\n\nTu unidad en {{direccion}} ya está publicada en nuestras plataformas ({{plataformas}}). Te avisaremos apenas tengamos la primera reserva.\n\nSaludos,\nEquipo Domus Rentals',
    },
    {
      stage: 'Cliente activo',
      title: 'Bienvenida como cliente activo',
      body: 'Hola {{nombre}},\n\n¡Bienvenido/a como cliente activo de Domus Rentals! Tu unidad en {{direccion}} ya está operativa. Te iremos informando de reservas y liquidaciones mensuales.\n\nSaludos,\nEquipo Domus Rentals',
    },
  ];

  function render(root) {
    let html = '<p class="text-muted" style="margin-bottom:16px;font-size:13px;">Plantillas de correo para los momentos más comunes del pipeline. Copia el texto y personalízalo antes de enviarlo (reemplaza {{nombre}}, {{direccion}}, {{plataformas}}).</p>';
    CORREOS.forEach(function (c, i) {
      html += '<div class="correo-card">' +
        '<div class="correo-stage">' + App.escapeHtml(c.stage) + '</div>' +
        '<div class="correo-title">' + App.escapeHtml(c.title) + '</div>' +
        '<div class="correo-body">' + App.escapeHtml(c.body) + '</div>' +
        '<button class="btn btn-ghost btn-sm" data-copy="' + i + '">Copiar</button>' +
        '</div>';
    });
    root.innerHTML = html;

    root.querySelectorAll('[data-copy]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const text = CORREOS[Number(btn.dataset.copy)].body;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () {
            App.toast('Correo copiado al portapapeles.', 'success');
          }).catch(function () {
            App.toast('No se pudo copiar automáticamente. Selecciona el texto manualmente.', 'error');
          });
        } else {
          App.toast('El navegador no permite copiar automáticamente.', 'error');
        }
      });
    });
  }

  window.DomusViews = window.DomusViews || {};
  window.DomusViews.correos = render;
})();
