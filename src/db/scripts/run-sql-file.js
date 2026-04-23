const fs = require("fs");
const path = require("path");
const pool = require("../pool");

const file = process.argv[2];
if (!file) {
  console.error("Uso: node src/db/scripts/run-sql-file.js <arquivo.sql>");
  process.exit(1);
}

async function run() {
  const full = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
  const sql = fs.readFileSync(full, "utf8");
  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log("OK:", full);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
