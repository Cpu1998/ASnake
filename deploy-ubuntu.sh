#!/usr/bin/env bash

set -Eeuo pipefail

APP_NAME="${APP_NAME:-asnake}"
DOMAIN="${DOMAIN:-_}"
PORT="${PORT:-80}"
DEPLOY_DIR="${DEPLOY_DIR:-/var/www/${APP_NAME}}"
NGINX_SITE="${NGINX_SITE:-/etc/nginx/sites-available/${APP_NAME}}"
NGINX_ENABLED="${NGINX_ENABLED:-/etc/nginx/sites-enabled/${APP_NAME}}"
NGINX_DEFAULT_ENABLED="${NGINX_DEFAULT_ENABLED:-/etc/nginx/sites-enabled/default}"

log() {
  printf '\033[1;32m[deploy]\033[0m %s\n' "$*"
}

warn() {
  printf '\033[1;33m[warn]\033[0m %s\n' "$*"
}

die() {
  printf '\033[1;31m[error]\033[0m %s\n' "$*" >&2
  exit 1
}

need_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    die "Please run as root, for example: sudo bash deploy-ubuntu.sh"
  fi
}

check_ubuntu() {
  if [[ -r /etc/os-release ]]; then
    # shellcheck disable=SC1091
    source /etc/os-release
    if [[ "${ID:-}" != "ubuntu" ]]; then
      warn "This script is written for Ubuntu. Detected: ${PRETTY_NAME:-unknown Linux}"
    fi
  fi
}

find_project_dir() {
  local script_dir
  script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

  if [[ -f "${script_dir}/index.html" && -f "${script_dir}/game.js" && -f "${script_dir}/styles.css" ]]; then
    printf '%s\n' "${script_dir}"
    return
  fi

  if [[ -f "${PWD}/index.html" && -f "${PWD}/game.js" && -f "${PWD}/styles.css" ]]; then
    printf '%s\n' "${PWD}"
    return
  fi

  die "Cannot find index.html, game.js, and styles.css. Run this script from the project directory."
}

install_packages() {
  local packages=()

  if ! command -v nginx >/dev/null 2>&1; then
    packages+=("nginx")
  fi

  if ! command -v rsync >/dev/null 2>&1; then
    packages+=("rsync")
  fi

  if [[ "${#packages[@]}" -eq 0 ]]; then
    log "Required packages are already installed."
    return
  fi

  log "Installing packages: ${packages[*]}"
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y "${packages[@]}"
}

copy_files() {
  local project_dir="$1"

  log "Deploying static files to ${DEPLOY_DIR}..."
  install -d -m 0755 "${DEPLOY_DIR}"
  install -m 0644 "${project_dir}/index.html" "${DEPLOY_DIR}/index.html"
  install -m 0644 "${project_dir}/game.js" "${DEPLOY_DIR}/game.js"
  install -m 0644 "${project_dir}/styles.css" "${DEPLOY_DIR}/styles.css"

  if [[ -d "${project_dir}/assets" ]]; then
    rsync -a --delete "${project_dir}/assets/" "${DEPLOY_DIR}/assets/"
  fi

  chown -R www-data:www-data "${DEPLOY_DIR}"
}

write_nginx_site() {
  local default_server=""

  if [[ "${PORT}" == "80" ]]; then
    default_server=" default_server"
  fi

  log "Writing Nginx site config: ${NGINX_SITE}"
  cat >"${NGINX_SITE}" <<EOF
server {
    listen ${PORT}${default_server};
    listen [::]:${PORT}${default_server};
    server_name ${DOMAIN};

    root ${DEPLOY_DIR};
    index index.html;

    access_log /var/log/nginx/${APP_NAME}.access.log;
    error_log /var/log/nginx/${APP_NAME}.error.log;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location ~* \.(?:css|js|png|jpg|jpeg|gif|svg|ico|webp|woff2?)\$ {
        expires 7d;
        add_header Cache-Control "public";
        try_files \$uri =404;
    }
}
EOF

  ln -sfn "${NGINX_SITE}" "${NGINX_ENABLED}"
}

disable_default_site() {
  if [[ -L "${NGINX_DEFAULT_ENABLED}" || -e "${NGINX_DEFAULT_ENABLED}" ]]; then
    log "Disabling Ubuntu default Nginx site..."
    rm -f "${NGINX_DEFAULT_ENABLED}"
  fi
}

start_nginx() {
  log "Checking Nginx configuration..."
  nginx -t

  log "Starting Nginx..."
  systemctl enable nginx
  systemctl reload nginx || systemctl restart nginx
}

print_result() {
  local host="${DOMAIN}"
  local port_suffix=""

  if [[ "${host}" == "_" ]]; then
    host="$(hostname -I 2>/dev/null | awk '{print $1}')"
    host="${host:-your-server-ip}"
  fi

  if [[ "${PORT}" != "80" ]]; then
    port_suffix=":${PORT}"
  fi

  log "Done."
  log "Visit: http://${host}${port_suffix}/"
  log "Files: ${DEPLOY_DIR}"
}

main() {
  need_root
  check_ubuntu

  local project_dir
  project_dir="$(find_project_dir)"

  install_packages
  copy_files "${project_dir}"
  write_nginx_site
  disable_default_site
  start_nginx
  print_result
}

main "$@"
