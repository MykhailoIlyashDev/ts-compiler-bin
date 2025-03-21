import * as fs from 'fs';
import * as path from 'path';
const esbuild = require('esbuild');
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface CompileOptions {
  entryPoint: string;
  outFile: string;
  target?: string;
  platform?: 'win' | 'macos' | 'linux' | 'alpine' | 'all';
  nodeVersion?: string;
  assets?: string | string[]; // Опція для активів
}

export async function compile(options: CompileOptions): Promise<void> {
  const {
    entryPoint,
    outFile,
    target = 'node16',
    platform = process.platform === 'win32' ? 'win' : process.platform === 'darwin' ? 'macos' : 'linux',
    nodeVersion = '16',
    assets = [] // За замовчуванням пустий масив
  } = options;

  console.log('📦 Bundling TypeScript code...');
  console.log('Current working directory:', process.cwd());
  console.log('Entry point (raw):', entryPoint);
  
  // Перевірка існування файлу
  const entryPointPath = path.resolve(entryPoint);
  console.log('Entry point (resolved):', entryPointPath);
  if (!fs.existsSync(entryPointPath)) {
    console.error(`❌ Error: File not found: ${entryPointPath}`);
    throw new Error(`File not found: ${entryPointPath}`);
  }
  
  // Step 1: Bundle TypeScript code with esbuild
  const tempDir = path.join(process.cwd(), '.ts-compiler-bin-temp');
  const bundleFile = path.join(tempDir, 'bundle.js');
  console.log('Temp directory:', tempDir);
  console.log('Bundle file:', bundleFile);
  
  // Create temp directory if it doesn't exist
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  // Bundle the TypeScript code
  try {
    await esbuild.build({
      entryPoints: [entryPointPath],
      bundle: true,
      platform: 'node',
      target: [`node${nodeVersion}`],
      outfile: bundleFile,
      minify: true,
      sourcemap: false,
    });
  } catch (error) {
    console.error('❌ Error bundling with esbuild:', error);
    throw error;
  }

  console.log('✅ TypeScript bundling complete');
  
  // Step 2: Copy assets if specified
  const assetsArray = typeof assets === 'string' ? [assets] : assets;
  let hasAssets = false;
  
  if (assetsArray.length > 0) {
    console.log('📂 Copying assets...');
    
    // Create assets directory in temp directory
    const tempAssetsDir = path.join(tempDir, 'assets');
    if (!fs.existsSync(tempAssetsDir)) {
      fs.mkdirSync(tempAssetsDir, { recursive: true });
    }
    
    // Copy each asset or directory
    for (const asset of assetsArray) {
      const assetPath = path.resolve(asset);
      console.log(`Copying asset: ${assetPath}`);
      
      if (!fs.existsSync(assetPath)) {
        console.warn(`⚠️ Warning: Asset not found: ${assetPath}`);
        continue;
      }
      
      const assetStat = fs.statSync(assetPath);
      
      if (assetStat.isDirectory()) {
        // Для директорій копіюємо вміст безпосередньо в assets
        copyDirectoryContents(assetPath, tempAssetsDir);
        console.log(`✅ Directory contents copied: ${assetPath} -> ${tempAssetsDir}`);
        hasAssets = true;
      } else {
        // Copy file
        const targetFile = path.join(tempAssetsDir, path.basename(assetPath));
        fs.copyFileSync(assetPath, targetFile);
        console.log(`✅ File copied: ${assetPath} -> ${targetFile}`);
        hasAssets = true;
      }
    }
    
    // Додаємо код для доступу до активів у бандл
    if (hasAssets) {
      console.log('📝 Adding asset helper code to bundle...');
      const assetHelperCode = `
// Asset helper functions
if (!global.__assetAccessInitialized) {
  global.__assetAccessInitialized = true;
  const fs = require('fs');
  const path = require('path');
  
  global.__readAsset = function(filename) {
    try {
      // Для pkg: шлях відносно виконуваного файлу
      const pkgPath = path.join(path.dirname(process.execPath), 'assets', filename);
      if (fs.existsSync(pkgPath)) {
        return fs.readFileSync(pkgPath, 'utf-8');
      }
      
      // Для pkg: альтернативний шлях
      const pkgPath2 = path.join(process.cwd(), 'assets', filename);
      if (fs.existsSync(pkgPath2)) {
        return fs.readFileSync(pkgPath2, 'utf-8');
      }
      
      // Для pkg: шлях відносно snapshot директорії
      if (process.pkg) {
        const snapshotPath = path.join('/snapshot/assets', filename);
        if (fs.existsSync(snapshotPath)) {
          return fs.readFileSync(snapshotPath, 'utf-8');
        }
      }
      
      // Для розробки: шлях відносно поточної директорії
      const devPath = path.join(__dirname, 'assets', filename);
      if (fs.existsSync(devPath)) {
        return fs.readFileSync(devPath, 'utf-8');
      }
      
      throw new Error('Asset file not found: ' + filename);
    } catch (error) {
      console.error('Error reading asset file ' + filename + ':', error);
      throw error;
    }
  };
}
`;
      
      // Додаємо хелпер код до бандлу
      const bundleContent = fs.readFileSync(bundleFile, 'utf-8');
      fs.writeFileSync(bundleFile, assetHelperCode + bundleContent);
      
      console.log('✅ Asset helper code added to bundle');
    }
    
    console.log('✅ Assets copying complete');
  }

  console.log('🔨 Creating executable binary...');

  // Step 3: Use pkg to create an executable
  const pkgTargets: string[] = [];
  
  if (platform === 'all') {
    pkgTargets.push(`node${nodeVersion}-win-x64`);
    pkgTargets.push(`node${nodeVersion}-macos-x64`);
    pkgTargets.push(`node${nodeVersion}-linux-x64`);
  } else {
    pkgTargets.push(`node${nodeVersion}-${platform}-x64`);
  }

  const pkgTargetsStr = pkgTargets.join(',');
  
  // Покращена обробка активів для pkg
  let pkgAssetsOption = '';
  if (hasAssets) {
    // Використовуємо правильний шлях для активів
    pkgAssetsOption = `--assets "${tempDir}/assets/**/*"`;
    
    // Створюємо README файл для активів, щоб pkg правильно їх обробив
    const readmePath = path.join(tempDir, 'assets', 'README.md');
    fs.writeFileSync(readmePath, 'This directory contains assets for the application.');
  }
  
  try {
    // Виконуємо pkg з правильними опціями
    const pkgCommand = `npx pkg ${bundleFile} --targets ${pkgTargetsStr} ${pkgAssetsOption} --output ${outFile}`;
    console.log('Executing pkg command:', pkgCommand);
    
    await execAsync(pkgCommand);
    console.log(`✅ Executable created successfully: ${outFile}`);
    
    // Створюємо директорію assets поруч з виконуваним файлом
    if (hasAssets) {
      const exeAssetsDir = path.join(path.dirname(outFile), 'assets');
      if (!fs.existsSync(exeAssetsDir)) {
        fs.mkdirSync(exeAssetsDir, { recursive: true });
      }
      
      // Копіюємо активи поруч з виконуваним файлом для додаткової надійності
      copyDirectoryContents(path.join(tempDir, 'assets'), exeAssetsDir);
      console.log(`✅ Assets copied to executable directory: ${exeAssetsDir}`);
    }
  } catch (error) {
    console.error('❌ Error creating executable:', error);
    throw error;
  } finally {
    // Clean up temporary files
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

// Helper function to copy directory recursively
function copyDirectoryRecursive(source: string, target: string): void {
  // Create target directory if it doesn't exist
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }
  
  // Read source directory
  const entries = fs.readdirSync(source, { withFileTypes: true });
  
  // Copy each entry
  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    
    if (entry.isDirectory()) {
      // Recursively copy subdirectory
      copyDirectoryRecursive(sourcePath, targetPath);
    } else {
      // Copy file
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

// Нова функція для копіювання вмісту директорії (без створення піддиректорії)
function copyDirectoryContents(source: string, target: string): void {
  // Create target directory if it doesn't exist
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }
  
  // Read source directory
  const entries = fs.readdirSync(source, { withFileTypes: true });
  
  // Copy each entry
  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    
    if (entry.isDirectory()) {
      // Recursively copy subdirectory
      copyDirectoryRecursive(sourcePath, targetPath);
    } else {
      // Copy file
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

// CLI interface
export async function main() {
  console.log('Starting main function...');
  const args = process.argv.slice(2);
  console.log('Arguments:', args);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
ts-compiler-bin - A lightweight tool that compiles TypeScript into a single executable binary

Usage:
  ts-compiler-bin [options] <entry-file>

Options:
  --out, -o     Output file name (default: "output")
  --target, -t  Node.js target version (default: "16")
  --platform, -p Target platform: win, macos, linux, alpine, all (default: current platform)
  --assets, -a  Assets to include (can be specified multiple times)
  --help, -h    Show this help message

Example:
  ts-compiler-bin -o my-app -a assets src/index.ts
`);
    return;
  }

  let entryPoint = '';
  let outFile = 'output';
  let target = '16';
  let platform: CompileOptions['platform'] = process.platform === 'win32' ? 'win' :
    process.platform === 'darwin' ? 'macos' : 'linux';
  const assets: string[] = [];

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--out' || arg === '-o') {
      outFile = args[++i];
    } else if (arg === '--target' || arg === '-t') {
      target = args[++i];
    } else if (arg === '--platform' || arg === '-p') {
      platform = args[++i] as CompileOptions['platform'];
    } else if (arg === '--assets' || arg === '-a') {
      assets.push(args[++i]);
    } else if (!arg.startsWith('-')) {
      entryPoint = arg;
    }
  }

  console.log('Parsed arguments:');
  console.log('- entryPoint:', entryPoint);
  console.log('- outFile:', outFile);
  console.log('- target:', target);
  console.log('- platform:', platform);
  console.log('- assets:', assets);

  if (!entryPoint) {
    console.error('❌ Error: Entry point is required');
    process.exit(1);
  }

  // Перетворіть відносний шлях на абсолютний
  const absoluteEntryPoint = path.resolve(entryPoint);
  console.log('Absolute entry point:', absoluteEntryPoint);

  try {
    await compile({
      entryPoint: absoluteEntryPoint,
      outFile,
      target: `node${target}`,
      platform,
      nodeVersion: target,
      assets
    });
  } catch (error) {
    console.error('❌ Compilation failed:', error);
    process.exit(1);
  }
}
