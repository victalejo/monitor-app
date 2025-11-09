#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script automático para configurar el servidor y hacer el primer deployment
"""

import subprocess
import time
import sys
import os
import io

# Fix encoding for Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# Configuración
SERVER_IP = "147.93.184.62"
SERVER_USER = "root"
SERVER_PASSWORD = "Alejo2026"
DOMAIN = "monitoreo.victalejo.dev"

def print_banner(text):
    """Imprime un banner bonito"""
    print("\n" + "="*60)
    print(f"  {text}")
    print("="*60 + "\n")

def run_command(command, description, check=True):
    """Ejecuta un comando y muestra el resultado"""
    print(f"🔄 {description}...")
    try:
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=300
        )

        if result.returncode == 0 or not check:
            print(f"✅ {description} - COMPLETADO")
            if result.stdout:
                print(result.stdout)
            return True
        else:
            print(f"❌ {description} - FALLÓ")
            if result.stderr:
                print(f"Error: {result.stderr}")
            return False
    except subprocess.TimeoutExpired:
        print(f"⏱️ {description} - TIMEOUT")
        return False
    except Exception as e:
        print(f"❌ {description} - ERROR: {str(e)}")
        return False

def ssh_command(command, description, check=True):
    """Ejecuta un comando en el servidor remoto"""
    ssh_cmd = f'ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null {SERVER_USER}@{SERVER_IP} "{command}"'
    return run_command(ssh_cmd, description, check)

def main():
    print_banner("🚀 Monitor App - Automated Server Setup")

    print("Configuración:")
    print(f"  Servidor: {SERVER_IP}")
    print(f"  Usuario: {SERVER_USER}")
    print(f"  Dominio: {DOMAIN}")
    print()

    # Paso 1: Verificar conexión
    print_banner("Paso 1: Verificar Conexión al Servidor")
    if not ssh_command("echo 'Conexión exitosa'", "Conectando al servidor"):
        print("\n❌ No se pudo conectar al servidor. Verifica:")
        print("  1. Que el servidor esté accesible")
        print("  2. Que la contraseña sea correcta")
        print("  3. Que SSH esté habilitado")
        sys.exit(1)

    # Paso 2: Agregar clave SSH
    print_banner("Paso 2: Agregar Clave SSH para GitHub Actions")
    ssh_key = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAINz1ccuEJIXBDaso5ov+7aTJDuOyERvf+oHYXeJblLzA github-actions-deploy"
    ssh_command(
        f"mkdir -p ~/.ssh && echo '{ssh_key}' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && chmod 700 ~/.ssh",
        "Agregando clave SSH"
    )

    # Paso 3: Actualizar sistema
    print_banner("Paso 3: Actualizar Sistema")
    ssh_command("apt-get update -qq", "Actualizando lista de paquetes", check=False)

    # Paso 4: Instalar Docker
    print_banner("Paso 4: Instalar Docker")
    docker_check = ssh_command("command -v docker", "Verificando Docker", check=False)

    if not docker_check:
        print("Docker no encontrado, instalando...")
        ssh_command(
            "curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh && rm get-docker.sh",
            "Instalando Docker"
        )
        ssh_command("systemctl enable docker && systemctl start docker", "Iniciando Docker")
    else:
        print("✅ Docker ya está instalado")

    # Paso 5: Instalar Docker Compose
    print_banner("Paso 5: Instalar Docker Compose")
    compose_check = ssh_command("command -v docker-compose", "Verificando Docker Compose", check=False)

    if not compose_check:
        print("Docker Compose no encontrado, instalando...")
        ssh_command(
            'curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose && chmod +x /usr/local/bin/docker-compose',
            "Instalando Docker Compose"
        )
    else:
        print("✅ Docker Compose ya está instalado")

    # Paso 6: Instalar Nginx
    print_banner("Paso 6: Instalar Nginx")
    nginx_check = ssh_command("command -v nginx", "Verificando Nginx", check=False)

    if not nginx_check:
        print("Nginx no encontrado, instalando...")
        ssh_command("apt-get install -y nginx", "Instalando Nginx")
        ssh_command("systemctl enable nginx && systemctl start nginx", "Iniciando Nginx")
    else:
        print("✅ Nginx ya está instalado")

    # Paso 7: Instalar Certbot
    print_banner("Paso 7: Instalar Certbot")
    certbot_check = ssh_command("command -v certbot", "Verificando Certbot", check=False)

    if not certbot_check:
        print("Certbot no encontrado, instalando...")
        ssh_command("apt-get install -y certbot python3-certbot-nginx", "Instalando Certbot")
    else:
        print("✅ Certbot ya está instalado")

    # Paso 8: Crear directorios
    print_banner("Paso 8: Crear Estructura de Directorios")
    ssh_command(
        "mkdir -p /opt/monitor-app/backend /opt/monitor-app/backups /var/www/certbot",
        "Creando directorios"
    )

    # Paso 9: Crear red Docker
    print_banner("Paso 9: Crear Red Docker")
    ssh_command("docker network create nginx-proxy 2>/dev/null || true", "Creando red nginx-proxy", check=False)

    # Paso 10: Configurar SSL
    print_banner("Paso 10: Configurar Certificado SSL")
    print(f"Obteniendo certificado SSL para {DOMAIN}...")
    ssl_result = ssh_command(
        f"certbot certonly --nginx -d {DOMAIN} --non-interactive --agree-tos --email admin@victalejo.dev",
        "Configurando SSL",
        check=False
    )

    if ssl_result:
        ssh_command("systemctl enable certbot.timer && systemctl start certbot.timer", "Habilitando renovación automática de SSL")
    else:
        print("⚠️ SSL no configurado aún (se configurará automáticamente después del primer deployment)")

    # Paso 11: Configurar Nginx
    print_banner("Paso 11: Configurar Nginx")

    nginx_config = """upstream monitor_backend {
    server monitor-backend:3000;
    keepalive 64;
}

