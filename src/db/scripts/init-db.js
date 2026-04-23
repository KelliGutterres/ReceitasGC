const fs = require("fs");
const path = require("path");
const pool = require("../pool");

async function run() {
  const schemaPath = path.join(__dirname, "..", "schema.sql");
  const sql = fs.readFileSync(schemaPath, "utf8");
  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log("Schema aplicado com sucesso.");
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
