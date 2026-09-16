// Owner-confirmed (2026-09-16): the only currently approved gear characteristic
// dataType is "number". Extensible, but new values require explicit owner approval.
export const GEAR_CHARACTERISTIC_DATA_TYPES = Object.freeze(['number'])

export function isSupportedCharacteristicDataType(value) {
  return GEAR_CHARACTERISTIC_DATA_TYPES.includes(value)
}
