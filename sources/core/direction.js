const DIRECTIONS = [
  'ahead',
  'ahead and right',
  'to your right',
  'behind and right',
  'behind',
  'behind and left',
  'to your left',
  'ahead and left',
];

export function directionLabel(radians) {
  const degrees = ((radians * 180 / Math.PI) % 360 + 360) % 360;
  return DIRECTIONS[Math.round(degrees / 45) % DIRECTIONS.length];
}
