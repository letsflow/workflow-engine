export function encode(buffer: Buffer): string {
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const base = alphabet.length;

  let bigint = BigInt('0');
  for (let i = 0; i < buffer.length; i++) {
    bigint = bigint * BigInt(256) + BigInt(buffer[i]);
  }

  let encoded = '';
  while (bigint > BigInt(0)) {
    encoded = alphabet[Number(bigint % BigInt(base))] + encoded;
    bigint = bigint / BigInt(base);
  }

  return encoded;
}
