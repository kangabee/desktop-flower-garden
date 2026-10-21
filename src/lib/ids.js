// 사용자에게 보이지 않는 식별자
//  - 정원 ID: 설치(정원)마다 하나. 내가 보낸 씨앗을 내가 받는 걸 막고, 보낸 정원을 기록하는 데 쓴다.
//  - 씨앗 ID: 선물 링크마다 하나. 같은 씨앗을 한 정원에서 두 번 받는 걸 막는다.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function makeId(length = 12) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => ALPHABET[b & 31]).join('');
}

/** 링크를 손으로 고쳐 다른 꽃으로 바꾸는 걸 막는 간단한 검증값 (FNV-1a) */
export function seedCheck(...parts) {
  let h = 0x811c9dc5;
  for (const ch of parts.join('|')) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}
