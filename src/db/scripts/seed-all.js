const fs = require("fs");
const path = require("path");
const pool = require("../pool");

async function runFile(filename) {
  const full = path.join(__dirname, "..", filename);
  const sql = fs.readFileSync(full, "utf8");
  await pool.query(sql);
  console.log("OK:", filename);
}

async function main() {
  await runFile("seed_receitas.sql");
  await runFile("seed_usuario.sql");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
