export const LAST_MILE_DELIVERY_RESULTS = {
  delivered: {
    label: 'Entregado',
    substates: [
      'Pedido ya pagado o credito',
      'Pedido contra entrega pagado con POS/TRANS/YAPE/EFECTIVO',
      'Entregado en agencia',
      'Entrega parcial',
    ],
  },
  not_delivered: {
    label: 'No entregado',
    substates: [
      'Rechazado',
      'Pedido duplicado',
      'Datos erroneos',
      'Error de direccion',
      'Cliente solicita reprogramar',
      'Soporte solicita reprogramar',
      'Soporte pide que lo retornen y anulen',
      'Otros, especificar',
    ],
  },
} as const;

export const LAST_MILE_PICKUP_RESULTS = {
  pickup_successful: {
    label: 'Recojo exitoso',
    substates: ['Recojo conforme', 'Recojo parcial'],
  },
  not_picked_up: {
    label: 'No recogido',
    substates: [
      'Local cerrado',
      'Mercaderia no lista',
      'Solicita reprogramar recojo',
      'Direccion errada',
      'Por indicacion de soporte',
    ],
  },
} as const;

export const MERCHANDISE_CONDITIONS = [
  'Entrega conforme',
  'Items sobrantes',
] as const;

export const PARTIAL_DELIVERY_MERCHANDISE_CONDITIONS = [
  'Items faltantes',
  'Cliente rechaza parte de la mercaderia',
  'Entrega complementaria correspondiente a guia entregada anteriormente',
] as const;

export const LAST_MILE_EVIDENCE_RULES = {
  deliveredOrPartial: [
    {
      key: 'merchandise_photos',
      label: 'Fotos de mercaderia',
      maxPhotos: 10,
      hint:
        'Tomar foto del rotulado y todos los lados de la caja que evidencien el estado del paquete entregado.',
    },
    {
      key: 'document_photos',
      label: 'Fotos de guia, factura, recibo o voucher',
      maxPhotos: 10,
      hint:
        'La foto de la guia o factura debe tener sello de recibido o firma, nombre y DNI de la persona que recibe.',
    },
    {
      key: 'facade_photos',
      label: 'Foto de fachada',
      maxPhotos: 10,
      hint: 'Agrega foto de la fachada del local donde se realiza la entrega del pedido.',
    },
  ],
  failedVisit: {
    key: 'facade_photos',
    label: 'Foto de fachada',
    maxPhotos: 10,
    hint: 'Evidenciar la visita a la direccion de entrega.',
  },
} as const;
