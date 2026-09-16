import Joi from 'joi'

const MIN_LATITUDE = -90
const MAX_LATITUDE = 90
const MIN_LONGITUDE = -180
const MAX_LONGITUDE = 180

// Both latitude and longitude are required together; a coordinate cannot be one-sided.
export const coordinateSchema = Joi.object({
  latitude: Joi.number()
    .strict()
    .min(MIN_LATITUDE)
    .max(MAX_LATITUDE)
    .required(),
  longitude: Joi.number()
    .strict()
    .min(MIN_LONGITUDE)
    .max(MAX_LONGITUDE)
    .required()
})
