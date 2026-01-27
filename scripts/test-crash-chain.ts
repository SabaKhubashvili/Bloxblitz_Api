import * as crypto from 'crypto';
import * as fs from 'fs';

// =============================
// CONSTANTS
// =============================
const HOUSE_EDGE = 0.01;
const DEFAULT_BLOCK_HASH = '0000000000000000001b34dc6a1e86083f95500b096231436e9b25cbdd0075c4';

// =============================
// CRASH POINT CALCULATION
// =============================
function calculateCrashPoint(gameHash: string, clientSeed: string): number {
  const hmac = crypto.createHmac('sha256', gameHash);
  hmac.update(clientSeed);
  const hex = hmac.digest('hex').substring(0, 8);
  const int = parseInt(hex, 16);
  
  const rawCrashPoint = (Math.pow(2, 32) / (int + 1)) * (1 - HOUSE_EDGE);
  const rounded = Math.floor(rawCrashPoint * 100) / 100;
  const crashPoint = Math.min(1000, Math.max(1.0, rounded));
  
  return crashPoint;
}

// =============================
// STATISTICS CALCULATION
// =============================
interface Statistics {
  total: number;
  average: number;
  median: number;
  min: number;
  max: number;
  stdDev: number;
  distribution: Array<{
    min: number;
    max: number;
    label: string;
    count: number;
  }>;
}

function calculateStatistics(crashPoints: number[]): Statistics {
  const total = crashPoints.length;
  const sum = crashPoints.reduce((a, b) => a + b, 0);
  const average = sum / total;

  const sorted = [...crashPoints].sort((a, b) => a - b);
  const median = sorted[Math.floor(total / 2)];
  const min = sorted[0];
  const max = sorted[total - 1];

  // Distribution ranges
  const ranges = [
    { min: 1.0, max: 1.99, label: '1.00-1.99x', count: 0 },
    { min: 2.0, max: 4.99, label: '2.00-4.99x', count: 0 },
    { min: 5.0, max: 9.99, label: '5.00-9.99x', count: 0 },
    { min: 10.0, max: 49.99, label: '10.00-49.99x', count: 0 },
    { min: 50.0, max: 99.99, label: '50.00-99.99x', count: 0 },
    { min: 100.0, max: Infinity, label: '100.00x+', count: 0 },
  ];

  crashPoints.forEach((cp) => {
    for (const range of ranges) {
      if (cp >= range.min && cp <= range.max) {
        range.count++;
        break;
      }
    }
  });

  // Calculate variance and standard deviation
  const variance =
    crashPoints.reduce((acc, cp) => acc + Math.pow(cp - average, 2), 0) / total;
  const stdDev = Math.sqrt(variance);

  return {
    total,
    average,
    median,
    min,
    max,
    stdDev,
    distribution: ranges,
  };
}

// =============================
// DISPLAY FUNCTIONS
// =============================
function displayStatistics(stats: Statistics, crashPoints: number[]): void {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║  CRASH POINT STATISTICS                                   ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  console.log(`Total Games:       ${stats.total.toLocaleString()}`);
  console.log(`Average Crash:     ${stats.average.toFixed(4)}x`);
  console.log(`Median Crash:      ${stats.median.toFixed(2)}x`);
  console.log(`Std Deviation:     ${stats.stdDev.toFixed(4)}`);
  console.log(`Min Crash:         ${stats.min.toFixed(2)}x`);
  console.log(`Max Crash:         ${stats.max.toFixed(2)}x\n`);

  console.log('Distribution:');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('Range              Count        Percentage');
  console.log('═══════════════════════════════════════════════════════════');

  stats.distribution.forEach((range) => {
    const percentage = ((range.count / stats.total) * 100).toFixed(2);
    console.log(
      `${range.label.padEnd(18)} ${range.count.toString().padStart(5)}        ${percentage.padStart(6)}%`
    );
  });

  console.log('═══════════════════════════════════════════════════════════\n');

  // Find notable crashes
  const highCrashes = crashPoints
    .map((cp, idx) => ({ round: idx + 1, crashPoint: cp }))
    .filter((item) => item.crashPoint >= 100)
    .sort((a, b) => b.crashPoint - a.crashPoint)
    .slice(0, 10);

  if (highCrashes.length > 0) {
    console.log('🚀 Top 10 Highest Crashes:');
    console.log('═══════════════════════════════════════════════════════════');
    highCrashes.forEach((item, idx) => {
      console.log(
        `${(idx + 1).toString().padStart(2)}. Round ${item.round.toString().padStart(5)} - ${item.crashPoint.toFixed(2)}x`
      );
    });
    console.log();
  }
}

// =============================
// MAIN GENERATOR FUNCTION
// =============================
interface GeneratorOptions {
  chainLength?: number;
  serverSeed?: string;
  blockHash?: string;
  saveToFile?: boolean;
}

interface GeneratorResult {
  mainServerSeed: string;
  finalHash: string;
  blockHash: string;
  chainLength: number;
  generatedAt: string;
  statistics: Statistics;
  seeds: Array<{
    round: number;
    gameHash: string;
    crashPoint: number;
  }>;
}

