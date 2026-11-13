# Open the preview locally

Opening `index.html` by double-clicking uses a `file://` address. Browsers can restrict network requests from local files, so Supabase data may fail to load even when the HTML and CSS render.

To serve the folder locally on Windows:

1. Open the extracted Stage 20 folder in File Explorer.
2. Click the address bar, type `cmd`, and press Enter.
3. Run:

```powershell
python -m http.server 8000
```

4. Keep that terminal window open.
5. In your browser, visit `http://localhost:8000/`.

If Python is not available, try `py -m http.server 8000`.

This only serves the local preview. It does not publish changes or modify Supabase. If the page still cannot load data at localhost, check the browser Console (F12) and Network tab; the remaining issue may be Supabase access, RLS, or a database query error.
