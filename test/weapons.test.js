import { describe, it, expect } from 'vitest';
import { CONFIG } from '../game/src/config.js';

const REQUIRED_FIELDS = [
  'id', 'name', 'model', 'format', 'damage', 'price', 'image', 'scale', 'position', 'rotation',
];

describe('CONFIG.weapons', () => {
  it('has no duplicate ids', () => {
    const ids = CONFIG.weapons.map((weapon) => weapon.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('lists weapons in strictly ascending price order', () => {
    const prices = CONFIG.weapons.map((weapon) => weapon.price);
    for (let i = 1; i < prices.length; i += 1) {
      expect(prices[i]).toBeGreaterThan(prices[i - 1]);
    }
  });

  it('lists weapons in strictly ascending damage order', () => {
    const damages = CONFIG.weapons.map((weapon) => weapon.damage);
    for (let i = 1; i < damages.length; i += 1) {
      expect(damages[i]).toBeGreaterThan(damages[i - 1]);
    }
  });

  it('gives every weapon all the fields the shop and viewmodel read', () => {
    for (const weapon of CONFIG.weapons) {
      for (const field of REQUIRED_FIELDS) {
        expect(weapon, `${weapon.id} is missing ${field}`).toHaveProperty(field);
      }
    }
  });

  it('uses only the two model formats the loader understands', () => {
    for (const weapon of CONFIG.weapons) {
      expect(['glb', 'fbx']).toContain(weapon.format);
    }
  });

  it('scales every weapon by a positive number', () => {
    for (const weapon of CONFIG.weapons) {
      expect(weapon.scale).toBeGreaterThan(0);
    }
  });

  it('starts with the free default weapon', () => {
    expect(CONFIG.weapons[0].id).toBe('basic');
    expect(CONFIG.weapons[0].price).toBe(0);
  });
});
