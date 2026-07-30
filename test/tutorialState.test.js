import { describe, it, expect } from 'vitest';
import { createTutorialState } from '../game/src/gameplay/tutorialState.js';

function advanceToDone(tutorial) {
  tutorial.handle('aimStarted');
  tutorial.handle('shotFired');
  tutorial.handle('reloadFinished');
  tutorial.handle('roundCleared');
}

describe('createTutorialState', () => {
  it('starts on the aim step', () => {
    const tutorial = createTutorialState();
    expect(tutorial.current()).toBe('aim');
    expect(tutorial.isDone()).toBe(false);
  });

  it('advances from aim to fire when the aim starts', () => {
    const tutorial = createTutorialState();
    tutorial.handle('aimStarted');
    expect(tutorial.current()).toBe('fire');
  });

  it('walks all four steps in order and finishes', () => {
    const tutorial = createTutorialState();
    tutorial.handle('aimStarted');
    expect(tutorial.current()).toBe('fire');
    tutorial.handle('shotFired');
    expect(tutorial.current()).toBe('reload');
    tutorial.handle('reloadFinished');
    expect(tutorial.current()).toBe('clear');
    tutorial.handle('roundCleared');
    expect(tutorial.current()).toBe('done');
    expect(tutorial.isDone()).toBe(true);
  });

  it('ignores an event the current step is not waiting for', () => {
    const tutorial = createTutorialState();
    tutorial.handle('roundCleared');
    tutorial.handle('reloadFinished');
    tutorial.handle('shotFired');
    expect(tutorial.current()).toBe('aim');
  });

  it('stays on the same step when its own event repeats', () => {
    const tutorial = createTutorialState();
    tutorial.handle('aimStarted');
    tutorial.handle('aimStarted');
    expect(tutorial.current()).toBe('fire');
  });

  it('does nothing once it is done', () => {
    const tutorial = createTutorialState();
    advanceToDone(tutorial);
    tutorial.handle('aimStarted');
    tutorial.handle('roundCleared');
    expect(tutorial.current()).toBe('done');
    expect(tutorial.isDone()).toBe(true);
  });

  it('reset() returns to the first step', () => {
    const tutorial = createTutorialState();
    advanceToDone(tutorial);
    tutorial.reset();
    expect(tutorial.current()).toBe('aim');
    expect(tutorial.isDone()).toBe(false);
  });

  it('ignores an unknown event name', () => {
    const tutorial = createTutorialState();
    tutorial.handle('somethingElse');
    expect(tutorial.current()).toBe('aim');
  });

  it('finish() jumps a fresh machine straight to done', () => {
    const tutorial = createTutorialState();
    tutorial.finish();
    expect(tutorial.current()).toBe('done');
    expect(tutorial.isDone()).toBe(true);
  });

  it('finish() from a mid-way step also lands on done', () => {
    const tutorial = createTutorialState();
    tutorial.handle('aimStarted');
    tutorial.handle('shotFired');
    expect(tutorial.current()).toBe('reload');
    tutorial.finish();
    expect(tutorial.current()).toBe('done');
    expect(tutorial.isDone()).toBe(true);
  });

  it('reset() after finish() returns to the first step', () => {
    const tutorial = createTutorialState();
    tutorial.finish();
    tutorial.reset();
    expect(tutorial.current()).toBe('aim');
    expect(tutorial.isDone()).toBe(false);
  });
});
