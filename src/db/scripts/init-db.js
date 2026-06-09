const { spawnSync } = require("child_process");
const path = require("path");

const migrateScript = path.join(__dirname, "migrate.js");
const result = spawnSync(process.execPath, [migrateScript], {
  stdio: "inherit",
});

process.exit(result.status ?? 1);
