import https from 'https';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const sdkRoot = process.env.ANDROID_HOME || path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk');
const HOST_OS = 'windows';

const packages = [
  { id: 'platform-tools', dest: path.join(sdkRoot, 'platform-tools') },
  { id: 'build-tools;35.0.0', dest: path.join(sdkRoot, 'build-tools', '35.0.0') },
  { id: 'build-tools;36.0.0', dest: path.join(sdkRoot, 'build-tools', '36.0.0') },
  { id: 'platforms;android-36', dest: path.join(sdkRoot, 'platforms', 'android-36') },
];

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function findPackageUrl(xml, packagePath) {
  const escaped = packagePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(';', '\\;');
  const blockRe = new RegExp(`<remotePackage[^>]*path="${escaped}"[^>]*>([\\s\\S]*?)</remotePackage>`, 'i');
  const blockMatch = xml.match(blockRe);
  if (!blockMatch) return null;

  const block = blockMatch[1];
  const archives = [...block.matchAll(/<archive[^>]*>([\s\S]*?)<\/archive>/gi)];
  let fallback = null;

  for (const archive of archives) {
    const archiveXml = archive[1];
    const urlMatch = archiveXml.match(/<url>([^<]+)<\/url>/i);
    if (!urlMatch) continue;
    const osMatch = archiveXml.match(/<host-os>([^<]+)<\/host-os>/i);
    if (!osMatch) {
      fallback = fallback || urlMatch[1];
      continue;
    }
    if (osMatch[1].toLowerCase() === HOST_OS) return urlMatch[1];
    fallback = fallback || urlMatch[1];
  }

  return fallback;
}

function download(url, destFile) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destFile);
    https.get(`https://dl.google.com/android/repository/${url}`, (res) => {
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', reject);
  });
}

function extract(zip, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  execSync(`tar -xf "${zip}" -C "${destDir}"`, { stdio: 'inherit' });
}

function moveExtracted(extractDir, dest) {
  const entries = fs.readdirSync(extractDir).filter((e) => !e.endsWith('.zip'));
  if (entries.length !== 1) {
    throw new Error(`Expected one extracted folder in ${extractDir}, got: ${entries.join(', ')}`);
  }
  const src = path.join(extractDir, entries[0]);
  if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.renameSync(src, dest);
}

async function main() {
  console.log('SDK root:', sdkRoot);
  const xml = await fetchText('https://dl.google.com/android/repository/repository2-1.xml');
  const tmp = path.join(sdkRoot, 'tmp');
  fs.mkdirSync(tmp, { recursive: true });

  for (const pkg of packages) {
    const url = findPackageUrl(xml, pkg.id);
    if (!url) {
      console.error(`Package not found in repo: ${pkg.id}`);
      process.exit(1);
    }
    console.log(`Downloading ${pkg.id} -> ${url}`);
    const extractDir = path.join(tmp, pkg.id.replace(/[;]/g, '_'));
    const zipPath = path.join(extractDir, 'package.zip');
    if (fs.existsSync(extractDir)) fs.rmSync(extractDir, { recursive: true, force: true });
    fs.mkdirSync(extractDir, { recursive: true });
    await download(url, zipPath);
    extract(zipPath, extractDir);
    moveExtracted(extractDir, pkg.dest);
    console.log(`Installed ${pkg.id} to ${pkg.dest}`);
  }

  console.log('Android SDK packages installed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
