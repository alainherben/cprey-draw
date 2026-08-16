import assert from 'node:assert/strict';
import test from 'node:test';
import { canDragBusinessObject, canDragViewport } from './interaction';

test('movement lock blocks viewport drag without changing active tool semantics', () => {
  assert.equal(canDragViewport('pan', false), true);
  assert.equal(canDragViewport('pan', true), false);
  assert.equal(canDragViewport('measure', false), false);
  assert.equal(canDragViewport('pan', false, true), false);
});

test('active duct handle pointer down prevents viewport pan', () => {
  assert.equal(canDragViewport('pan', false, true), false);
});

test('empty canvas drag can still move the viewport when movement is allowed', () => {
  assert.equal(canDragViewport('pan', false, false), true);
});

test('movement lock blocks business object and waypoint drag without using object locked state', () => {
  assert.equal(canDragBusinessObject(false, false), true);
  assert.equal(canDragBusinessObject(false, true), false);
  assert.equal(canDragBusinessObject(true, false), false);
  assert.equal(canDragBusinessObject(false, false, true), false);
});
