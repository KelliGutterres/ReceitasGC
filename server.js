const path = require("path");
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const pool = require("./db/pool");

const app = express();
const PORT = process.env.PORT || 3000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "receitas-gc-dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 },
  })
);

function requireAuth(req, res, next) {
  if (req.session.userId) return next();
  return res.redirect("/login");
}

app.get("/login", (req, res) => {
  if (req.session.userId) return res.redirect("/receitas");
  res.render("login", { error: null, login: "" });
});

app.post("/login", async (req, res) => {
  const login = String(req.body.login || "").trim();
  const senha = String(req.body.senha || "");

  if (!login || !senha) {
    return res.status(400).render("login", {
      error: "Informe login e senha.",
      login,
    });
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, nome, login, senha, situacao FROM usuario WHERE login = $1`,
      [login]
    );
    const user = rows[0];
    if (!user || user.situacao !== "ativo") {
      return res.status(401).render("login", {
        error: "Credenciais inválidas ou usuário inativo.",
        login,
      });
    }
    const ok = await bcrypt.compare(senha, user.senha);
    if (!ok) {
      return res.status(401).render("login", {
        error: "Credenciais inválidas ou usuário inativo.",
        login,
      });
    }
    req.session.userId = user.id;
    req.session.userNome = user.nome;
    return res.redirect("/receitas");
  } catch (err) {
    console.error(err);
    return res.status(500).render("login", {
      error: "Erro ao acessar o banco. Verifique o PostgreSQL.",
      login,
    });
  }
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

app.get("/receitas", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, nome, descricao, data_registro, custo, tipo_receita
       FROM receita
       ORDER BY data_registro DESC, id DESC`
    );
    res.render("receitas", {
      receitas: rows,
      userNome: req.session.userNome,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Erro ao listar receitas.");
  }
});

app.get("/", (req, res) => {
  if (req.session.userId) return res.redirect("/receitas");
  res.redirect("/login");
});

const HOST = process.env.HOST || "0.0.0.0";
app.listen(PORT, HOST, () => {
  console.log(`Servidor em http://${HOST}:${PORT}`);
});
