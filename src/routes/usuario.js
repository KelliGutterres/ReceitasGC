const express = require("express");
const bcrypt = require("bcryptjs");
const pool = require("../db/pool");

const router = express.Router();

router.get("/login", (req, res) => {
  if (req.session.userId) return res.redirect("/receitas");
  res.render("login", { error: null, login: "" });
});

router.post("/login", async (req, res) => {
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

router.post("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

router.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

router.get("/", (req, res) => {
  if (req.session.userId) return res.redirect("/receitas");
  res.redirect("/login");
});

module.exports = router;
