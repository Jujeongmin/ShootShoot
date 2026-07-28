// 장착 중인 무기는 보유 중이기도 하다. 순서를 바꾸면 장착 중인 무기에
// '장착하기' 버튼이 뜬다.
export function weaponButtonState(weapon, gold) {
  if (weapon.equipped) return 'equipped';
  if (weapon.owned) return 'equip';
  if (gold >= weapon.price) return 'buy';
  return 'insufficient';
}
