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
    return fs.readFileSync(candidates[0], 'utf8');
  }
  return fs.readFileSync(outputPath, 'utf8');
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
