import { readdirSync, copyFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const srcDir = join(rootDir, 'src/generated/prisma-new');
const destDir = join(rootDir, 'dist/generated/prisma');

if (!existsSync(srcDir)) {
  console.error(`Source directory does not exist: ${srcDir}`);
  process.exit(1);
}

if (!existsSync(destDir)) {
  mkdirSync(destDir, { recursive: true });
}

try {
  const files = readdirSync(srcDir);
  let copiedCount = 0;
  
  files.forEach(file => {
    // Copy query engine files and .node binaries
    if (file.includes('query_engine') || file.endsWith('.node')) {
      copyFileSync(join(srcDir, file), join(destDir, file));
      copiedCount++;
      console.log(`Copied: ${file}`);
    }
  });
  
  if (copiedCount === 0) {
    console.warn('No Prisma engine files found to copy');
  } else {
    console.log(`Successfully copied ${copiedCount} Prisma engine file(s)`);
  }
} catch (error) {
  console.error('Error copying Prisma engine files:', error);
  process.exit(1);
}
