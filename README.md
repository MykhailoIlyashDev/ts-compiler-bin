# ts-compiler-bin

A lightweight tool that compiles TypeScript into a single executable binary.

## Installation

```bash
npm install -g ts-compiler-bin
```

Or use it directly with npx:

```bash
npx ts-compiler-bin [options] <entry-file>
```

## Usage

### Command Line

```bash
ts-compiler-bin [options] <entry-file>
```

Options:
- `--out, -o`: Output file name (default: "output")
- `--target, -t`: Node.js target version (default: "16")
- `--platform, -p`: Target platform: win, macos, linux, alpine, all (default: current platform)
- `--help, -h`: Show help message

Example:
```bash
ts-compiler-bin -o my-app src/index.ts
```

### Programmatic Usage

```typescript
import { compile } from 'ts-compiler-bin';

async function build() {
  await compile({
    entryPoint: 'src/index.ts',
    outFile: 'my-app',
    platform: 'all', // Build for all platforms
    nodeVersion: '16'
  });
}

build().catch(console.error);
```

## How It Works

ts-compiler-bin uses:
1. **esbuild** to bundle your TypeScript code into a single JavaScript file
2. **pkg** to package the bundled JavaScript into a standalone executable

### Features
- Simple API: Easy to use both from command line and programmatically
- Fast Compilation: Leverages esbuild for extremely fast bundling
- Cross-Platform: Create binaries for Windows, macOS, and Linux
- Zero Runtime Dependencies: Final executables run without Node.js installed
- TypeScript Support: Native support for TypeScript without additional configuration

### Advanced Usage

### Custom Node Modules
If your project uses native Node.js modules that require compilation, you may need to include additional assets:

```bash
ts-compiler-bin -o my-app --assets="node_modules/some-native-module/**/*" src/index.ts
```

### Working with Environment Variables
Environment variables can be accessed in your TypeScript code as usual:

```typescript
const apiKey = process.env.API_KEY || 'default-key';
```
When running the compiled binary:
API_KEY=my-secret-key ./my-app

### Troubleshooting
### Common Issues
- Missing Dependencies: If you encounter errors about missing dependencies, make sure all dependencies are properly installed in your project.
- Native Module Issues: Some native modules might not work properly when bundled. Consider using pure JavaScript alternatives when possible.
- Large Binary Size: If your binary is too large, consider using the --minify option to reduce its size.

### Debug Mode
To see more detailed logs during compilation:

DEBUG=ts-compiler-bin ts-compiler-bin -o my-app src/index.ts

### Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

- Fork the repository
- Create your feature branch (git checkout -b feature/amazing-feature)
- Commit your changes (git commit -m 'Add some amazing feature')
- Push to the branch (git push origin feature/amazing-feature)
- Open a Pull Request


## License

MIT

Made by Michael Ilyash