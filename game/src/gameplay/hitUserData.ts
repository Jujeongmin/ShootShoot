// three의 Object3D.userData는 any라서, 심는 쪽(monkey/obstacles)과 읽는 쪽(game)이
// 서로를 모른 채 문자열 키로 통신한다. 그 계약을 한 곳에 적어 둔다.
export interface HitUserData {
  monkeyId?: string;
  towerIndex?: number;
}
