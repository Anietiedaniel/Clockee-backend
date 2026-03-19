import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

// Hash plain text password
export async function hashPassword(password) {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

// Compare password with hashed password
export async function verifyPassword(plain, hashed) {
  return await bcrypt.compare(plain, hashed);
}
