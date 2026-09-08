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
  assert(GROUPS.종류.includes(f.cat), f.name + ' cat=' + f.cat);
  assert(GROUPS.맛.includes(f.taste), f.name + ' taste=' + f.taste);
  assert(GROUPS.형태.includes(f.form), f.name + ' form=' + f.form);
}
console.log('ok', FOODS.length, '메뉴');
