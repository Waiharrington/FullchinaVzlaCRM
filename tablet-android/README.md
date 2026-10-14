# Full China para tablet Android

Esta APK abre la misma web administrativa de Full China y añade impresión directa
por red para la XP-80C. La PWA del navegador continúa disponible. El ticket se
envía como imagen ESC/POS de 576 puntos (72 mm imprimibles), con alto según su
contenido, mínimo 8 cm, y corte al final. No utiliza el tamaño de hoja del
diálogo de impresión de Android.

## Instalación y primera impresión

1. Instala `app/build/outputs/apk/release/app-release.apk` en la tablet Android 8
   o superior. La tablet y la impresora deben estar en el mismo Wi-Fi.
2. Abre la APK e inicia sesión con tu usuario habitual de Full China. La
   configuración de impresora está dentro de **Configuración → Impresión de tickets**.
3. Pulsa **Buscar impresoras en la red**. La búsqueda encuentra dispositivos
   que aceptan conexiones TCP en el puerto indicado; confirma el resultado con
   **Probar**. Si no aparece, escribe la IP de la impresora y su puerto RAW
   (habitualmente 9100), pulsa **Probar** y luego **Guardar**.
4. Imprime una precuenta o un recibo desde Caja/Comandas. En la APK se envía
   directamente a la impresora; en el navegador continúa el diálogo habitual.

La IP se guarda solo en la tablet. Para evitar que cambie, conviene reservarla
en el router. La búsqueda automática examina la subred IPv4 local `/24`; si el
Wi-Fi usa otra configuración, la entrada manual sigue disponible.

## Compilar

Requiere JDK 17 o superior y Android SDK API 36. En esta carpeta:

```powershell
$env:ANDROID_HOME = 'C:\ruta\al\Android\Sdk'
.\gradlew.bat assembleDebug
```

La APK de entrega se genera con `assembleRelease` y una clave de firma privada.
En este equipo, la clave se guarda fuera del repositorio en
`%LOCALAPPDATA%\FullChinaVzla\android-signing\fullchina-tablet-release.jks`;
su contraseña está cifrada para el usuario actual de Windows en el mismo
directorio. Conserva un respaldo seguro de ambos archivos: las actualizaciones
de la APK necesitan la misma clave. Gradle recibe la ruta y contraseña mediante
`FULLCHINA_KEYSTORE_PATH` y `FULLCHINA_KEYSTORE_PASSWORD`; no están en Git.

La versión web servida en la APK debe incluir el puente
`window.FullChinaPrinter` de `src/lib/thermalReceipt.ts`. Al cargar la web desde
producción, los cambios de interfaz se actualizan sin reinstalar la APK; los
cambios del módulo Android sí requieren una APK nueva.

## Verificación pendiente en el equipo real

La compilación prueba que la APK se genera. Antes de sustituir el servicio
actual, instala la APK en la tablet de Full China y comprueba una precuenta
corta, otra larga, el corte y la reconexión tras apagar/encender la impresora.
