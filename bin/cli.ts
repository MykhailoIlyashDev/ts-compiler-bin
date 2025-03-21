console.log('CLI script starting...');
import { main } from '../src/index';

if (require.main === module) {
  console.log('Starting ts-compiler-bin CLI...');
  main().catch((error: any) => {
    console.error('Error in main function:', error);
    process.exit(1);
  });
}
