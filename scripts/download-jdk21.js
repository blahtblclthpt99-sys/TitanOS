import https from 'https';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const toolsDir = path.join(root, '.tools');
const jdkDir = path.join(toolsDir, 'jdk-21');
const zipPath = path.join(toolsDir, 'jdk-21.zip');
const url = 'https://aka.ms/download-jdk/microsoft-jdk-21.0.11-windows-x64.zip';

function download(destFile) {
  return new Promise((resolve, reject) => {
    const follow = (target, redirects = 0) => {
      if (redirects > 10) return reject(new Error('Too many redirects'));
      https.get(target, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return follow(res.headers.location, redirects + 1);
        }
        const file = fs.createWriteStream(destFile);
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
      }).on('error', reject);
    };
    follow(url);
  });
}

async function main() {
  const javaExe = path.join(jdkDir, 'bin', 'java.exe');
  if (fs.existsSync(javaExe)) {
    const version = execSync(`"${javaExe}" -version`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    console.log('Portable JDK already present:', version.split('\n')[0]);
    return;
  }

  fs.mkdirSync(toolsDir, { recursive: true });
  console.log('Downloading portable JDK 21...');
  await download(zipPath);
  console.log('Extracting...');
  if (fs.existsSync(jdkDir)) fs.rmSync(jdkDir, { recursive: true, force: true });
  execSync(`tar -xf "${zipPath}" -C "${toolsDir}"`, { stdio: 'inherit' });

  const entries = fs.readdirSync(toolsDir).filter((e) => e.startsWith('jdk-21') && e !== 'jdk-21.zip');
  if (entries.length !== 1) {
    throw new Error(`Unexpected JDK extract result: ${entries.join(', ')}`);
  }
  const extracted = path.join(toolsDir, entries[0]);
  if (extracted !== jdkDir) {
    if (fs.existsSync(jdkDir)) fs.rmSync(jdkDir, { recursive: true, force: true });
    fs.renameSync(extracted, jdkDir);
  }
  console.log('Portable JDK ready:', jdkDir);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
