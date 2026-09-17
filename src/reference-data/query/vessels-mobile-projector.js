// Step 16: vessel mobile projection. Pure function; never mutates the canonical vessel.

function resolvePln(vessel) {
  return (
    vessel.identifiers?.externalMark ??
    vessel.identifiers?.registrationNumber ??
    null
  )
}

function resolveDisplayName(vessel, pln) {
  if (typeof vessel.namePln === 'string' && vessel.namePln.trim().length > 0) {
    return vessel.namePln
  }
  if (pln) {
    return `${vessel.name} ${pln}`
  }
  return vessel.name
}

export function projectVesselToMobile(vessel) {
  const pln = resolvePln(vessel)
  return {
    id: vessel.id,
    name: vessel.name,
    pln,
    cfr: vessel.identifiers?.cfr ?? null,
    displayName: resolveDisplayName(vessel, pln),
    lengthOverallMetres: vessel.lengthOverallMetres
  }
}
