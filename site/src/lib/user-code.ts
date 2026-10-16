export const USER_CODE_ALPHABET = "BCDFGHJKLMNPQRSTVWXZ";
export const USER_CODE_LENGTH = 8;
const USER_CODE = new RegExp(`^[${USER_CODE_ALPHABET}]{${USER_CODE_LENGTH}}$`);

export function userCodeLetters(input: string) {
  return input.toUpperCase().replace(/[^A-Z]/g, "");
}

export function normalizeUserCode(input: unknown) {
  if (typeof input !== "string") return null;
  const code = userCodeLetters(input);
  return USER_CODE.test(code) ? code : null;
}

export function formatUserCode(letters: string) {
  return letters.length > 4 ? `${letters.slice(0, 4)}-${letters.slice(4)}` : letters;
}
