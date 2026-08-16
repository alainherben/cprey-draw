import assert from 'node:assert/strict';
import test from 'node:test';
import type { Command } from './Command';
import { HistoryManager } from './HistoryManager';

function createValueCommand(label: string, value: number, apply: (value: number) => void): Command {
  let previousValue = 0;

  return {
    label,
    execute() {
      previousValue = currentValue;
      apply(value);
    },
    undo() {
      apply(previousValue);
    },
    redo() {
      apply(value);
    },
  };
}

let currentValue = 0;

test('execute, undo and redo run commands in order', () => {
  const history = new HistoryManager();
  currentValue = 0;

  history.execute(createValueCommand('set 1', 1, (value) => {
    currentValue = value;
  }));

  assert.equal(currentValue, 1);
  assert.equal(history.canUndo(), true);
  assert.equal(history.canRedo(), false);

  history.undo();
  assert.equal(currentValue, 0);
  assert.equal(history.canUndo(), false);
  assert.equal(history.canRedo(), true);

  history.redo();
  assert.equal(currentValue, 1);
  assert.equal(history.canUndo(), true);
  assert.equal(history.canRedo(), false);
});

test('executing a new command after undo clears redo stack', () => {
  const history = new HistoryManager();
  currentValue = 0;
  const apply = (value: number) => {
    currentValue = value;
  };

  history.execute(createValueCommand('set 1', 1, apply));
  history.execute(createValueCommand('set 2', 2, apply));
  history.undo();
  assert.equal(currentValue, 1);
  assert.equal(history.canRedo(), true);

  history.execute(createValueCommand('set 3', 3, apply));
  assert.equal(currentValue, 3);
  assert.equal(history.canRedo(), false);
});