async function generateCrashPoints(options: GeneratorOptions = {}): Promise<GeneratorResult> {
  const {
    chainLength = 10000,
    serverSeed = crypto.randomBytes(32).toString('hex'),
    blockHash = DEFAULT_BLOCK_HASH,
    saveToFile = true,
  } = options;

  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║  CRASH POINT GENERATOR WITH STATISTICS                    ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  console.log(`Chain Length:      ${chainLength.toLocaleString()}`);
  console.log(`Server Seed:       ${serverSeed.substring(0, 40)}...`);
  console.log(`Block Hash:        ${blockHash.substring(0, 40)}...`);
  console.log();

  console.log('📊 Generating hash chain and calculating crash points...\n');

  const startTime = Date.now();
  const seeds: string[] = [];
  const crashPoints: number[] = [];

  // Generate seeds going backwards (from mainServerSeed to finalHash)
  let currentHash = serverSeed;

  for (let i = 0; i < chainLength; i++) {
    seeds.push(currentHash);

    // Calculate crash point for this game
    const crashPoint = calculateCrashPoint(currentHash, blockHash);
    crashPoints.push(crashPoint);

    // Hash for next iteration (going backwards in the chain)
    currentHash = crypto.createHash('sha256').update(currentHash).digest('hex');

    if ((i + 1) % 1000 === 0) {
      const progress = (((i + 1) / chainLength) * 100).toFixed(1);
      console.log(
        `  ${progress}% | ${(i + 1).toLocaleString()} / ${chainLength.toLocaleString()} seeds generated`
      );
    }
  }

  const finalHash = currentHash;
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`\n✅ Generated ${chainLength.toLocaleString()} seeds in ${elapsed}s\n`);

  // Calculate statistics
  console.log('📊 Calculating statistics...\n');
  const stats = calculateStatistics(crashPoints);

  // Display statistics
  displayStatistics(stats, crashPoints);

  // Prepare result
  const result: GeneratorResult = {
    mainServerSeed: serverSeed,
    finalHash,
    blockHash,
    chainLength,
    generatedAt: new Date().toISOString(),
    statistics: stats,
    seeds: seeds.map((seed, idx) => ({
      round: idx + 1,
      gameHash: seed,
      crashPoint: crashPoints[idx],
    })),
  };

  // Export to JSON file
  if (saveToFile) {
    const filename = `crash_seeds_${Date.now()}.json`;
    fs.writeFileSync(filename, JSON.stringify(result, null, 2));
    console.log(`✅ Exported to: ${filename}\n`);
  }

  // Display verification info
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║  VERIFICATION INFO                                        ║');
  console.log('╠═══════════════════════════════════════════════════════════╣');
  console.log(`║  Main Seed:     ${serverSeed.substring(0, 40)}... ║`);
  console.log(`║  Final Hash:    ${finalHash.substring(0, 40)}... ║`);
  console.log(`║  Block Hash:    ${blockHash.substring(0, 40)}... ║`);
  console.log(`║  Total Games:   ${chainLength.toLocaleString().padEnd(43)} ║`);
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  return result;
}

// =============================
// VERIFY SINGLE GAME
// =============================
function verifyGame(gameHash: string, clientSeed: string): void {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║  VERIFY GAME                                              ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  const hmac = crypto.createHmac('sha256', gameHash);
  hmac.update(clientSeed);
  const hex = hmac.digest('hex').substring(0, 8);
  const int = parseInt(hex, 16);
  
  const rawCrashPoint = (Math.pow(2, 32) / (int + 1)) * (1 - HOUSE_EDGE);
  const rounded = Math.floor(rawCrashPoint * 100) / 100;
  const crashPoint = Math.min(1000, Math.max(1.0, rounded));

  console.log(`Game Hash:      ${gameHash}`);
  console.log(`Client Seed:    ${clientSeed}`);
  console.log(`HMAC (first 8): ${hex}`);
  console.log(`Integer:        ${int}`);
  console.log(`Raw Result:     ${rawCrashPoint.toFixed(4)}`);
  console.log(`Crash Point:    ${crashPoint}x\n`);
}

// =============================
// EXAMPLE USAGE
// =============================

// Example 1: Generate 10,000 games with default settings
generateCrashPoints({ chainLength: 10000 });

// Example 2: Generate with custom parameters
// generateCrashPoints({
//   chainLength: 5000,
//   serverSeed: 'your_custom_seed_here',
//   blockHash: 'your_custom_block_hash_here',
//   saveToFile: true,
// });

// Example 3: Verify a specific game
// verifyGame(
//   '6adc86b7a226195dc1f394e75e66bbf53b1527d8e18cd24be6395e0e73c107d9',
//   DEFAULT_BLOCK_HASH
// );

// Export functions for use as module
export {
  calculateCrashPoint,
  calculateStatistics,
  displayStatistics,
  generateCrashPoints,
  verifyGame,
  type Statistics,
  type GeneratorOptions,
  type GeneratorResult,
};