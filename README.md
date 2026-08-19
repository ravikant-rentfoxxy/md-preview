# Markdown Preview

Offline React app that opens a `.md` file, shows it as a readable page, and exports a PDF. Files never leave your computer.

## Run it

```bash
cd ~/Desktop/md-preview
npm install
npm run dev
```

Then open the local URL Vite prints (usually `http://localhost:5173`).

## Use it

1. Drag a `.md` file onto the window, or click **Open .md**
2. Read the formatted preview, or switch to **Source**
3. Click **Print / PDF**, then choose **Save as PDF** in the print dialog

An example file is in `public/example.md`.

## Offline

- No internet is required after `npm install`
- Markdown is rendered in the browser with `react-markdown` and `remark-gfm`
- Use **Print / PDF** and choose Save as PDF in the browser print dialog

To keep a copy you can open later without the Vite dev server:

```bash
npm run build
npm run preview
```
