import { describe, it, expect } from 'vitest';
import { createDebrisBody, impactImpulse } from '../game/src/gameplay/debris.js';

function fallingBody(y, velocity = { x: 0, y: 0, z: 0 }, spin = { x: 0, y: 0, z: 0 }) {
  return createDebrisBody({
    position: { x: 0, y, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    velocity,
    spin,
    restY: 0,
  });
}

describe('createDebrisBody', () => {
  it('falls under gravity', () => {
    const body = fallingBody(10);
    body.step(0.1);
    expect(body.getPosition().y).toBeLessThan(10);
  });

  it('turns by the angular velocity', () => {
    const body = fallingBody(10, { x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: -1 });
    body.step(0.5);
    expect(body.getRotation().x).toBeCloseTo(1);
    expect(body.getRotation().z).toBeCloseTo(-0.5);
  });

  it('bounces back up after landing', () => {
    const body = fallingBody(0.1, { x: 0, y: -20, z: 0 });
    body.step(0.05);
    expect(body.getPosition().y).toBe(0);
    body.step(0.01);
    expect(body.getPosition().y).toBeGreaterThan(0);
  });

  it('comes to rest after enough bounces', () => {
    const body = fallingBody(3, { x: 4, y: 0, z: 0 });
    for (let i = 0; i < 400; i += 1) body.step(0.016);
    expect(body.isResting()).toBe(true);
    expect(body.getPosition().y).toBe(0);
  });

  it('does not move once it is resting', () => {
    const body = fallingBody(3, { x: 4, y: 0, z: 0 });
    for (let i = 0; i < 400; i += 1) body.step(0.016);
    const settled = body.getPosition();
    for (let i = 0; i < 20; i += 1) body.step(0.016);
    expect(body.getPosition()).toEqual(settled);
  });

  it('never sinks below the rest height even on a very long frame', () => {
    const body = fallingBody(5);
    body.step(2);
    expect(body.getPosition().y).toBe(0);
  });
});

describe('impactImpulse', () => {
  it('pushes the piece away from the impact point', () => {
    const { velocity } = impactImpulse({ x: 2, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 10);
    expect(velocity.x).toBeGreaterThan(0);
  });

  it('throws a nearer piece harder than a far one', () => {
    const near = impactImpulse({ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 10);
    const far = impactImpulse({ x: 5, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 10);
    expect(near.velocity.x).toBeGreaterThan(far.velocity.x);
  });

  it('lifts the piece even when the impact is level with it', () => {
    const { velocity } = impactImpulse({ x: 2, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 10);
    expect(velocity.y).toBeGreaterThan(0);
  });

  it('gives no spin when the impact lands at the height of the piece centre', () => {
    const { spin } = impactImpulse({ x: 2, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 10);
    expect(spin.x).toBeCloseTo(0);
    expect(spin.y).toBeCloseTo(0);
    expect(spin.z).toBeCloseTo(0);
  });

  it('spins the opposite way when hit above the centre rather than below', () => {
    const below = impactImpulse({ x: 2, y: 1, z: 0 }, { x: 0, y: 0, z: 0 }, 10);
    const above = impactImpulse({ x: 2, y: -1, z: 0 }, { x: 0, y: 0, z: 0 }, 10);
    expect(below.spin.z).not.toBeCloseTo(0);
    expect(Math.sign(below.spin.z)).toBe(-Math.sign(above.spin.z));
  });
});
