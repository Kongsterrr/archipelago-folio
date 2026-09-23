// One fixed golden-hour direction shared by direct light, sky and sea reflection.
// Direction points from the world toward the sun; normalized by each consumer.
export const SUN_DIRECTION = Object.freeze([-0.66, 0.375, -0.65]);
export const SUNSET = Object.freeze({
  name: 'Sunset Bay',
  sun: '#ffae61', sunCore: '#fff0bf',
  zenith: '#463e78', upperSky: '#8f6194', horizon: '#ef906f', horizonGlow: '#ffd59a',
  fill: '#ada2da', ground: '#715363', fog: '#bd8395',
  deepWater: '#283e66', middleWater: '#345879', shallowWater: '#4c9b94',
  reflection: '#ffc477', foam: '#f3c9a5',
});
