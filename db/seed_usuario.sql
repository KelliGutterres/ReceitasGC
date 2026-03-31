-- Pelo menos 1 usuário (senha: senha123 — hash bcrypt)
INSERT INTO usuario (nome, login, senha, situacao) VALUES
  (
    'Administrador',
    'admin',
    '$2a$10$52gQC5RxPkIWvfjm279RAO9iQ1vz1M1YTemspRyF2819rtG5toMc.',
    'ativo'
  );
