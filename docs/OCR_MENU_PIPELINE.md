# OCR Menu Pipeline

Updated: 2026-05-05

## Local Runtime

Installed and verified on this machine:

- MarkItDown CLI in `.venv-markitdown/bin/markitdown`
- Poppler CLI: `pdftotext`, `pdftoppm`
- OCRmyPDF with Tesseract and Ghostscript
- PaddleOCR in `.venv-paddleocr/bin/paddleocr`
- PaddlePaddle CPU backend in `.venv-paddleocr`

Install commands used:

```bash
brew install poppler tesseract ghostscript ocrmypdf
python3 -m venv .venv-markitdown
. .venv-markitdown/bin/activate
python -m pip install --upgrade pip
python -m pip install 'markitdown[all]'

python3.11 -m venv .venv-paddleocr
. .venv-paddleocr/bin/activate
python -m pip install --upgrade pip
python -m pip install paddleocr paddlepaddle
```

Use this PaddleOCR command in local runs:

```bash
PADDLEOCR_COMMAND=".venv-paddleocr/bin/paddleocr ocr -i {input} --save_path {output} --lang en"
```

## Unified Command

```bash
npm run extract:menu-document -- \
  --input <menu.pdf|menu.png|menu.md> \
  --client <client-slug> \
  --source-url <original-url> \
  --evidence clients/<client-slug>/evidence/evidence.json \
  --output-dir clients/<client-slug>/artifacts/menu-document
```

Attempt order:

1. MarkItDown for PDFs and document formats.
2. Direct text for `.txt` / `.md`.
3. OCRmyPDF for scanned PDFs.
4. PDF render to PNG plus PaddleOCR when OCRmyPDF text extraction is weak.
5. PaddleOCR for image menu files.

Each run writes `manifest.json` with every attempt and selected provider. The selected text is parsed into `menu.sections` evidence with source chains.

## Verified Locally

- Text PDF: MarkItDown selected, 3 sections / 7 items.
- Image menu PNG: PaddleOCR selected, 2 sections / 5 items.
- Scanned PDF: OCRmyPDF ran, then `pdf_render+paddleocr` selected, 2 sections / 4 items.

Notes:

- OCRmyPDF can create a searchable PDF but may produce weaker line grouping for menu photos.
- PaddleOCR can split visual rows into separate tokens on high-resolution renders; the pipeline uses lower-DPI PDF rendering to keep rows together.
- Tesseract language data currently includes English only. Install `tesseract-lang` if we need Chinese/Japanese/Korean menus.
