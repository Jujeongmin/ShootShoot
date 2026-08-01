import { describe, it, expect } from 'vitest';
import { weaponButtonState } from '../game/src/ui/weaponButtonState';

// weaponButtonState가 실제로 받는 매개변수 타입을 그대로 뽑아 쓴다. 이러면
// weaponButtonState.ts의 OwnedWeapon 필드가 바뀔 때 이 테스트도 같이 깨진다.
type FakeWeapon = Parameters<typeof weaponButtonState>[0];

function weapon(overrides: Partial<FakeWeapon>): FakeWeapon {
  return { price: 100, owned: false, equipped: false, ...overrides };
}

describe('weaponButtonState', () => {
  it('reports equipped before owned, since an equipped weapon is also owned', () => {
    expect(weaponButtonState(weapon({ owned: true, equipped: true }), 99999)).toBe('equipped');
  });

  it('offers equipping for an owned weapon that is not the active one', () => {
    expect(weaponButtonState(weapon({ owned: true }), 0)).toBe('equip');
  });

  it('offers buying when the player can afford an unowned weapon', () => {
    expect(weaponButtonState(weapon({ price: 100 }), 100)).toBe('buy');
    expect(weaponButtonState(weapon({ price: 100 }), 250)).toBe('buy');
  });

  it('reports insufficient gold one coin short of the price', () => {
    expect(weaponButtonState(weapon({ price: 100 }), 99)).toBe('insufficient');
    expect(weaponButtonState(weapon({ price: 100 }), 0)).toBe('insufficient');
  });
});
