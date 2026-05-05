/**
 * Lê jest-results.json e acrescenta markdown em GITHUB_STEP_SUMMARY.
 * Uso: definir GITHUB_STEP_SUMMARY (Actions) ou redirecionar stdout localmente.
 */
const fs = require("fs");
const path = require("path");

const resultsPath = path.join(process.cwd(), "jest-results.json");
const summaryPath = process.env.GITHUB_STEP_SUMMARY;

function lines(...parts) {
  return parts.join("\n") + "\n";
}

function formatTestName(ar, title) {
  const prefix = (ar && ar.length ? ar.join(" › ") + " › " : "") + title;
  return prefix;
}

function main() {
  let body = "";

  if (!fs.existsSync(resultsPath)) {
    body = lines(
      "## Relatório de testes (Jest)",
      "",
      "Arquivo `jest-results.json` não foi encontrado. O Jest pode ter falhado antes de gerar o relatório.",
      ""
    );
    if (summaryPath) fs.appendFileSync(summaryPath, body);
    else process.stdout.write(body);
    process.exitCode = 1;
    return;
  }

  const raw = fs.readFileSync(resultsPath, "utf8");
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    body = lines("## Relatório de testes (Jest)", "", "JSON inválido em `jest-results.json`.", "");
    if (summaryPath) fs.appendFileSync(summaryPath, body);
    else process.stdout.write(body);
    process.exitCode = 1;
    return;
  }

  const passed = data.numPassedTests ?? 0;
  const failed = data.numFailedTests ?? 0;
  const pending = data.numPendingTests ?? 0;
  const total = passed + failed + pending;

  body += lines(
    "## Relatório de testes (Jest)",
    "",
    "| Métrica | Valor |",
    "|---------|-------|",
    `| Total | ${total} |`,
    `| Passou | ${passed} |`,
    `| Falhou | ${failed} |`,
    `| Pendente / ignorado | ${pending} |`,
    ""
  );

  const failedList = [];
  const passedList = [];
  const otherList = [];

  for (const suite of data.testResults || []) {
    const file = suite.name || "(arquivo desconhecido)";
    for (const a of suite.assertionResults || []) {
      const label = formatTestName(a.ancestorTitles, a.title);
      const entry = { file, label, messages: a.failureMessages || [] };
      if (a.status === "failed") failedList.push(entry);
      else if (a.status === "passed") passedList.push(entry);
      else otherList.push({ file, label: `${label} (${a.status})` });
    }
  }

  if (failedList.length) {
    body += lines("### Falhas", "");
    for (const t of failedList) {
      body += lines(`- **${t.label}**`, `  - Arquivo: \`${t.file}\``);
      for (const m of t.messages) {
        const snippet = String(m).split("\n").slice(0, 12).join("\n");
        body += lines("  ```", snippet, "  ```", "");
      }
    }
  } else {
    body += lines("### Falhas", "", "_Nenhum teste falhou._", "");
  }

  body += lines("### Aprovados", "");
  if (passedList.length === 0) {
    body += lines("_Nenhum teste com status passed._", "");
  } else {
    for (const t of passedList) {
      body += lines(`- ${t.label} — \`${t.file}\``);
    }
    body += "\n";
  }

  if (otherList.length) {
    body += lines("### Pendente / ignorado / outros", "");
    for (const t of otherList) {
      body += lines(`- ${t.label} — \`${t.file}\``);
    }
    body += "\n";
  }

  if (summaryPath) fs.appendFileSync(summaryPath, body);
  else process.stdout.write(body);
}

main();
