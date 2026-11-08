# Web de Axis

Landing de una página: `index.html`, `styles.css`, `main.js`. Sin fotos: todo está dibujado en código.
v2, oscura y tecnológica, a partir de las referencias del TikTok que mandó Tomás (synex, SynapseX):
- un diagrama vivo en canvas, donde las consultas entran al núcleo y salen resueltas;
- una terminal que arma la herramienta con el nombre del negocio;
- archivos diff para "Qué resolvemos";
- un pipeline que se enciende con el scroll;
- un mapa de nodos del equipo.

El movimiento sigue la preferencia del sistema; el botón "Animación" de la barra lo cambia y queda guardado.

Para verla, abrir `index.html` o correr `python -m http.server 8765`. Publicada en https://warcrock.github.io/axis-web/ (rama `publicar` → `main`).

SEO y redes: `og.png` (1200x630, la vista previa de WhatsApp) sale de `og/og.html`; se regenera con `node og/render.js .` junto con `apple-touch-icon.png` y `favicon-32.png`. `robots.txt` y `sitemap.xml` apuntan a la URL de Pages: si se compra dominio, cambiarlos junto con `canonical`, `og:url` y el JSON-LD de `index.html`.

Contacto: WhatsApp 260 467-0292, axispymes@gmail.com, @axis.pymes en Instagram y TikTok.
