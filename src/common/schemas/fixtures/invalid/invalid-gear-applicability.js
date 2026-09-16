import { validGearsCollection } from '#/common/schemas/fixtures/valid/gears.js'

export const dataset = 'gears'
export const invalidPayload = {
  ...validGearsCollection,
  items: [
    {
      ...validGearsCollection.items[0],
      applicableCharacteristics: [
        {
          ...validGearsCollection.items[0].applicableCharacteristics[0],
          fixed: 'yes'
        }
      ]
    }
  ]
}
