export function getOperationalZone({
  department,
  province,
  district,
}: {
  department?: string | null;
  province?: string | null;
  district?: string | null;
}) {
  const dep = normalize(department);
  const prov = normalize(province);
  const dist = normalizeDistrictAlias(district);

  if (prov === 'CALLAO') {
    return 'CALLAO';
  }

  if (
    dep === 'LIMA' &&
    ['LIMA', 'LIMA METROPOLITANA', ''].includes(prov)
  ) {
    if (dist === 'SAN JUAN DE LURIGANCHO') {
      return 'LIMA ESTE 1';
    }

    if (
      [
        'PUCUSANA',
        'PUNTA HERMOSA',
        'PUNTA NEGRA',
        'SAN BARTOLO',
        'SANTA MARIA DEL MAR',
      ].includes(dist)
    ) {
      return 'LIMA PLAYAS';
    }

    if (
      [
        'ANCON',
        'CARABAYLLO',
        'COMAS',
        'INDEPENDENCIA',
        'LOS OLIVOS',
        'PUENTE PIEDRA',
        'SAN MARTIN DE PORRES',
        'SANTA ROSA',
      ].includes(dist)
    ) {
      return 'LIMA NORTE';
    }

    if (
      [
        'CHORRILLOS',
        'LURIN',
        'PACHACAMAC',
        'SAN JUAN DE MIRAFLORES',
        'VILLA EL SALVADOR',
        'VILLA MARIA DEL TRIUNFO',
      ].includes(dist)
    ) {
      return 'LIMA SUR';
    }

    if (
      [
        'MAGDALENA DEL MAR',
        'SAN MIGUEL',
        'JESUS MARIA',
        'LINCE',
        'PUEBLO LIBRE',
      ].includes(dist)
    ) {
      return 'LIMA OESTE';
    }

    if (
      [
        'BARRANCO',
        'MIRAFLORES',
        'SAN BORJA',
        'SAN ISIDRO',
        'SANTIAGO DE SURCO',
        'SURQUILLO',
      ].includes(dist)
    ) {
      return 'LIMA MODERNA';
    }

    if (
      [
        'CERCADO DE LIMA',
        'LIMA',
        'RIMAC',
        'EL AGUSTINO',
        'LA VICTORIA',
        'BREÑA',
      ].includes(dist)
    ) {
      return 'LIMA CENTRO';
    }

    return 'LIMA ESTE 2';
  }

  return 'PROVINCIA';
}

export function getDisplayZone(task: {
  zone?: string | null;
  department?: string | null;
  province?: string | null;
  district?: string | null;
}) {
  return (
    task.zone ||
    getOperationalZone({
      department: task.department,
      province: task.province,
      district: task.district,
    })
  );
}

function normalize(value?: string | null) {
  return (value || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizeDistrictAlias(district?: string | null) {
  const dist = normalize(district);

  const aliases: Record<string, string> = {
    SJL: 'SAN JUAN DE LURIGANCHO',
    'S.J.L': 'SAN JUAN DE LURIGANCHO',
    'S.J.L.': 'SAN JUAN DE LURIGANCHO',
    'SAN JUAN LURIGANCHO': 'SAN JUAN DE LURIGANCHO',

    SMP: 'SAN MARTIN DE PORRES',
    'S.M.P': 'SAN MARTIN DE PORRES',
    'S.M.P.': 'SAN MARTIN DE PORRES',

    SJM: 'SAN JUAN DE MIRAFLORES',
    'S.J.M': 'SAN JUAN DE MIRAFLORES',
    'S.J.M.': 'SAN JUAN DE MIRAFLORES',

    VES: 'VILLA EL SALVADOR',
    'V.E.S': 'VILLA EL SALVADOR',
    'V.E.S.': 'VILLA EL SALVADOR',

    VMT: 'VILLA MARIA DEL TRIUNFO',
    'V.M.T': 'VILLA MARIA DEL TRIUNFO',
    'V.M.T.': 'VILLA MARIA DEL TRIUNFO',
  };

  return aliases[dist] || dist;
}