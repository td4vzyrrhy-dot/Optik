Place the finished 16:9 cave illustration here as `hoehlenwelt.png`.

The website loads this image automatically from this folder.

Fina's separate transparent sprite artwork is expected as `fina-spritesheet.webp`:

- 1280 x 2048 pixels, RGBA transparency
- 5 columns x 8 rows; each frame is 256 x 256 pixels
- Columns: idle, then four consecutive walk-cycle frames
- Rows: north, northeast, east, southeast, south, southwest, west, northwest
- Keep the same fox design, scale, lighting direction, and ground-contact point in every frame
- Place the feet near the bottom center of every frame, with soft natural shading and no baked-in background

The site crops one frame at a time and keeps the sprite aligned to the map coordinates. It does not use a vector-fox fallback when this artwork is missing.