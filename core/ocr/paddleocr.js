import fs from 'fs';
import path from 'path';
import { execFileSync, execSync } from 'child_process';

export function checkPaddleOcrAvailability({ env = process.env } = {}) {
  const configuredCommand = env.PADDLEOCR_COMMAND || '';
  const cliPath = findBinary('paddleocr');
  const pythonModule = hasPythonModule('paddleocr');
  return {
    ok: Boolean(configuredCommand || cliPath || pythonModule),
    configuredCommand: Boolean(configuredCommand),
    cliPath: cliPath || '',
    pythonModule,
    recommendation: configuredCommand
      ? 'Use PADDLEOCR_COMMAND.'
      : 'Set PADDLEOCR_COMMAND for deterministic OCR execution in this project.',
  };
}

export function runPaddleOcr({ inputPath, outputPath, commandTemplate = process.env.PADDLEOCR_COMMAND } = {}) {
  if (!inputPath) throw new Error('inputPath is required');
  if (!outputPath) throw new Error('outputPath is required');
  if (!commandTemplate) {
    throw new Error('PADDLEOCR_COMMAND is required. Example: PADDLEOCR_COMMAND="paddleocr ocr -i {input} --save_path {output}"');
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const command = commandTemplate
    .replaceAll('{input}', shellQuote(inputPath))
    .replaceAll('{output}', shellQuote(outputPath));
  execSync(command, { stdio: 'inherit', shell: '/bin/sh' });
  return outputPath;
}

export function readOcrTextOutput(outputPath) {
  if (!fs.existsSync(outputPath)) throw new Error(`OCR output not found: ${outputPath}`);
  if (fs.statSync(outputPath).isDirectory()) {
    const candidates = fs.readdirSync(outputPath)
      .filter((name) => /\.(md|txt|json)$/i.test(name))
      .map((name) => path.join(outputPath, name));
    if (!candidates.length) throw new Error(`No .md, .txt, or .json OCR output found in ${outputPath}`);
    return readOcrTextFile(candidates[0]);
  }
  return readOcrTextFile(outputPath);
}

function readOcrTextFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  if (!/\.json$/i.test(filePath)) return text;
  try {
    const parsed = JSON.parse(text);
    const lines = extractRecTexts(parsed);
    if (lines.length) return lines.join('\n');
  } catch {
    // Return the raw text below.
  }
  return text;
}

function extractRecTexts(value) {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value.rec_texts)) return value.rec_texts.map(String).filter(Boolean);
  if (value.res) return extractRecTexts(value.res);
  if (Array.isArray(value)) return value.flatMap(extractRecTexts);
  return [];
}

function hasPythonModule(moduleName) {
  for (const python of ['python3', 'python']) {
    const binary = findBinary(python);
    if (!binary) continue;
    try {
      execFileSync(binary, ['-c', `import ${moduleName}`], { stdio: 'ignore' });
      return true;
    } catch {
      // Try the next Python binary.
    }
  }
  return false;
}

function findBinary(name) {
  const paths = (process.env.PATH || '').split(path.delimiter);
  for (const dir of paths) {
    const candidate = path.join(dir, name);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}
