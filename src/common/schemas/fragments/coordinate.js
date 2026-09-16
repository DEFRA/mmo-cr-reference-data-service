import Joi from 'joi'

// Both latitude and longitude are required together; a coordinate cannot be one-sided.
export const coordinateSchema = Joi.object({
  latitude: Joi.number().strict().min(-90).max(90).required(),
  longitude: Joi.number().strict().min(-180).max(180).required()
})
