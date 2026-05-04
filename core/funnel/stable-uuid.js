import crypto from 'crypto';

export function createStableUuidFactory(seed) {
  let counter = 0;
  return function uuid(label = '') {
    counter += 1;
    const hash = crypto
      .createHash('sha256')
      .update(`${seed}:${counter}:${label}`)
      .digest('hex');
    return [
      hash.slice(0, 8),
      hash.slice(8, 12),
      `4${hash.slice(12, 15)}`,
      `8${hash.slice(15, 18)}`,
      hash.slice(20, 32),
    ].join('-');
  };
}
