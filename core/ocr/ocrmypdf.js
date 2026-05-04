import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

export function checkOcrmypdfAvailability() {
  const cliPath = findBinary('ocrmypdf');
  const tesseractPath = findBinary('tesseract');
  const ghostscriptPath = findBinary('gs');
  return {
    ok: Boolean(cliPath && tesseractPath && ghostscriptPath),
    cliPath: cliPath || '',
    tesseractPath: tesseractPath || '',
    ghostscriptPath: ghostscriptPath || '',
    recommendation: 'Install ocrmypdf with Tesseract and Ghostscript for scanned PDF OCR.',
  };
}

export function runOcrmypdf({
  inputPath,
  outputPath,
  language = process.env.OCRMYPDF_LANG || 'eng',
  deskew = true,
  rotatePages = true,
} = {}) {
  if (!inputPath) throw new Error('inputPath is required');
  if (!outputPath) throw new Error('outputPath is required');
  const availability = checkOcrmypdfAvailability();
  if (!availability.ok) {
    throw new Error(`OCRmyPDF is not available: ${JSON.stringify(availability)}`);
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const args = ['-l', language, '--output-type', 'pdf'];
  if (deskew) args.push('--deskew');
  if (rotatePages) args.push('--rotate-pages');
  args.push(inputPath, outputPath);
  execFileSync(availability.cliPath, args, { stdio: 'inherit' });
  return outputPath;
}

function findBinary(name) {
  const paths = (process.env.PATH || '').split(path.delimiter);
  for (const dir of paths) {
    const candidate = path.join(dir, name);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}
