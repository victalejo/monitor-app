# 🚀 EJECUTA ESTE ÚNICO COMANDO

## Todo Está Listo - Solo Falta Esto:

Copia y pega este comando (te pedirá la contraseña `Alejo2026` una vez):

```bash
ssh root@147.93.184.62 "curl -sSL https://raw.githubusercontent.com/victalejo/monitor-app/main/complete-setup.sh | bash"
```

**Eso es todo.** El script hará TODO automáticamente:
- ✅ SSH key
- ✅ Docker
- ✅ Docker Compose
- ✅ Certbot + SSL
- ✅ Nginx
- ✅ Directorios
- ✅ Redes Docker

Toma 2-3 minutos.

---

## Después del setup, activa el deployment:

```bash
cd v:\monitor-app && echo "# Deployed" >> README.md && git add . && git commit -m "Deploy" && git push
```

---

## Verifica:

1. **GitHub Actions**: https://github.com/victalejo/monitor-app/actions (espera 3-5 min)
2. **Health check**: `curl https://monitoreo.victalejo.dev/health`
3. **Login**:
```bash
curl -X POST https://monitoreo.victalejo.dev/api/auth/login -H "Content-Type: application/json" -d '{"username":"admin","password":"admin123"}'
```

**¡LISTO! 🎉**
