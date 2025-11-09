#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import subprocess
import time
import sys
import io

# Fix encoding for Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

print("="*60)
print("  Verificando el estado del deployment...")
print("="*60)
print()

# Verificar si GitHub Actions terminó
print("🔍 Verificando GitHub Actions...")
print("   URL: https://github.com/victalejo/monitor-app/actions")
print()

# Intentar conectarse al backend
print("🌐 Verificando backend...")
max_attempts = 10
for i in range(1, max_attempts + 1):
    print(f"   Intento {i}/{max_attempts}...", end=" ")

    try:
        result = subprocess.run(
            ['curl', '-s', '-m', '5', 'https://monitoreo.victalejo.dev/health'],
            capture_output=True,
            text=True,
            timeout=10
        )

        if result.returncode == 0 and result.stdout:
            print("✅ EXITOSO!")
            print()
            print("="*60)
            print("  ✅ DEPLOYMENT COMPLETADO!")
            print("="*60)
            print()
            print("Response:", result.stdout)
            print()
            print("El backend está funcionando correctamente!")
            print()
            print("Próximos pasos:")
            print("1. Probar login:")
            print('   curl -X POST https://monitoreo.victalejo.dev/api/auth/login \\')
            print('     -H "Content-Type: application/json" \\')
            print('     -d \'{"username":"admin","password":"admin123"}\'')
            print()
            print("2. Cambiar contraseña de admin")
            print("3. Crear empresas y servidores")
            print("4. Instalar agentes en tus VPS")
            print()
            sys.exit(0)
        else:
            print("❌ No disponible aún")
            if i < max_attempts:
                print(f"   Esperando 30 segundos...")
                time.sleep(30)
    except Exception as e:
        print(f"❌ Error: {e}")
        if i < max_attempts:
            time.sleep(30)

print()
print("="*60)
print("  ⏳ Deployment aún en progreso")
print("="*60)
print()
print("GitHub Actions probablemente todavía está trabajando.")
print()
print("Opciones:")
print("1. Ve a: https://github.com/victalejo/monitor-app/actions")
print("   y espera a que todos los checks estén en ✅")
print()
print("2. Ejecuta este script de nuevo en unos minutos:")
print("   python check_deployment.py")
print()
print("3. Verifica logs en el servidor:")
print("   ssh root@147.93.184.62 'docker logs monitor-backend'")
print()
