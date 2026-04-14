import bcrypt from "bcryptjs";

const password = "Admin@12345";

const hash = await bcrypt.hash(password, 12);

console.log(hash);