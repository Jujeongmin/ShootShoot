import { Verse8Ads } from '@verse8/ads';
import { CONFIG } from '../config';

// 반환 타입을 boolean 으로 못박아 둔다. game.ts 의 네 호출부가 이 값을 참/거짓으로
// 보고 바로 보상을 지급하므로, 실제 SDK 결과 중 'rewarded'(끝까지 시청)만 true 로
// 매핑한다 — dismissed/failed 는 전부 false 로 흘러 취소되거나 실패한 광고에 보상이
// 나가지 않는다. SDK 자체가 네트워크/광고 실패에도 resolve 만 하므로 에러 분기는
// 따로 두지 않는다(문서: showRewarded 는 절대 throw 하지 않음).
export function showRewardedAd(): Promise<boolean> {
  return Verse8Ads.showRewarded({ placementId: CONFIG.adReward.placementId }).then(
    (result) => result.status === 'rewarded',
  );
}
