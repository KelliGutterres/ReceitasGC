const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });

const sgMail = require("@sendgrid/mail");

const apiKey = String(process.env.SENDGRID_API_KEY || "").trim();
const fromEmail = String(
  process.env.SENDGRID_FROM || process.env.MAIL_FROM || ""
).trim();

if (process.env.NODE_ENV !== "test") {
  console.log("[email] Verificando SendGrid…");
  console.log(
    "[email]   SENDGRID_API_KEY:",
    apiKey ? `definida (${apiKey.length} caracteres)` : "ausente"
  );
  console.log("[email]   SENDGRID_FROM (ou MAIL_FROM):", fromEmail || "ausente");
  if (!apiKey || !fromEmail) {
    console.warn(
      "[email]   Defina SENDGRID_API_KEY e SENDGRID_FROM no .env (MAIL_FROM ainda é aceite como alternativa ao remetente)."
    );
  }
}

if (apiKey) {
  sgMail.setApiKey(apiKey);
}

function isSendGridConfigured() {
  return apiKey.length > 0 && fromEmail.length > 0;
}

function formatReceitaBloco(receita) {
  const tipo = receita.tipo_receita === "doce" ? "Doce" : receita.tipo_receita === "salgada" ? "Salgada" : receita.tipo_receita;
  const custo = Number(receita.custo).toFixed(2).replace(".", ",");
  const lines = [
    `ID: ${receita.id}`,
    `Nome: ${receita.nome}`,
    `Tipo: ${tipo}`,
    `Data de registro: ${receita.data_registro}`,
    `Custo: R$ ${custo}`,
  ];
  if (receita.descricao) lines.push(`Descrição: ${String(receita.descricao).trim()}`);
  return lines.join("\n");
}

function buildReceitaNotificacaoHtml({ userNome, intro, blocoTexto }) {
  const fuga = (s) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const preContent = fuga(blocoTexto);
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: system-ui, Arial, sans-serif; line-height: 1.5; color: #0f172a; max-width: 600px; margin: 0 auto; padding: 20px; background: #f1f5f9; }
    .container { background: #fff; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.08); overflow: hidden; }
    .header { background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); color: #fff; padding: 24px 32px; text-align: center; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 700; }
    .content { padding: 28px 32px; }
    .intro { font-size: 16px; margin: 0 0 16px; }
    .receita-pre { font-size: 14px; margin: 0; padding: 16px 20px; background: #f8fafc; border-left: 4px solid #2563eb; border-radius: 8px; white-space: pre-wrap; word-break: break-word; }
    .sign { margin-top: 20px; font-size: 14px; color: #475569; }
    .footer { text-align: center; padding: 12px 32px 20px; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>Receitas GC</h1></div>
    <div class="content">
      <p class="intro">Olá, <strong>${fuga(userNome || "utilizador")}</strong>,</p>
      <p class="intro">${fuga(intro)}</p>
      <pre class="receita-pre">${preContent}</pre>
      <p class="sign">Atenciosamente,<br/>Receitas GC</p>
    </div>
    <div class="footer">E-mail automático. Por favor, não responda a esta mensagem.</div>
  </div>
</body>
</html>`;
}

/**
 * @param {{ to: string, userNome: string, acao: 'criada'|'atualizada', receita: object }} params
 */
async function enviarNotificacaoReceita({ to, userNome, acao, receita }) {
  if (!isSendGridConfigured()) {
    if (process.env.NODE_ENV !== "test") {
      console.log(
        "[email] SendGrid não configurado (SENDGRID_API_KEY + SENDGRID_FROM ou MAIL_FROM). Notificação não enviada."
      );
    }
    return;
  }

  const endereco = String(to || "").trim();
  if (!endereco.includes("@")) {
    console.warn(
      "[email] O login do utilizador deve ser um e-mail válido. Ignorando envio."
    );
    return;
  }

  const assunto =
    acao === "criada"
      ? `[Receitas GC] Receita criada: ${receita.nome}`
      : `[Receitas GC] Receita atualizada: ${receita.nome}`;

  const intro =
    acao === "criada"
      ? "Uma nova receita foi registrada na sua conta."
      : "Uma receita foi atualizada na sua conta.";

  const bloco = formatReceitaBloco(receita);
  const texto = `Olá, ${userNome || "utilizador"}.\n\n${intro}\n\n${bloco}\n\n— Receitas GC`;

  const html = buildReceitaNotificacaoHtml({
    userNome: userNome || "utilizador",
    intro,
    blocoTexto: bloco,
  });

  try {
    if (process.env.NODE_ENV !== "test") {
      console.log(`[email] Enviando notificação SendGrid para: ${endereco}`);
    }
    const [response] = await sgMail.send({
      to: endereco,
      from: fromEmail,
      subject: assunto,
      text: texto,
      html,
    });
    if (process.env.NODE_ENV !== "test") {
      console.log("[email] SendGrid OK, status:", response.statusCode);
    }
  } catch (err) {
    const firstApiMsg = err.response?.body?.errors?.[0]?.message;
    if (firstApiMsg) {
      if (String(firstApiMsg).toLowerCase().includes("maximum credits")) {
        console.error(
          "[email] SendGrid: limite de créditos/envios esgotado (plano grátis ou quota diária). Ver Plano e billing em https://app.sendgrid.com/ — a app continua a funcionar; só o e-mail não foi enviado."
        );
      } else {
        console.error("[email] SendGrid:", firstApiMsg);
      }
    } else {
      console.error("[email] SendGrid:", err.message);
    }
    if (err.response) {
      console.error("[email]   HTTP status:", err.response.statusCode);
      if (err.response.body && !firstApiMsg) {
        console.error("[email]   resposta:", err.response.body);
      }
    }
  }
}

function notificarReceitaEmBackground(params) {
  setImmediate(() => {
    enviarNotificacaoReceita(params).catch((err) =>
      console.error("[email] Erro inesperado na notificação:", err)
    );
  });
}

/** @deprecated Usar isSendGridConfigured. Mantido para compatibilidade. */
function isMailConfigured() {
  return isSendGridConfigured();
}

module.exports = {
  enviarNotificacaoReceita,
  notificarReceitaEmBackground,
  isSendGridConfigured,
  isMailConfigured,
};
