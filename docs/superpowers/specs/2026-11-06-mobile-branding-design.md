# Branding móvil RutaScan — diseño

Fecha: 2026-11-06
Estado: aprobado por el usuario ("hazlo")

## Intención

Que la app instalada en un teléfono se sienta como un producto real de RutaScan, no como un proyecto Flutter de prueba: ícono propio, splash de marca, modo claro/oscuro coherente y pantallas cuidadas que combinen con el landing rojo.

## Metas

- Ícono de lanzador con la marca RutaScan (rojo + QR), incluyendo ícono adaptativo de Android 8+.
- Splash rojo con el símbolo de la app, también en Android 12+.
- Tema claro y oscuro reales (`ThemeMode.system` + selector manual en Ajustes), persistido entre sesiones.
- Rediseño visual de Login y Home: cabecera con degradado rojo, tarjeta de formulario, tarjetas de resumen y botones de acción con profundidad.
- Mantener intacta toda la funcionalidad: login, escaneo, manifiesto, cola offline, firma, licencia y ajustes.

## No-metas

- No cambiar el backend, los endpoints ni la lógica de sincronización.
- No cambiar el landing ni el panel web.
- No agregar dependencias nuevas de UI.

## Enfoque

1. Tokens de color y `buildAppTheme(Brightness)` en `core/theme.dart`; `ThemeController` (ChangeNotifier) para el modo; persistencia en `SessionStore` con la clave `rs_theme_mode`.
2. Widgets compartidos: `BrandMark`, `SectionCard` y `GiantActionButton` con estilos del tema.
3. Refactor de colores fijos (`Colors.black54`, etc.) a colores del `ColorScheme`.
4. Íconos generados con Pillow a partir de un diseño vectorial simple (fondo rojo degradado + tarjeta blanca + QR).
5. Splash XML con fondo rojo, ícono centrado y variante `values-v31` para Android 12+.

## Decisiones

- Rojo de marca `#DC2626`, brillante `#EF4444`, profundo `#991B1B`.
- Fondo oscuro `#09090B`, superficie `#17171C`, borde `#27272A`.
- El modo por defecto es `system`; el usuario puede forzar Claro u Oscuro en Ajustes.
- El ícono adaptativo usa fondo rojo sólido y el símbolo QR blanco con padding seguro.

## Riesgos

- El refactor de color toca varias pantallas; se valida con `flutter analyze` y build release.
- El canvas de firma debe permanecer blanco para que la firma sea visible en modo oscuro.
