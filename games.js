// 미니 게임 로직 (화면 없이 테스트할 수 있게 분리)

// 피셔-예이츠로 섞어서 k개
export function sample(arr, k, rand = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, k);
}

// grid[행][c] = c번과 c+1번 세로줄을 잇는 가로대. 같은 행에서 가로대가 붙지 않게
export function makeLadder(n, rows, rand = Math.random) {
  return Array.from({ length: rows }, () => {
    const row = [];
    for (let c = 0; c < n - 1; c++) row.push(!row[c - 1] && rand() < 0.5);
    return row;
  });
}

// 출발 줄 → { end, points: [[줄, 높이]...] }. 높이 0 = 맨 위, r+1 = r번 가로대, rows+1 = 맨 아래
export function trace(grid, start) {
  let c = start;
  const points = [[c, 0]];
  grid.forEach((row, r) => {
    const to = row[c] ? c + 1 : row[c - 1] ? c - 1 : c;
    if (to !== c) {
      points.push([c, r + 1], [to, r + 1]);
      c = to;
    }
  });
  points.push([c, grid.length + 1]);
  return { end: c, points };
}

// 판 중심 기준 (dx, dy)에 꽂힌 다트가 몇 번 칸인지. rot = 판이 시계방향으로 돈 각도(도)
// 칸 i는 12시에서 시계방향으로 i*360/n ~ (i+1)*360/n
export function sliceAt(dx, dy, rot, n) {
  const deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
  const local = (((deg - rot) % 360) + 360) % 360;
  return Math.floor(local / (360 / n)) % n;
}
