#!/usr/bin/env node

import { init } from '../lib/init.mjs';
import { mark } from '../lib/mark.mjs';
import { status } from '../lib/status.mjs';

const args = process.argv.slice(2);
const command = args[0];

function usage() {
  console.log(`ot-coverage — AI code understanding coverage tracker

Usage:
  ot-coverage init [dir]                                              Initialize coverage tracking
  ot-coverage mark <file> <startLine>-<endLine> --depth <depth>       Mark lines as read
  ot-coverage status [--by-file]                                      Show coverage stats
  ot-coverage help                                                    Show this help

Depth levels: deep | mapped | ignored`);
}

if (!command || command === 'help' || command === '--help') {
  usage();
  process.exit(command ? 0 : 1);
}

switch (command) {
  case 'init': {
    init(args[1] || undefined);
    break;
  }
  case 'mark': {
    const file = args[1];
    const range = args[2];
    const depthIdx = args.indexOf('--depth');
    const depth = depthIdx !== -1 ? args[depthIdx + 1] : undefined;

    if (!file || !range || !depth) {
      console.error('Usage: ot-coverage mark <file> <startLine>-<endLine> --depth <deep|mapped|ignored>');
      process.exit(1);
    }
    mark(undefined, file, range, depth);
    break;
  }
  case 'status': {
    const byFile = args.includes('--by-file');
    status(undefined, byFile);
    break;
  }
  default:
    console.error(`Unknown command: ${command}`);
    usage();
}
