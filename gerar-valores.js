require("dotenv").config();
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

function gerarHashSenha(senha) {
  return bcrypt.hashSync(senha, 10);
}

function criptografarCpf(cpf) {
  const cifra = crypto.createCipheriv(
    "aes-256-cbc",
    process.env.CRIPTO_CHAVE,
    process.env.CRIPTO_IV,
  );
  return cifra.update(cpf, "utf8", "hex") + cifra.final("hex");
}

console.log("Hash da senha 123456:", gerarHashSenha("123456"));
console.log("Hash da senha 234567:", gerarHashSenha("123456"));
console.log("Hash da senha 345678:", gerarHashSenha("123456"));
console.log("CPF 11223344556 criptografado:", criptografarCpf("11223344556"));
console.log("CPF 67788990011 criptografado:", criptografarCpf("67788990011"));
console.log("CPF 22334455667 criptografado:", criptografarCpf("22334455667"));