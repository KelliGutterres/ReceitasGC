#!/usr/bin/env bash
# Detecta se docker deve rodar com ou sem sudo (VMs acadêmicas costumam bloquear usermod).

resolve_docker() {
  if [ -n "${DOCKER_SUDO:-}" ]; then
    DOCKER=(sudo docker)
    return 0
  fi

  if docker info >/dev/null 2>&1; then
    DOCKER=(docker)
    return 0
  fi

  if sudo docker info >/dev/null 2>&1; then
    DOCKER=(sudo docker)
    echo "==> Usando 'sudo docker' (usuário não está no grupo docker)."
    return 0
  fi

  echo "Erro: Docker não está instalado ou não está acessível."
  echo "Tente: sudo docker ps"
  exit 1
}

docker_compose() {
  resolve_docker
  "${DOCKER[@]}" compose "$@"
}
