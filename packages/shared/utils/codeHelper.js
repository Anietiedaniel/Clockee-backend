import bcrypt from "bcrypt";

export function generateRandomCode(length = 6) {
  const digits = "0123456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += digits[Math.floor(Math.random() * digits.length)];
  }
  return code;
}

// Hash array of codes
export async function hashCodes(codes) {
  const saltRounds = 10;
  const hashed = [];
  for (const c of codes) {
    const hash = await bcrypt.hash(c, saltRounds);
    hashed.push({ code: hash, used: false });
  }
  return hashed;
}
