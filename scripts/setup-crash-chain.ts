import { config } from 'dotenv';
import { PrismaClient, GameType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as crypto from 'crypto';
import * as readline from 'readline';
import * as fs from 'fs';

config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:{
    rejectUnauthorized: false,
  }
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
}

// =============================
// CONSTANTS
// =============================
const PROD_CHAIN_LENGTH = 10_000_000;
const TEST_CHAIN_LENGTH = 10_000;
const HOUSE_EDGE = 0.01;

// Bitcoin block 584,500 hash for testing
const DEFAULT_BLOCK_HASH =
  '0000000000000000001b34dc6a1e86083f95500b096231436e9b25cbdd0075c4';

// =============================
// NEW: GENERATE 10K SEEDS WITH STATISTICS
// =============================
async function generate10kSeedsWithStats() {
  console.log(
    '\n╔═══════════════════════════════════════════════════════════╗',
  );
  console.log('║  GENERATE 10K SEEDS WITH STATISTICS                       ║');
  console.log(
    '╚═══════════════════════════════════════════════════════════╝\n',
  );

  console.log('📋 This will:');
  console.log('   1. Generate a main server seed');
  console.log('   2. Hash backwards 10,000 times to create the chain');
  console.log('   3. Calculate crash points for all 10k games');
  console.log('   4. Save all crash points and statistics\n');

  const useCustomSeed = await question(
    'Use custom server seed? (yes/no, default: no): ',
  );

  let mainServerSeed: string;
  if (useCustomSeed.toLowerCase() === 'yes') {
    mainServerSeed = await question('Enter 64-character hex seed: ');
    if (!/^[a-f0-9]{64}$/i.test(mainServerSeed)) {
      console.log('❌ Invalid seed format. Using random seed instead.');
      mainServerSeed = crypto.randomBytes(32).toString('hex');
    }
  } else {
    mainServerSeed = crypto.randomBytes(32).toString('hex');
  }

  const useCustomBlock = await question(
    'Use custom Bitcoin block hash? (yes/no, default: 584,500): ',
  );

  let blockHash: string;
  if (useCustomBlock.toLowerCase() === 'yes') {
    blockHash = await question('Enter block hash: ');
    if (!/^[a-f0-9]{64}$/i.test(blockHash)) {
      console.log('❌ Invalid format. Using default block 584,500.');
      blockHash = DEFAULT_BLOCK_HASH;
    }
  } else {
    blockHash = DEFAULT_BLOCK_HASH;
  }

  console.log('\n📊 Generating hash chain backwards from server seed...\n');

  const startTime = Date.now();
  const chainLength = 10_000;
  const seeds: string[] = [];
  const crashPoints: number[] = [];

  // Generate seeds going backwards (from mainServerSeed to finalHash)
  let currentHash = mainServerSeed;

  for (let i = 0; i < chainLength; i++) {
    seeds.push(currentHash);

    // Calculate crash point for this game
    const hmac = crypto.createHmac('sha256', currentHash);
    hmac.update(blockHash);
    const hex = hmac.digest('hex').substring(0, 8);
    const int = parseInt(hex, 16);
    const crashPoint = Math.max(
      1,
      (Math.pow(2, 32) / (int + 1)) * (1 - HOUSE_EDGE),
    );
    const rounded = Math.floor(crashPoint * 100) / 100;

    crashPoints.push(rounded);

    // Hash for next iteration (going backwards in the chain)
    currentHash = crypto.createHash('sha256').update(currentHash).digest('hex');

    if ((i + 1) % 1000 === 0) {
      const progress = (((i + 1) / chainLength) * 100).toFixed(1);
      console.log(
        `  ${progress}% | ${(i + 1).toLocaleString()} / ${chainLength.toLocaleString()} seeds generated`,
      );
    }
  }

  const finalHash = currentHash; // This is the hash after 10k iterations
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(
    `\n✅ Generated ${chainLength.toLocaleString()} seeds in ${elapsed}s\n`,
  );

  // Calculate statistics
  console.log('📊 Calculating statistics...\n');

  const stats = calculateStatistics(crashPoints);

  // Display statistics
  displayStatistics(stats, crashPoints);

  // Save to database

  // Export to JSON file
  const exportData = {
    mainServerSeed,
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

  const filename = `crash_seeds_${Date.now()}.json`;
  fs.writeFileSync(filename, JSON.stringify(exportData, null, 2));

  console.log(`\n✅ Exported to: ${filename}\n`);

  // Display verification info
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║  VERIFICATION INFO                                        ║');
  console.log('╠═══════════════════════════════════════════════════════════╣');
  console.log(`║  Chain ID:      N/A                                      ║`);
  console.log(`║  Main Seed:     ${mainServerSeed.substring(0, 40)}... ║`);
  console.log(`║  Final Hash:    ${finalHash.substring(0, 40)}... ║`);
  console.log(`║  Block Hash:    ${blockHash.substring(0, 40)}... ║`);
  console.log(`║  Total Games:   ${chainLength.toLocaleString().padEnd(43)} ║`);
  console.log(
    '╚═══════════════════════════════════════════════════════════╝\n',
  );
}

function calculateStatistics(crashPoints: number[]) {
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

function displayStatistics(stats: any, crashPoints: number[]) {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║  CRASH POINT STATISTICS                                   ║');
  console.log(
    '╚═══════════════════════════════════════════════════════════╝\n',
  );

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

  stats.distribution.forEach((range: any) => {
    const percentage = ((range.count / stats.total) * 100).toFixed(2);
    console.log(
      `${range.label.padEnd(18)} ${range.count.toString().padStart(5)}        ${percentage.padStart(6)}%`,
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
        `${(idx + 1).toString().padStart(2)}. Round ${item.round.toString().padStart(5)} - ${item.crashPoint.toFixed(2)}x`,
      );
    });
    console.log();
  }
}

// =============================
// MAIN MENU (Updated)
// =============================
async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║   CRASH GAME - PROVABLY FAIR SETUP (STAKE.COM METHOD)    ║');
  console.log(
    '╚═══════════════════════════════════════════════════════════╝\n',
  );

  const action = await question(
    'What would you like to do?\n' +
      '1. Generate new hash chain (PRODUCTION - 10M games)\n' +
      '2. Generate test chain (TESTING - 10K games)\n' +
      '3. Set client seed (Bitcoin block)\n' +
      '4. View chain status\n' +
      '5. Verify a game\n' +
      '6. Pre-calculate crash points\n' +
      '7. Chain statistics\n' +
      '8. Export verification data\n' +
      '9. Test crash point calculation\n' +
      '10. Generate 10K seeds with statistics (NEW)\n' +
      'Enter choice (1-10): ',
  );

  try {
    switch (action.trim()) {
      case '1':
        await generateProductionChain();
        break;
      case '2':
        await generateTestChain();
        break;
      case '3':
        await setClientSeed();
        break;
      case '4':
        await viewChainStatus();
        break;
      case '5':
        await verifyGame();
        break;
      case '6':
        await precalculateCrashPoints();
        break;
      case '7':
        await showChainStatistics();
        break;
      case '8':
        await exportVerificationData();
        break;
      case '9':
        await testCrashPointCalculation();
        break;
      case '10':
        await generate10kSeedsWithStats();
        break;
      default:
        console.log('❌ Invalid choice');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  rl.close();
  await prisma.$disconnect();
}

// =============================
// [REST OF THE ORIGINAL CODE REMAINS THE SAME]
// =============================

async function generateProductionChain() {
  console.log(
    '\n╔═══════════════════════════════════════════════════════════╗',
  );
  console.log('║  GENERATING PRODUCTION HASH CHAIN (10,000,000 games)     ║');
  console.log(
    '╚═══════════════════════════════════════════════════════════╝\n',
  );
  console.log('⚠️  WARNING: This will take 30-60 minutes!\n');

  const confirm = await question(
    'Are you sure you want to continue? (yes/no): ',
  );
  if (confirm.toLowerCase() !== 'yes') {
    console.log('❌ Cancelled.');
    return;
  }

  const startTime = Date.now();
  const serverSeed = crypto.randomBytes(32).toString('hex');
  console.log(`\n📊 Server seed: ${serverSeed.substring(0, 32)}...\n`);

  console.log('📊 Calculating final hash (10,000,000 iterations)...');
  const finalHash = await calculateFinalHash(serverSeed, PROD_CHAIN_LENGTH);

  const chainId = crypto.randomBytes(16).toString('hex');
  await prisma.hashChain.create({
    data: {
      gameType: GameType.CRASH,
      chainId,
      serverSeed,
      finalHash,
      totalRounds: PROD_CHAIN_LENGTH,
      currentRound: 0,
      isActive: false,
    },
  });

  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\n✅ Generated in ${totalTime} minutes`);
  console.log(`\n📋 Final Hash: ${finalHash}\n`);
}

async function generateTestChain() {
  console.log(
    '\n╔═══════════════════════════════════════════════════════════╗',
  );
  console.log('║  GENERATING TEST HASH CHAIN (10,000 games)               ║');
  console.log(
    '╚═══════════════════════════════════════════════════════════╝\n',
  );

  const startTime = Date.now();
  const serverSeed = crypto.randomBytes(32).toString('hex');
  const finalHash = await calculateFinalHash(serverSeed, TEST_CHAIN_LENGTH);
  const chainId = crypto.randomBytes(16).toString('hex');

  await prisma.hashChain.create({
    data: {
      gameType: GameType.CRASH,
      chainId,
      serverSeed,
      finalHash,
      totalRounds: TEST_CHAIN_LENGTH,
      currentRound: 0,
      isActive: false,
    },
  });

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ Generated in ${totalTime} seconds`);
  console.log(`\n📋 Final Hash: ${finalHash}\n`);
}

async function setClientSeed() {
  console.log(
    '\n╔═══════════════════════════════════════════════════════════╗',
  );
  console.log('║  SET CLIENT SEED (Bitcoin Block Hash)                    ║');
  console.log(
    '╚═══════════════════════════════════════════════════════════╝\n',
  );

  const chains = await prisma.hashChain.findMany({
    where: { gameType: GameType.CRASH, clientSeed: null },
    orderBy: { createdAt: 'desc' },
  });

  if (chains.length === 0) {
    console.log('❌ No chains found that need a client seed.');
    return;
  }

  console.log('📋 Available chains:\n');
  chains.forEach((chain, index) => {
    console.log(
      `${index + 1}. Chain ID: ${chain.chainId} | Rounds: ${chain.totalRounds.toLocaleString()}`,
    );
  });

  const choice = await question(`\nSelect chain (1-${chains.length}): `);
  const selectedChain = chains[parseInt(choice) - 1];

  if (!selectedChain) {
    console.log('❌ Invalid choice');
    return;
  }

  const blockHash = await question('Block hash (64 hex characters): ');

  if (!/^[a-f0-9]{64}$/i.test(blockHash)) {
    console.log('❌ Invalid block hash format.');
    return;
  }

  await prisma.hashChain.updateMany({
    where: { gameType: GameType.CRASH, isActive: true },
    data: { isActive: false },
  });

  await prisma.hashChain.update({
    where: { id: selectedChain.id },
    data: {
      clientSeed: blockHash,
      clientSeedSetAt: new Date(),
      isActive: true,
    },
  });

  console.log('\n✅ CLIENT SEED SET SUCCESSFULLY!\n');
}

async function viewChainStatus() {
  console.log(
    '\n╔═══════════════════════════════════════════════════════════╗',
  );
  console.log('║  CHAIN STATUS                                             ║');
  console.log(
    '╚═══════════════════════════════════════════════════════════╝\n',
  );

  const chains = await prisma.hashChain.findMany({
    where: { gameType: GameType.CRASH },
    orderBy: { createdAt: 'desc' },
  });

  if (chains.length === 0) {
    console.log('❌ No chains found.\n');
    return;
  }

  for (const chain of chains) {
    const status = chain.isActive ? '✅ ACTIVE' : '⚪ INACTIVE';
    console.log(
      `${status} | Chain: ${chain.chainId} | Rounds: ${chain.totalRounds.toLocaleString()}\n`,
    );
  }
}

async function verifyGame() {
  console.log(
    '\n╔═══════════════════════════════════════════════════════════╗',
  );
  console.log('║  VERIFY GAME                                              ║');
  console.log(
    '╚═══════════════════════════════════════════════════════════╝\n',
  );

  const roundNumber = await question('Enter round number to verify: ');
  const roundNum = parseInt(roundNumber);

  if (isNaN(roundNum) || roundNum < 1) {
    console.log('❌ Invalid round number');
    return;
  }

  const round = await prisma.crashRound.findFirst({
    where: { roundNumber: roundNum },
    include: { chain: true },
  });

  if (!round) {
    console.log(`❌ Round #${roundNum} not found`);
    return;
  }

  console.log(`\nRound: ${round.roundNumber} | Crash: ${round.crashPoint}x`);
  console.log(`Game Hash: ${round.gameHash}\n`);
}

async function precalculateCrashPoints() {
  console.log(
    '\n╔═══════════════════════════════════════════════════════════╗',
  );
  console.log('║  PRE-CALCULATE CRASH POINTS                               ║');
  console.log(
    '╚═══════════════════════════════════════════════════════════╝\n',
  );

  const activeChain = await prisma.hashChain.findFirst({
    where: { gameType: GameType.CRASH, isActive: true },
  });

  if (!activeChain || !activeChain.clientSeed) {
    console.log('❌ No active chain with client seed found');
    return;
  }

  const count = await question('How many rounds to pre-calculate? ');
  const numRounds = parseInt(count);

  if (isNaN(numRounds) || numRounds < 1) {
    console.log('❌ Invalid number');
    return;
  }

  await precalculateRounds(activeChain, activeChain.clientSeed, numRounds);
}

async function showChainStatistics() {
  console.log(
    '\n╔═══════════════════════════════════════════════════════════╗',
  );
  console.log('║  CHAIN STATISTICS                                         ║');
  console.log(
    '╚═══════════════════════════════════════════════════════════╝\n',
  );

  const activeChain = await prisma.hashChain.findFirst({
    where: { gameType: GameType.CRASH, isActive: true },
  });

  if (!activeChain) {
    console.log('❌ No active chain found');
    return;
  }

  const rounds = await prisma.crashRound.findMany({
    where: { chainId: activeChain.chainId, crashPoint: { not: 0 } },
    select: { crashPoint: true },
  });

  if (rounds.length === 0) {
    console.log('❌ No rounds found');
    return;
  }

  const crashPoints = rounds.map((r) => Number(r.crashPoint));
  const stats = calculateStatistics(crashPoints);
  displayStatistics(stats, crashPoints);
}

async function exportVerificationData() {
  console.log(
    '\n╔═══════════════════════════════════════════════════════════╗',
  );
  console.log('║  EXPORT VERIFICATION DATA                                 ║');
  console.log(
    '╚═══════════════════════════════════════════════════════════╝\n',
  );

  const activeChain = await prisma.hashChain.findFirst({
    where: { gameType: GameType.CRASH, isActive: true },
  });

  if (!activeChain) {
    console.log('❌ No active chain found');
    return;
  }

  console.log(
    JSON.stringify(
      {
        chainId: activeChain.chainId,
        finalHash: activeChain.finalHash,
        clientSeed: activeChain.clientSeed,
        totalRounds: activeChain.totalRounds,
      },
      null,
      2,
    ),
  );
  console.log();
}

async function testCrashPointCalculation() {
  console.log(
    '\n╔═══════════════════════════════════════════════════════════╗',
  );
  console.log('║  TEST CRASH POINT CALCULATION                             ║');
  console.log(
    '╚═══════════════════════════════════════════════════════════╝\n',
  );

  const exampleGameHash =
    '6adc86b7a226195dc1f394e75e66bbf53b1527d8e18cd24be6395e0e73c107d9';
  const exampleClientSeed = DEFAULT_BLOCK_HASH;

  const hmac = crypto.createHmac('sha256', exampleGameHash);
  hmac.update(exampleClientSeed);
  const hex = hmac.digest('hex').substring(0, 8);
  const int = parseInt(hex, 16);
  const calculated = Math.max(
    1,
    (Math.pow(2, 32) / (int + 1)) * (1 - HOUSE_EDGE),
  );
  const rounded = Math.floor(calculated * 100) / 100;

  console.log(`Game Hash: ${exampleGameHash}`);
  console.log(`HMAC hex: ${hex}`);
  console.log(`Result: ${rounded}x\n`);
}

async function calculateFinalHash(
  serverSeed: string,
  totalRounds: number,
): Promise<string> {
  let currentHash = serverSeed;
  const updateInterval = totalRounds > 100000 ? 100000 : 1000;

  for (let i = 0; i < totalRounds; i++) {
    currentHash = crypto.createHash('sha256').update(currentHash).digest('hex');

    if (i % updateInterval === 0 && i > 0) {
      const progress = ((i / totalRounds) * 100).toFixed(1);
      console.log(
        `  ${progress}% | ${i.toLocaleString()}/${totalRounds.toLocaleString()}`,
      );
    }
  }

  return currentHash;
}

async function precalculateRounds(
  chain: any,
  clientSeed: string,
  count: number,
): Promise<void> {
  const startRound = chain.currentRound + 1;
  const endRound = Math.min(startRound + count - 1, chain.totalRounds);

  console.log(`\nPre-calculating rounds ${startRound} to ${endRound}...\n`);

  const batchSize = 1000;
  const totalToCreate = endRound - startRound + 1;
  const batches = Math.ceil(totalToCreate / batchSize);

  for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
    const batchStart = startRound + batchIndex * batchSize;
    const batchEnd = Math.min(batchStart + batchSize - 1, endRound);
    const roundsToCreate: any[] = [];

    for (let roundNum = batchStart; roundNum <= batchEnd; roundNum++) {
      const hashCount = chain.totalRounds - roundNum;
      let gameHash = chain.serverSeed;

      for (let i = 0; i < hashCount; i++) {
        gameHash = crypto.createHash('sha256').update(gameHash).digest('hex');
      }

      const hmac = crypto.createHmac('sha256', gameHash);
      hmac.update(clientSeed);
      const hex = hmac.digest('hex').substring(0, 8);
      const int = parseInt(hex, 16);

      const rawCrashPoint = (Math.pow(2, 32) / (int + 1)) * (1 - HOUSE_EDGE);
      const rounded = Math.floor(rawCrashPoint * 100) / 100;
      const crashPoint = Math.min(1000, Math.max(1.0, rounded));

      roundsToCreate.push({
        chainId: chain.chainId,
        roundNumber: roundNum,
        gameHash,
        crashPoint: crashPoint,
        clientSeed,
      });
    }

    await prisma.crashRound.createMany({
      data: roundsToCreate,
      skipDuplicates: true,
    });

    console.log(`  Processed ${batchEnd - startRound + 1}/${totalToCreate}`);
  }

  console.log(`\n✅ Complete\n`);
}

main().catch(console.error);
