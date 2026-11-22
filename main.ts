import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const inDir = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function runOne(prog: Buffer, inp: Buffer): [Buffer, number] {
  const stk = new Int32Array(256);
  let sp = 0;
  const calls = new Int32Array(64);
  let cp = 0;
  const mem = new Int32Array(256);
  const out: number[] = [];
  let ip = 0, pc = 0, steps = 0, exit = 0;

  for (;;) {
    if (steps === 1000000) { exit = 10; break; }
    if (pc < 0 || pc >= prog.length) { exit = 9; break; }
    const op = prog[pc];
    const known = op <= 7 || (op >= 0x10 && op <= 0x1e) || (op >= 0x20 && op <= 0x22) ||
      (op >= 0x30 && op <= 0x34) || (op >= 0x40 && op <= 0x41) || (op >= 0x50 && op <= 0x53);
    if (!known) { exit = 5; break; }
    const imm = op === 1 ? 1 : op === 2 ? 4 : op >= 0x30 && op <= 0x33 ? 2 : 0;
    if (pc + imm >= prog.length) { exit = 9; break; }
    steps++;
    const nx = pc + 1 + imm;
    pc = nx;
    let nd = 0, gv = 0;
    if (op === 1 || op === 2 || op === 0x52) gv = 1;
    else if (op === 4) { nd = 1; gv = 2; }
    else if (op === 6) { nd = 2; gv = 3; }
    else if (op === 7) { nd = 3; gv = 3; }
    else if (op === 5) { nd = 2; gv = 2; }
    else if (op === 0x41) nd = 2;
    else if (op >= 0x10 && op <= 0x22) { nd = op === 0x17 || op === 0x1b ? 1 : 2; gv = 1; }
    else if (op === 0x40) { nd = 1; gv = 1; }
    else if (op === 3 || op === 0x50 || op === 0x51 || op === 0x53 || op === 0x31 || op === 0x32) nd = 1;
    if (sp < nd) { exit = 2; break; }
    if (sp - nd + gv > 256) { exit = 3; break; }

    switch (op) {
      case 0x00: return [Buffer.from(out), 0];
      case 0x01: stk[sp++] = (prog[nx - 1] << 24) >> 24; break;
      case 0x02:
        stk[sp++] = prog[nx - 4] | (prog[nx - 3] << 8) | (prog[nx - 2] << 16) | (prog[nx - 1] << 24);
        break;
      case 0x03: sp--; break;
      case 0x04: stk[sp] = stk[sp - 1]; sp++; break;
      case 0x05: { const t = stk[sp - 1]; stk[sp - 1] = stk[sp - 2]; stk[sp - 2] = t; break; }
      case 0x06: stk[sp] = stk[sp - 2]; sp++; break;
      case 0x07: { const t = stk[sp - 3]; stk[sp - 3] = stk[sp - 2]; stk[sp - 2] = stk[sp - 1]; stk[sp - 1] = t; break; }
      case 0x17: stk[sp - 1] = (-stk[sp - 1]) | 0; break;
      case 0x1b: stk[sp - 1] = ~stk[sp - 1]; break;
      case 0x10: case 0x11: case 0x12: case 0x13: case 0x14: case 0x15: case 0x16:
      case 0x18: case 0x19: case 0x1a: case 0x1c: case 0x1d: case 0x1e:
      case 0x20: case 0x21: case 0x22: {
        const b = stk[sp - 1], a = stk[sp - 2];
        let r = 0;
        if (op === 0x10) r = (a + b) | 0;
        else if (op === 0x11) r = (a - b) | 0;
        else if (op === 0x12) r = Math.imul(a, b);
        else if (op === 0x13) {
          if (b === 0) return [Buffer.from(out), 4];
          r = a === -2147483648 && b === -1 ? a : (a / b) | 0;
        } else if (op === 0x14) {
          if (b === 0) return [Buffer.from(out), 4];
          r = b === -1 ? 0 : (a % b) | 0;
        } else if (op === 0x15) {
          if (b === 0) return [Buffer.from(out), 4];
          r = Math.floor((a >>> 0) / (b >>> 0)) | 0;
        } else if (op === 0x16) {
          if (b === 0) return [Buffer.from(out), 4];
          r = ((a >>> 0) % (b >>> 0)) | 0;
        } else if (op === 0x18) r = a & b;
        else if (op === 0x19) r = a | b;
        else if (op === 0x1a) r = a ^ b;
        else if (op === 0x1c) r = a << (b & 31);
        else if (op === 0x1d) r = a >> (b & 31);
        else if (op === 0x1e) r = (a >>> (b & 31)) | 0;
        else if (op === 0x20) r = a === b ? 1 : 0;
        else if (op === 0x21) r = a < b ? 1 : 0;
        else r = (a >>> 0) < (b >>> 0) ? 1 : 0;
        sp -= 2;
        stk[sp++] = r;
        break;
      }
      case 0x30: case 0x31: case 0x32: {
        const rel = ((prog[nx - 2] | (prog[nx - 1] << 8)) << 16) >> 16;
        let take = true;
        if (op !== 0x30) {
          const v = stk[--sp];
          take = op === 0x31 ? v === 0 : v !== 0;
        }
        if (take) pc = nx + rel;
        break;
      }
      case 0x33:
        if (cp === 64) return [Buffer.from(out), 7];
        calls[cp++] = nx;
        pc = prog[nx - 2] | (prog[nx - 1] << 8);
        break;
      case 0x34:
        if (cp === 0) return [Buffer.from(out), 8];
        pc = calls[--cp];
        break;
      case 0x40: {
        const addr = stk[sp - 1];
        if (addr < 0 || addr > 255) return [Buffer.from(out), 6];
        stk[sp - 1] = mem[addr];
        break;
      }
      case 0x41: {
        const addr = stk[sp - 1], v = stk[sp - 2];
        if (addr < 0 || addr > 255) return [Buffer.from(out), 6];
        sp -= 2;
        mem[addr] = v;
        break;
      }
      case 0x50: {
        const s = String(stk[sp - 1]);
        if (out.length + s.length > 65536) return [Buffer.from(out), 11];
        sp--;
        for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i));
        break;
      }
      case 0x51:
        if (out.length + 1 > 65536) return [Buffer.from(out), 11];
        out.push(stk[--sp] & 255);
        break;
      case 0x52: stk[sp++] = ip < inp.length ? inp[ip++] : -1; break;
      case 0x53: return [Buffer.from(out), stk[--sp] & 255];
    }
  }
  return [Buffer.from(out), exit];
}

mkdirSync(outDir, { recursive: true });
for (const e of readdirSync(outDir)) rmSync(join(outDir, e), { recursive: true, force: true });

for (const id of readdirSync(inDir).sort()) {
  let prog: Buffer = Buffer.alloc(0);
  let inp: Buffer = Buffer.alloc(0);
  try { prog = readFileSync(join(inDir, id, 'program.bin')); } catch { /* empty program traps 9 */ }
  try { inp = readFileSync(join(inDir, id, 'input.bin')); } catch { /* no input */ }
  const [bytes, code] = runOne(prog, inp);
  mkdirSync(join(outDir, id), { recursive: true });
  writeFileSync(join(outDir, id, 'stdout.bin'), bytes);
  writeFileSync(join(outDir, id, 'exit.txt'), String(code) + '\n');
}
