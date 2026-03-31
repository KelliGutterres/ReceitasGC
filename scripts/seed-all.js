const fs = require("fs");
const path = require("path");
const pool = require("../db/pool");

async function runFile(relative) {
  const full = path.join(__dirname, "..", relative);
  const sql = fs.readFileSync(full, "utf8");
  await pool.query(sql);
  console.log("OK:", relative);
}

async function main() {
  await runFile("db/seed_receitas.sql");
  await runFile("db/seed_usuario.sql");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
