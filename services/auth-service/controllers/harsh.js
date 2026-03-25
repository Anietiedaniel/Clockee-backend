import bcrypt from "bcrypt";
const password = "NewPassword123";

const run = async () => {
  const saltRounds = 12;

  const hash = await bcrypt.hash(password, saltRounds);

  console.log("Plain:", password);
  console.log("Hash:", hash);
};

run();