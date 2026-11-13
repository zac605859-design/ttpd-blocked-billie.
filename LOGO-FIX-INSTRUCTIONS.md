# Stage 23 — Correct JPEG logo extension

Your screenshot confirms `site-logo.png` is actually a JPEG image (Windows reports “JPEG File”, 1073 × 976). The extension does not match the file's real format.

## What to do
1. In this folder, rename `site-logo.png` to `site-logo.jpg`.
2. Keep it beside `index.html` and `homepage-preview.html`.
3. Open `index.html` and press Ctrl + F5.

The homepage code now requests `./site-logo.jpg` directly. Do not convert the image; just rename the extension because it is already a JPEG.

No logo image was embedded in this ZIP. It contains the website code fix; copy your own logo file into the folder and rename it as instructed.
