#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
const esbuild = require('esbuild');
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface CompileOptions {
  entryPoint: string;
  outFile: string;
  target?: string;
  platform?: 'win' | 'macos' | 'linux' | 'alpine' | 'all';
  nodeVersion?: string;
}

async function compile(options: CompileOptions): Promise<void> {
  const {
    entryPoint,
    outFile,
    target = 'node16',
    platform = process.platform === 'win32' ? 'win' : process.platform === 'darwin' ? 'macos' : 'linux',
    nodeVersion = '16'
  } = options;

  console.log('📦 Bundling TypeScript code...');
  
  // Step 1: Bundle TypeScript code with esbuild
  const tempDir = path.join(process.cwd(), '.ts-compiler-bin-temp');
  const bundleFile = path.join(tempDir, 'bundle.js');
  
  // Create temp directory if it doesn't exist
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  // Bundle the TypeScript code
  await esbuild.build({
    entryPoints: [entryPoint],
    bundle: true,
    platform: 'node',
    target: [`node${nodeVersion}`],
    outfile: bundleFile,
    minify: true,
    sourcemap: false,
  });

  console.log('✅ TypeScript bundling complete');
  console.log('🔨 Creating executable binary...');

  // Step 2: Use pkg to create an executable
  const pkgTargets: string[] = [];
  
  if (platform === 'all') {
    pkgTargets.push(`node${nodeVersion}-win-x64`);
    pkgTargets.push(`node${nodeVersion}-macos-x64`);
    pkgTargets.push(`node${nodeVersion}-linux-x64`);
  } else {
    pkgTargets.push(`node${nodeVersion}-${platform}-x64`);
  }

  const pkgTargetsStr = pkgTargets.join(',');
  
  try {
    await execAsync(`npx pkg ${bundleFile} --targets ${pkgTargetsStr} --output ${outFile}`);
    console.log(`✅ Executable created successfully: ${outFile}`);
  } catch (error) {
    console.error('❌ Error creating executable:', error);
    throw error;
  } finally {
    // Clean up temporary files
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

// CLI interface
export async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
ts-compiler-bin - A lightweight tool that compiles TypeScript into a single executable binary

Usage:
  ts-compiler-bin [options] <entry-file>

Options:
  --out, -o       Output file name (default: "output")
  --target, -t    Node.js target version (default: "16")
  --platform, -p  Target platform: win, macos, linux, alpine, all (default: current platform)
  --help, -h      Show this help message

Example:
  ts-compiler-bin -o my-app src/index.ts
`);
    return;
  }

  let entryPoint = '';
  let outFile = 'output';
  let target = '16';
  let platform: CompileOptions['platform'] = process.platform === 'win32' ? 'win' : 
                                            process.platform === 'darwin' ? 'macos' : 'linux';

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--out' || arg === '-o') {
      outFile = args[++i];
    } else if (arg === '--target' || arg === '-t') {
      target = args[++i];
    } else if (arg === '--platform' || arg === '-p') {
      platform = args[++i] as CompileOptions['platform'];
    } else if (!arg.startsWith('-')) {
      entryPoint = arg;
    }
  }

  if (!entryPoint) {
    console.error('❌ Error: Entry point is required');
    process.exit(1);
  }

  try {
    await compile({
      entryPoint,
      outFile,
      target: `node${target}`,
      platform,
      nodeVersion: target
    });
  } catch (error) {
    console.error('❌ Compilation failed:', error);
    process.exit(1);
  }
}

// Export the compile function for programmatic use
export { compile, CompileOptions };
