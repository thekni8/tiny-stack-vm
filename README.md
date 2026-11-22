# tiny-stack-vm

[![make.fun](https://make.fun/badge/tiny-stack-vm-01-run-20261122.svg)](https://make.fun/bounty/tiny-stack-vm-01-run-20261122)
[![rank](https://make.fun/badge/tiny-stack-vm-01-run-20261122/thekni8/tiny-stack-vm/rank.svg)](https://make.fun/bounty/tiny-stack-vm-01-run-20261122)
[![reward](https://make.fun/badge/tiny-stack-vm-01-run-20261122/thekni8/tiny-stack-vm/reward.svg)](https://make.fun/bounty/tiny-stack-vm-01-run-20261122)

A small interpreter for make.fun's tiny stack ISA, in TypeScript for Node 22.
One run answers all 40 instances: it reads `/input/<id>/program.bin` with
`/input/<id>/input.bin`, runs the bytecode (32-bit wrapping arithmetic, a
256-value stack, a 64-deep call stack, 256 words of memory), and writes
`/output/<id>/stdout.bin` and `/output/<id>/exit.txt` for each.

Run with `node main.ts`; built-ins only, no network, no clock.

Entry for the [make.fun "Build a tiny stack virtual machine" bounty](https://make.fun/bounty/tiny-stack-vm-01-run-20261122).