server {
    listen 80;
    server_name monitoreo.victalejo.dev;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://\\$server_name\\$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name monitoreo.victalejo.dev;

    ssl_certificate /etc/letsencrypt/live/monitoreo.victalejo.dev/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/monitoreo.victalejo.dev/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    add_header X-Frame-Options \\"SAMEORIGIN\\" always;
    add_header X-Content-Type-Options \\"nosniff\\" always;
    add_header X-XSS-Protection \\"1; mode=block\\" always;
    add_header Strict-Transport-Security \\"max-age=31536000\\" always;

    access_log /var/log/nginx/monitor_access.log;
    error_log /var/log/nginx/monitor_error.log;

    client_max_body_size 10M;

    location / {
        proxy_pass http://monitor_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \\$host;
        proxy_set_header X-Real-IP \\$remote_addr;
        proxy_set_header X-Forwarded-For \\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\$scheme;
        proxy_cache_bypass \\$http_upgrade;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    location /health {
        proxy_pass http://monitor_backend/health;
        proxy_http_version 1.1;
        proxy_set_header Host \\$host;
        proxy_set_header X-Real-IP \\$remote_addr;
        access_log off;
    }
}"""

    # Escribir configuración de Nginx
    ssh_command(
        f"cat > /etc/nginx/sites-available/monitor << 'EOF'\n{nginx_config}\nEOF",
        "Escribiendo configuración de Nginx"
    )

    # Activar sitio
    ssh_command(
        "ln -sf /etc/nginx/sites-available/monitor /etc/nginx/sites-enabled/monitor",
        "Activando sitio Nginx"
    )

    # Verificar configuración
    nginx_test = ssh_command("nginx -t", "Verificando configuración de Nginx", check=False)

    if nginx_test:
        ssh_command("systemctl reload nginx", "Recargando Nginx")
    else:
        print("⚠️ Configuración de Nginx tiene advertencias (funcionará después del deployment)")

    # Paso 12: Mostrar resumen
    print_banner("✅ Configuración del Servidor Completada")

    print("Versiones instaladas:")
    ssh_command("docker --version", "Docker", check=False)
    ssh_command("docker-compose --version", "Docker Compose", check=False)
    ssh_command("certbot --version | head -1", "Certbot", check=False)
    ssh_command("nginx -v", "Nginx", check=False)

    print("\n" + "="*60)
    print("  🎉 ¡Servidor Configurado Exitosamente!")
    print("="*60)
    print("\nPróximos pasos:")
    print("  1. El script ahora activará el primer deployment")
    print("  2. Puedes monitorear en: https://github.com/victalejo/monitor-app/actions")
    print("  3. Una vez deployado, prueba: curl https://monitoreo.victalejo.dev/health")
    print()

    # Paso 13: Trigger deployment
    input("\n⏸️  Presiona ENTER para activar el primer deployment...")

    print_banner("Paso 12: Activar Primer Deployment")

    # Hacer un cambio para trigger el deployment
    os.chdir("v:\\monitor-app")

    run_command(
        'echo "# Server configured and ready for deployment" >> README.md',
        "Modificando README para trigger deployment"
    )

    run_command("git add README.md", "Agregando cambios")
    run_command('git commit -m "Trigger first deployment - server configured"', "Creando commit")
    run_command("git push origin main", "Pushing a GitHub (esto activará el deployment)")

    print("\n✅ Deployment activado!")
    print(f"\n🔗 Ve el progreso en: https://github.com/victalejo/monitor-app/actions")
    print("\n⏳ El deployment tomará aproximadamente 3-5 minutos...")

    # Esperar un poco
    print("\nEsperando 30 segundos antes de verificar...")
    for i in range(30, 0, -1):
        print(f"\r⏱️  {i} segundos...", end="", flush=True)
        time.sleep(1)
    print("\r✅ Listo!           ")

    print("\n" + "="*60)
    print("  Deployment en progreso...")
    print("="*60)
    print("\nPara verificar el deployment:")
    print("  1. Ve a: https://github.com/victalejo/monitor-app/actions")
    print("  2. Espera a que todos los checks estén en ✅")
    print("  3. Luego prueba: curl https://monitoreo.victalejo.dev/health")
    print()
    print("💡 Tip: Puedes verificar los logs del servidor con:")
    print(f"  ssh root@{SERVER_IP} 'docker logs monitor-backend -f'")
    print()

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  Setup interrumpido por el usuario")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ Error inesperado: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
