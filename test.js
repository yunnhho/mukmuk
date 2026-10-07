import assert from 'node:assert';
import { FOODS, GROUPS, matchesFilter } from './foods.js';

const 떡볶이 = FOODS.find((f) => f.name === '떡볶이/라볶이');
const 스테이크 = FOODS.find((f) => f.name === '스테이크');

// 필터 없음 = 전체 통과
assert(FOODS.every((f) => matchesFilter(f, {})));
// 그룹 하나
assert(matchesFilter(떡볶이, { 종류: ['분식'] }));
assert(!matchesFilter(스테이크, { 종류: ['분식'] }));
// 같은 그룹 여러 개 = OR
assert(matchesFilter(스테이크, { 종류: ['분식', '양식'] }));
// 다른 그룹끼리 = AND
assert(matchesFilter(떡볶이, { 종류: ['분식'], 맛: ['매콤'] }));
assert(!matchesFilter(떡볶이, { 종류: ['분식'], 맛: ['순한'] }));
// 모든 음식의 태그가 필터 목록 안에 있어야 함 (오타 방지)
for (const f of FOODS) {
  assert(GROUPS.종류.includes(f.종류), f.name + ' 종류=' + f.종류);
  assert(GROUPS.맛.includes(f.맛), f.name + ' 맛=' + f.맛);
  assert(GROUPS.형태.includes(f.형태), f.name + ' 형태=' + f.형태);
}
console.log('ok', FOODS.length, '메뉴');

// 미니 게임
import { sample, makeLadder, trace, sliceAt } from './games.js';
const six = sample(FOODS, 6);
assert(six.length === 6 && new Set(six).size === 6);
// 사다리: 출발점마다 도착점이 다 달라야 함 (1:1)
for (let n = 2; n <= 6; n++) {
  const g = makeLadder(n, 8);
  const ends = [...Array(n).keys()].map((c) => trace(g, c).end);
  assert(new Set(ends).size === n, '사다리 겹침 ' + ends);
}
assert(trace([[true, false]], 0).end === 1);
assert(trace([[true, false]], 1).end === 0);
// 다트: 12시 바로 오른쪽 = 0번, 3시 조금 아래 = 1번, 12시 바로 왼쪽 = 마지막
assert(sliceAt(1, -10, 0, 4) === 0);
assert(sliceAt(10, 1, 0, 4) === 1);
assert(sliceAt(-1, -10, 0, 4) === 3);
// 판이 90도 돌면 3시 방향에 0번 칸이 와 있음
assert(sliceAt(10, -1, 90, 4) === 3 && sliceAt(10, 1, 90, 4) === 0);
console.log('ok games');
