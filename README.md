# Claude Code Smartway — Guía de configuración y uso

> Versión para administradores y desarrolladores.
Es un fork de claude code que usa la misma base pero permite configurar un token único para la empresa y también tiene un sistema de reportes a supabase para medir el uso de claude code y validar que sea utilizado solo en proyectos de la empresa.

---

## Índice

1. [Arquitectura general](#1-arquitectura-general)
2. [Setup del administrador](#2-setup-del-administrador-una-sola-vez)
3. [Compilar los ejecutables](#3-compilar-los-ejecutables)
4. [Distribuir a los desarrolladores](#4-distribuir-a-los-desarrolladores)
5. [Uso por parte del desarrollador](#5-uso-por-parte-del-desarrollador)
6. [Dashboard de estadísticas en Supabase](#6-dashboard-de-estadísticas-en-supabase)
7. [Actualizar la API key o config](#7-actualizar-la-api-key-o-config)
8. [Solución de problemas](#8-solución-de-problemas)
9. [Configurar Supabase desde cero](#9-configurar-supabase-desde-cero-paso-a-paso)
10. [Instalación para desarrolladores](#10-instalación-para-desarrolladores)

---

## 1. Arquitectura general

```
┌─────────────────────────────────────────────────────────────┐
│  Desarrollador ejecuta smartway-claude  (binario compilado)  │
│                                                             │
│  1. Primera vez: pide Nombre + Apellido                     │
│     → guarda en ~/.smartway/profile.json (solo esa máquina) │
│                                                             │
│  2. Muestra banner Smartway × Claude Code                   │
│                                                             │
│  3. Detecta el proyecto actual                              │
│     (package.json / pyproject.toml / Cargo.toml / carpeta) │
│                                                             │
│  4. Envía reporte "start" a Supabase                        │
│                                                             │
│  5. Lanza claude con la API key de la empresa               │
│                       ↕  stdin/stdout heredados             │
│  6. Cada 10 minutos → heartbeat a Supabase                  │
│                                                             │
│  7. Al cerrar → reporte "stop" a Supabase                   │
└─────────────────────────────────────────────────────────────┘
```

**Lo que el desarrollador NO puede ver ni modificar:**
- La API key de Anthropic (embebida en el binario)
- Las credenciales de Supabase (embebidas en el binario)
- La lógica de reporting

---

## 2. Setup del administrador (una sola vez)

### 2.1 Requisitos

| Herramienta | Versión mínima | Para qué |
|-------------|----------------|---------- |
| Node.js     | 18+            | Build del launcher |
| npm         | 9+             | Instalar dependencias |
| Claude Code | última         | CLI base que se distribuye |

### 2.2 Clonar el repositorio

```bash
git clone <url-del-repo-interno>
cd claude-code
```

### 2.3 Crear el proyecto en Supabase

1. Ir a [supabase.com](https://supabase.com) → **New project**
2. Anotar:
   - **Project URL** → `https://XXXX.supabase.co`
   - **service_role key** → Settings → API → *service_role* (NO la anon key)

3. En el **SQL Editor** de Supabase, ejecutar el contenido de:
   ```
   scripts/supabase-setup.sql
   ```
   Esto crea la tabla `usage_reports` y la vista `v_dev_activity`.

### 2.4 Configurar `smartway.config.json`

Editar el archivo en la raíz del repo:

```json
{
  "anthropicApiKey": "sk-ant-api03-XXXXXXXXXXXXXXXX",
  "company": "Smartway",
  "supabase": {
    "url": "https://XXXXXXXXXXXX.supabase.co",
    "serviceRoleKey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

> ⚠️ Este archivo se commitea al repo interno porque contiene las credenciales
> que serán **embebidas y ocultadas** en el binario compilado.
> Nunca subir este repo a GitHub público.

---

## 3. Compilar los ejecutables

```bash
# Desde la raíz del repo
cd launcher
npm install
node build.js
```

**Resultado en `dist/`:**

```
dist/
  claude-smartway-windows.exe    ← Windows x64
  claude-smartway-linux          ← Linux x64
  claude-smartway-macos          ← macOS Intel (x64)
  claude-smartway-macos-arm64    ← macOS Apple Silicon (M1/M2/M3)
```

> Los binarios incluyen Node.js embebido. El desarrollador **no necesita
> tener Node.js instalado** para ejecutarlos.

---

## 4. Distribuir a los desarrolladores

### Qué distribuir

Solo hay que entregar **dos cosas** al desarrollador:

1. El binario correspondiente a su sistema operativo
2. Instrucciones de instalación (ver sección 5)

**NO es necesario** que el desarrollador tenga acceso al código fuente,
al `smartway.config.json`, ni al repositorio.

### Opciones de distribución

**Opción A — Carpeta compartida / Google Drive / OneDrive**
Subir los 4 binarios a una carpeta compartida interna y compartir el link.

**Opción B — Release en GitHub interno**
```bash
gh release create v1.0.0 dist/* --title "Claude Code Smartway v1.0.0"
```

**Opción C — Servidor interno**
Copiar los binarios a un servidor interno con acceso HTTP para descarga.

---

## 5. Uso por parte del desarrollador

### 5.1 Requisito previo: instalar Claude Code CLI

El binario de Smartway es un *wrapper* sobre el CLI oficial de Claude Code.
Cada desarrollador debe tenerlo instalado:

```bash
npm install -g @anthropic-ai/claude-code
```

> Si no tienen npm, instalar Node.js desde [nodejs.org](https://nodejs.org)
> o usar los instaladores de Claude Code en [claude.ai/code](https://claude.ai/code).

### 5.2 Instalar el binario de Smartway

#### Windows

1. Descargar `claude-smartway-windows.exe`
2. Moverlo a una carpeta en el PATH, por ejemplo `C:\tools\`
3. Agregar `C:\tools\` al PATH del sistema (una sola vez):
   - Win + R → `sysdm.cpl` → Variables de entorno → Path → Nuevo → `C:\tools`
4. Abrir una nueva terminal y verificar:
   ```cmd
   claude-smartway-windows --version
   ```

#### macOS

```bash
# Descargar el binario correspondiente:
# Intel:         claude-smartway-macos
# Apple Silicon: claude-smartway-macos-arm64

# Mover al PATH
sudo mv claude-smartway-macos /usr/local/bin/claude-smartway
sudo chmod +x /usr/local/bin/claude-smartway

# En macOS, dar permisos la primera vez:
# Sistema → Privacidad y seguridad → "Abrir de todas formas"
# O por terminal:
xattr -d com.apple.quarantine /usr/local/bin/claude-smartway
```

#### Linux

```bash
sudo mv claude-smartway-linux /usr/local/bin/claude-smartway
sudo chmod +x /usr/local/bin/claude-smartway
```

### 5.3 Primera ejecución

Navegar al directorio del proyecto y ejecutar:

```bash
# Desde cualquier proyecto de la empresa
cd ~/proyectos/mi-proyecto
claude-smartway        # o claude-smartway-windows en Windows
```

**Paso 1 — Pedirá nombre y apellido:**

```
  ╭──────────────────────────────────────────────────╮
  │   Bienvenido a Claude Code Smartway               │
  │   Ingresá tu información.                         │
  ╰──────────────────────────────────────────────────╯

  Nombre:   Juan
  Apellido: Pérez

  ✓ Tu nombre fue guardado para futuras sesiones.
```

**Paso 2 — Login único (solo la primera vez por máquina):**

Claude Code mostrará el wizard de login. Esto es obligatorio la primera vez
porque Claude Code necesita vincular una sesión al perfil de Anthropic.
**A partir de la segunda ejecución no vuelve a aparecer.**

```
 Select login method:

 ❯ 1. Claude account with subscription
   2. Anthropic Console account · API usage billing   ← ELEGIR ESTA
   3. 3rd-party platform
```

1. Seleccionar la opción **2 — Anthropic Console account**
2. Se abrirá el navegador en `platform.claude.com` → loguearse con cualquier
   cuenta de Anthropic (puede ser la cuenta personal del developer)
3. Una vez completado el login web, volver a la terminal
4. Claude Code detecta el `ANTHROPIC_API_KEY` de Smartway en el entorno
   y lo usa automáticamente en lugar de las credenciales OAuth

> Las credenciales del login web quedan guardadas en **`~/.claude-smartway`**,
> separadas de la cuenta personal en `~/.claude`.
> El `ANTHROPIC_API_KEY` de la empresa siempre tiene prioridad sobre ellas.

**Desde la segunda vez — inicio directo sin login:**

```
  ╭──────────────────────────────────────────────────╮
  │                                                  │
  │   ◆ Claude Code   ×   Smartway                  │
  │                        by Luis Albanese          │
  │                                                  │
  │   AI-powered development assistant               │
  │                                                  │
  ╰──────────────────────────────────────────────────╯

  ✓ Sesión iniciada — Juan Pérez en mi-proyecto
```

### 5.4 Uso diario

```bash
# Iniciar sesión interactiva
claude-smartway

# Con flags de claude
claude-smartway --model claude-opus-4-5
claude-smartway "explicame este archivo"

# En Windows
claude-smartway-windows
```

---

## 6. Dashboard de estadísticas en Supabase

### Ver actividad de todos los desarrolladores

En el **Table Editor** de Supabase → tabla `usage_reports`

O en el **SQL Editor**:

```sql
-- Actividad por desarrollador y proyecto
SELECT * FROM v_dev_activity;

-- Sesiones de hoy
SELECT developer_name, project_name, report_type, created_at
FROM usage_reports
WHERE created_at >= CURRENT_DATE
ORDER BY created_at DESC;

-- Horas aproximadas trabajadas por developer (basado en heartbeats)
-- Cada heartbeat = 10 minutos de actividad
SELECT
  developer_name,
  COUNT(*) FILTER (WHERE report_type = 'heartbeat') * 10 AS minutos_activos,
  COUNT(DISTINCT DATE(created_at)) AS dias_con_actividad
FROM usage_reports
GROUP BY developer_name
ORDER BY minutos_activos DESC;

-- Proyectos activos en los últimos 7 días
SELECT DISTINCT project_name, developer_name
FROM usage_reports
WHERE created_at >= NOW() - INTERVAL '7 days'
ORDER BY project_name;
```

---

## 7. Actualizar la API key o config

Si cambia la API key de Anthropic o las credenciales de Supabase:

1. Actualizar `smartway.config.json`
2. Recompilar:
   ```bash
   cd launcher && node build.js
   ```
3. Redistribuir los nuevos binarios a los desarrolladores

Los desarrolladores solo reemplazan el ejecutable — no pierden su nombre guardado
(está en `~/.smartway/profile.json`).

---

## 8. Solución de problemas

### "no se pudo iniciar Claude Code"

Claude Code CLI no está instalado o no está en el PATH.

```bash
npm install -g @anthropic-ai/claude-code
# Verificar:
claude --version
```

### Los reportes no llegan a Supabase

1. Verificar que `supabase.url` y `supabase.serviceRoleKey` están correctos en `smartway.config.json`
2. Recompilar y redistribuir el binario
3. Verificar en Supabase → Authentication → el proyecto tiene RLS configurado con el script SQL

### El desarrollador quiere cambiar su nombre

```bash
# Editar o eliminar el perfil local
# macOS/Linux:
rm ~/.smartway/profile.json

# Windows:
del %USERPROFILE%\.smartway\profile.json
```

La próxima sesión pedirá el nombre nuevamente.

### macOS: "no se puede abrir porque es de un desarrollador no identificado"

```bash
xattr -d com.apple.quarantine /usr/local/bin/claude-smartway
```

O ir a **Sistema → Privacidad y seguridad → Abrir de todas formas**.

---

## 9. Configurar Supabase desde cero (paso a paso)

### 9.1 Crear la cuenta y el proyecto

1. Ir a [supabase.com](https://supabase.com) y hacer click en **Start your project**
2. Registrarse con GitHub, Google o email
3. Una vez dentro del dashboard, click en **New project**

   | Campo | Valor |
   |-------|-------|
   | Organization | Tu organización (o crear una nueva) |
   | Name | `smartway-claude` (o el nombre que prefieras) |
   | Database Password | Generar una contraseña segura y guardarla |
   | Region | Elegir la más cercana (ej: `South America (São Paulo)`) |

4. Click en **Create new project** — tarda ~1 minuto en aprovisionar

---

### 9.2 Obtener la Project URL y la Service Role Key

1. En el sidebar izquierdo ir a **Project Settings** (ícono de engranaje abajo)
2. Click en **API** en el submenú

   Vas a ver dos datos que necesitás copiar:

   **Project URL**
   ```
   https://XXXXXXXXXXXXXXXXXXXX.supabase.co
   ```
   → Este valor va en `smartway.config.json` → `supabase.url`

   **Project API Keys → service_role**
   ```
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.XXXXXX...
   ```
   → Este valor va en `smartway.config.json` → `supabase.serviceRoleKey`

   > ⚠️ Usá siempre la **service_role**, nunca la `anon` key.
   > La service_role tiene permisos de escritura y bypass de RLS,
   > necesarios para que los reportes lleguen correctamente.

---

### 9.3 Crear la tabla con el SQL Editor

1. En el sidebar ir a **SQL Editor** (ícono de terminal)
2. Click en **New query**
3. Copiar y pegar el contenido completo del archivo `scripts/supabase-setup.sql`
4. Click en **Run** (o `Ctrl+Enter`)

   Deberías ver en el panel inferior:
   ```
   Success. No rows returned
   ```

5. Para verificar que la tabla se creó correctamente, ir a **Table Editor** en el sidebar
   → Debería aparecer la tabla `usage_reports`

---

### 9.4 Verificar que los reportes llegan

Una vez compilado y ejecutado el binario por primera vez, verificar en Supabase:

1. Ir a **Table Editor** → `usage_reports`
2. Deberías ver una fila con `report_type = start` al iniciar sesión

Si no aparece nada después de 1-2 minutos, revisar la sección **8. Solución de problemas**.

---

### 9.5 Ver estadísticas con la vista incluida

1. En el sidebar ir a **Table Editor**
2. En el panel izquierdo, bajo **Views**, click en `v_dev_activity`
3. Vas a ver un resumen de sesiones y actividad por desarrollador y proyecto

Para consultas más específicas, usar el **SQL Editor** con las queries de la sección 6.

---

## 10. Instalación para desarrolladores

Esta sección es la guía que se le entrega al desarrollador junto con el binario.
El administrador compila el ejecutable y distribuye según la sección 4.

### Requisito previo: instalar Claude Code CLI

El binario de Smartway es un wrapper sobre el CLI oficial. Cada developer debe tenerlo instalado:

```bash
npm install -g @anthropic-ai/claude-code
```

> Si no tienen npm, instalar Node.js desde [nodejs.org](https://nodejs.org).

---

### Windows

**Qué recibís:** el archivo `claude-smartway-windows.exe` y el script `install-windows.ps1`

1. Colocar ambos archivos en la misma carpeta (por ejemplo `C:\Users\tu-usuario\Descargas\smartway\`)
2. Abrir PowerShell en esa carpeta y ejecutar:

   ```powershell
   powershell -ExecutionPolicy Bypass -File install-windows.ps1
   ```

   El instalador hace automáticamente:
   - Crea `C:\tools\` si no existe
   - Copia el exe como `C:\tools\claude-smartway.exe`
   - Agrega `C:\tools` al PATH del usuario en el registro de Windows
   - Agrega `C:\tools` al perfil de PowerShell para que persista en cada sesión

3. Cerrar la terminal y abrir una nueva
4. Verificar desde cualquier carpeta:

   ```powershell
   claude-smartway --version
   ```

> **Nota:** el instalador solo es necesario una vez por máquina.
> Si recibís una versión actualizada del exe, solo reemplazarlo en `C:\tools\`.

---

### macOS

**Qué recibís:** `claude-smartway-macos` (Intel) o `claude-smartway-macos-arm64` (Apple Silicon M1/M2/M3)

Para saber cuál usar:
```bash
uname -m
# x86_64 → Intel → usar claude-smartway-macos
# arm64  → Apple Silicon → usar claude-smartway-macos-arm64
```

Instalación:
```bash
# Mover al PATH (reemplazar el nombre del archivo según corresponda)
sudo mv ~/Downloads/claude-smartway-macos /usr/local/bin/claude-smartway
sudo chmod +x /usr/local/bin/claude-smartway

# Quitar la restricción de Gatekeeper (macOS bloquea binarios de internet)
xattr -d com.apple.quarantine /usr/local/bin/claude-smartway
```

> Si macOS muestra "no se puede abrir porque es de un desarrollador no identificado":
> ir a **Sistema → Privacidad y seguridad → Abrir de todas formas**

Verificar:
```bash
claude-smartway --version
```

---

### Linux

**Qué recibís:** `claude-smartway-linux`

```bash
# Mover al PATH y dar permisos de ejecución
sudo mv ~/Downloads/claude-smartway-linux /usr/local/bin/claude-smartway
sudo chmod +x /usr/local/bin/claude-smartway
```

Verificar:
```bash
claude-smartway --version
```

---

### Primera ejecución (todos los sistemas)

1. Abrir una terminal
2. Navegar al proyecto:
   ```bash
   cd ~/proyectos/mi-proyecto
   ```
3. Ejecutar:
   ```bash
   claude-smartway
   ```
4. La primera vez pedirá nombre y apellido — se guarda localmente y no vuelve a preguntar
5. Si es la primera vez que se usa Claude Code en la máquina, pedirá login en el navegador (solo ocurre una vez)

---

### Uso diario

```bash
# Iniciar sesión interactiva
claude-smartway

# Con flags de claude
claude-smartway --model claude-opus-4-5
claude-smartway "explicame este archivo"
```

---

### Cambiar el nombre registrado

```bash
# macOS / Linux
rm ~/.smartway/profile.json

# Windows
del %USERPROFILE%\.smartway\profile.json
```

La próxima sesión pedirá el nombre nuevamente.