// 반환 타입을 boolean 으로 못박아 둔다. game.ts 의 네 호출부가 이 값을 참/거짓으로
// 보고 바로 보상을 지급하므로, 타입을 열어두면(예: Promise<unknown>) 나중에 실제
// 광고 SDK가 { status: 'dismissed' } 같은 객체로 바뀌어도 컴파일러가 못 잡아내고
// 취소된 광고에도 보상이 나간다.
export function showRewardedAd(): Promise<boolean> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(true), 500);
  });
}
