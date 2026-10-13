import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Easing, Linking, PanResponder, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts, BlackHanSans_400Regular } from '@expo-google-fonts/black-han-sans';
import { FOODS, GROUPS, matchesFilter } from './foods';
import { makeLadder, sample, sliceAt, trace } from './games';

// 분식집 메뉴판: 단무지 노랑 바탕, 짜장 먹색 글씨, 고추장 빨강은 '돌리기'와 결과에만
const C = {
  bg: '#FFD43B', paper: '#FFF9E6', ink: '#2A1E12', muted: '#6B5724', red: '#D6331F',
};
const SIGN = 'BlackHanSans_400Regular'; // 간판 글씨. 제목·메뉴 이름·버튼에만
const ROW = 104;
const PEEK = 0.35; // 릴 위아래로 보이는 이웃 메뉴 비율
const TICK = 80;
const PREVIEW = 12; // 홈에서 접힌 상태로 보여줄 메뉴 수
const KEY = 'mukmuk:custom';
const GAME_MAX = 6; // 미니 게임에 나가는 최대 메뉴 수 (경주 레인·사다리 줄·룰렛 칸)
// 한글이 단어 중간에서 끊기지 않게: iOS는 prop, 웹은 wordBreak 스타일. 안드로이드는 문구에 \n을 직접 넣음
const KO = { lineBreakStrategyIOS: 'hangul-word' };

const Chip = ({ label, on, onPress, a11y }) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityState={{ selected: !!on }}
    accessibilityLabel={a11y}
    style={({ pressed }) => [s.chip, on && s.chipOn, pressed && s.pressed]}
  >
    <Text style={[s.chipText, on && s.chipTextOn]}>{label}</Text>
  </Pressable>
);

const Back = ({ onPress }) => (
  <Pressable onPress={onPress} style={s.back} hitSlop={12} accessibilityRole="button" accessibilityLabel="뒤로">
    <Text style={s.backText}>←</Text>
  </Pressable>
);

// 이름이 'A/B'면 A로 검색. 카카오맵 앱이 있으면 앱으로, 없으면 웹으로 열림
const MapLink = ({ name }) => (
  <Pressable
    onPress={() => Linking.openURL(`https://map.kakao.com/link/search/${encodeURIComponent(name.split('/')[0])}`).catch(() => {})}
    style={[s.link, { alignSelf: 'center' }]}
    accessibilityRole="link"
    accessibilityLabel={`카카오맵에서 ${name} 근처 식당 찾기`}
  >
    <Text style={s.linkText}>📍 카카오맵에서 찾기</Text>
  </Pressable>
);

export default function App() {
  const [fontsLoaded, fontError] = useFonts({ BlackHanSans_400Regular });
  if (!fontsLoaded && !fontError) return null;
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Main />
    </SafeAreaProvider>
  );
}

function Main() {
  const [screen, setScreen] = useState('home');
  const [picked, setPicked] = useState({});
  const [custom, setCustom] = useState([]);
  const [showAll, setShowAll] = useState(false);
  const loaded = useRef(false);

  // 불러오기 전에 추가한 메뉴는 저장본 뒤에 합침. 깨진 저장본은 빈 목록으로 취급
  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => {
        let stored = [];
        try { stored = JSON.parse(v) ?? []; } catch {}
        loaded.current = true;
        setCustom((c) => [...stored, ...c]);
      })
      .catch(() => {});
  }, []);

  // 불러오기 전에는 저장하지 않음 (저장본을 덮어쓰지 않도록)
  useEffect(() => {
    if (loaded.current) AsyncStorage.setItem(KEY, JSON.stringify(custom)).catch(() => {});
  }, [custom]);

  const addFood = (food) => setCustom((c) => [...c, food]);
  const removeFood = (food) => setCustom((c) => c.filter((x) => x !== food));

  // 내가 추가한 메뉴를 앞에 둬서 접힌 목록에서도 바로 보이게
  const all = useMemo(() => [...custom, ...FOODS], [custom]);
  const pool = useMemo(() => all.filter((f) => matchesFilter(f, picked)), [all, picked]);

  const toggle = (g, opt) =>
    setPicked((p) => {
      const on = p[g] || [];
      return { ...p, [g]: on.includes(opt) ? on.filter((x) => x !== opt) : [...on, opt] };
    });

  if (screen === 'games') {
    return <Games count={pool.length} onPick={setScreen} onBack={() => setScreen('home')} />;
  }
  if (screen === 'spin') return <Spin pool={pool} onBack={() => setScreen('games')} />;
  if (PLAY[screen]) return <Game kind={screen} pool={pool} onBack={() => setScreen('games')} />;
  if (screen === 'add') {
    return (
      <AddFood
        custom={custom}
        onRemove={removeFood}
        onBack={() => setScreen('home')}
        onSave={(f) => { addFood(f); setScreen('home'); }}
      />
    );
  }

  const empty = pool.length === 0;

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={s.pad}>
        <Text style={s.brand}>먹먹</Text>
        <Text style={s.h1} accessibilityRole="header">오늘 뭐 먹지</Text>
        <Text {...KO} style={s.sub}>고른 조건 안에서 뽑아요.{'\n'}아무것도 안 고르면 전체에서 뽑아요.</Text>

        {Object.entries(GROUPS).map(([g, opts]) => (
          <View key={g} style={s.group}>
            <View style={s.groupHead}>
              <Text style={s.groupTitle}>{g}</Text>
              {(picked[g] || []).length > 0 && (
                <Pressable onPress={() => setPicked((p) => ({ ...p, [g]: [] }))} hitSlop={10} accessibilityRole="button">
                  <Text style={s.clear}>초기화</Text>
                </Pressable>
              )}
            </View>
            <View style={s.chips}>
              {opts.map((o) => (
                <Chip key={o} label={o} on={(picked[g] || []).includes(o)} onPress={() => toggle(g, o)} />
              ))}
            </View>
          </View>
        ))}

        <View style={s.poolBox}>
          <Text style={s.groupTitle}>후보 메뉴</Text>
          {empty ? (
            <Text {...KO} style={s.note}>고른 조건을 하나씩 빼 보세요.</Text>
          ) : (
            <View style={s.chips}>
              {(showAll ? pool : pool.slice(0, PREVIEW)).map((f, i) => (
                <Text key={i} style={s.item}>{f.emoji} {f.name}</Text>
              ))}
            </View>
          )}
          {pool.length > PREVIEW && (
            <Pressable onPress={() => setShowAll((v) => !v)} style={s.link} accessibilityRole="button">
              <Text style={s.linkText}>{showAll ? '접기' : `${pool.length - PREVIEW}개 더 보기`}</Text>
            </Pressable>
          )}
        </View>

        <Pressable onPress={() => setScreen('add')} style={s.link} accessibilityRole="button">
          <Text style={s.linkText}>
            + 메뉴 직접 추가{custom.length > 0 ? `  (추가한 메뉴 ${custom.length}개)` : ''}
          </Text>
        </Pressable>
      </ScrollView>

      {/* 돌리기는 항상 엄지 닿는 곳에 */}
      <SafeAreaView edges={['bottom']} style={s.dock}>
        <Text style={[s.count, empty && s.countWarn]}>
          {empty ? '조건에 맞는 메뉴가 없어요' : `${pool.length}개 메뉴 중에서 뽑아요`}
        </Text>
        <Pressable
          disabled={empty}
          onPress={() => setScreen('games')}
          accessibilityRole="button"
          style={({ pressed }) => [s.cta, empty && s.ctaOff, pressed && s.pressed]}
        >
          <Text style={[s.ctaText, empty && s.ctaTextOff]}>게임으로 뽑기</Text>
        </Pressable>
      </SafeAreaView>
    </SafeAreaView>
  );
}

function Spin({ pool, onBack }) {
  const n = pool.length;
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * Math.max(n, 1)));
  const [running, setRunning] = useState(true);
  const y = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!running || n === 0) return;
    const t = setInterval(() => {
      setIdx((v) => (v + 1) % n);
      y.setValue(ROW);
      Animated.timing(y, { toValue: 0, duration: TICK, useNativeDriver: true }).start();
    }, TICK);
    return () => clearInterval(t);
  }, [running, n]);

  const stop = () => {
    y.stopAnimation();
    y.setValue(0);
    setRunning(false);
  };
  const retry = () => {
    if (n > 1) setIdx(Math.floor(Math.random() * n));
    setRunning(true);
  };

  const at = (o) => pool[(((idx + o) % n) + n) % n];

  return (
    <SafeAreaView style={s.safe}>
      <Back onPress={onBack} />

      {n === 0 ? (
        <View style={s.center}>
          <Text {...KO} style={s.sub}>조건에 맞는 메뉴가 없어요.{'\n'}뒤로 가서 조건을 줄여 보세요.</Text>
        </View>
      ) : (
        <Pressable
          style={s.center}
          onPressIn={stop}
          onPressOut={retry}
          accessibilityRole="button"
          accessibilityLabel={running ? '꾹 누르고 있으면 멈춰요' : `오늘은 ${at(0).name}`}
        >
          <Text style={[s.verdict, running && s.hidden]}>오늘은 이거</Text>
          <View style={[s.reel, !running && s.reelStopped]}>
            {/* 5칸을 그려야 슬라이드 중에도 위아래 이웃 칸이 비지 않음 */}
            <Animated.View style={{ marginTop: -2 * ROW + ROW * PEEK, transform: [{ translateY: y }] }}>
              {[-2, -1, 0, 1, 2].map((o) => {
                const f = at(o);
                const mid = o === 0;
                return (
                  <View key={o} style={s.slot}>
                    <Text style={mid ? s.emoji : s.emojiSide}>{f.emoji}</Text>
                    <Text style={mid ? s.name : s.nameSide} numberOfLines={1} adjustsFontSizeToFit>{f.name}</Text>
                  </View>
                );
              })}
            </Animated.View>
            <View pointerEvents="none" style={[s.window, !running && s.windowStopped]} />
          </View>
          <Text style={s.hint}>{running ? '꾹 누르고 있으면 멈춰요' : '손을 떼면 다시 돌아가요'}</Text>
        </Pressable>
      )}
      {n > 0 && <MapLink name={at(0).name} />}
    </SafeAreaView>
  );
}

const GAMES = [
  { key: 'spin', emoji: '🎰', name: '슬롯', desc: '꾹 눌러서 멈추기 · 후보 전체' },
  { key: 'race', emoji: '🏁', name: '경주', desc: '1등으로 들어온 메뉴 당첨' },
  { key: 'ladder', emoji: '🪜', name: '사다리 타기', desc: '출발점을 골라 내려가기' },
  { key: 'dart', emoji: '🎯', name: '다트 룰렛', desc: '돌아가는 판에 위로 휙 던지기' },
];

function Games({ count, onPick, onBack }) {
  return (
    <SafeAreaView style={s.safe}>
      <Back onPress={onBack} />
      <ScrollView contentContainerStyle={s.pad}>
        <Text style={s.h1} accessibilityRole="header">어떻게 뽑을까</Text>
        <Text {...KO} style={s.sub}>
          {count > GAME_MAX
            ? `후보 ${count}개 중 ${GAME_MAX}개가\n무작위로 게임에 나가요.`
            : `후보 ${count}개로 게임해요.`}
        </Text>
        {GAMES.map((g) => (
          <Pressable
            key={g.key}
            onPress={() => onPick(g.key)}
            accessibilityRole="button"
            style={({ pressed }) => [s.gameBtn, pressed && s.pressed]}
          >
            <Text style={s.gameEmoji}>{g.emoji}</Text>
            <View style={s.flex}>
              <Text style={s.gameName}>{g.name}</Text>
              <Text style={s.gameDesc}>{g.desc}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

// 참가 메뉴는 들어올 때 한 번 뽑고, '다시 하기'는 같은 메뉴로 판만 새로
function Game({ kind, pool, onBack }) {
  const [items] = useState(() => sample(pool, GAME_MAX));
  const [round, setRound] = useState(0);
  const [won, setWon] = useState(null);
  const Play = PLAY[kind];
  return (
    <SafeAreaView style={s.safe}>
      <Back onPress={onBack} />
      {won ? (
        <View style={s.center}>
          <Text style={s.verdict}>오늘은 이거</Text>
          <View style={s.winCard} accessible accessibilityLabel={`오늘은 ${won.name}`}>
            <Text style={s.emoji}>{won.emoji}</Text>
            <Text style={s.name} numberOfLines={1} adjustsFontSizeToFit>{won.name}</Text>
          </View>
          <MapLink name={won.name} />
          <Pressable
            onPress={() => { setWon(null); setRound((r) => r + 1); }}
            accessibilityRole="button"
            style={({ pressed }) => [s.cta, s.wide, pressed && s.pressed]}
          >
            <Text style={s.ctaText}>다시 하기</Text>
          </Pressable>
          <Pressable onPress={onBack} style={[s.link, { alignSelf: 'center' }]} accessibilityRole="button">
            <Text style={s.linkText}>다른 게임</Text>
          </Pressable>
        </View>
      ) : (
        <Play key={round} items={items} onWin={setWon} />
      )}
    </SafeAreaView>
  );
}

const GameHead = ({ title, hint }) => (
  <View style={s.gameHead}>
    <Text style={s.groupTitle} accessibilityRole="header">{title}</Text>
    <Text {...KO} style={s.note}>{hint}</Text>
  </View>
);

const RUNNER = 36; // 경주 이모지 폭. 결승선을 넘지 않게 이만큼 당겨서 그림

function Race({ items, onWin }) {
  const [pos, setPos] = useState(() => items.map(() => 0));
  const [go, setGo] = useState(false);
  const [first, setFirst] = useState(-1);

  // 메뉴마다 속도가 계속 조금씩 바뀌어서 역전이 일어남
  useEffect(() => {
    if (!go) return;
    const v = items.map(() => 0.15 + Math.random() * 0.1);
    let p = items.map(() => 0);
    let last = Date.now();
    let id;
    let done;
    const tick = () => {
      const now = Date.now();
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      p = p.map((x, i) => {
        v[i] = Math.min(0.35, Math.max(0.08, v[i] + (Math.random() - 0.5) * 4 * dt));
        return x + v[i] * dt;
      });
      setPos(p);
      const best = p.indexOf(Math.max(...p));
      if (p[best] >= 1) {
        setFirst(best);
        done = setTimeout(() => onWin(items[best]), 1000);
        return;
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(id); clearTimeout(done); };
  }, [go]);

  return (
    <ScrollView contentContainerStyle={s.pad}>
      <GameHead title="🏁 경주" hint="1등으로 결승선에 들어온 메뉴가 당첨!" />
      {items.map((f, i) => {
        const x = Math.min(pos[i], 1);
        return (
          <View key={i} style={s.lane}>
            <Text style={[s.laneName, first === i && s.winText]} numberOfLines={1}>{f.name}</Text>
            <View style={[s.track, first === i && s.trackWin]}>
              <Text style={[s.runner, { left: `${x * 100}%`, marginLeft: -x * RUNNER }]}>{f.emoji}</Text>
            </View>
          </View>
        );
      })}
      <Pressable
        disabled={go}
        onPress={() => setGo(true)}
        accessibilityRole="button"
        style={({ pressed }) => [s.cta, s.gap, go && s.ctaOff, pressed && s.pressed]}
      >
        <Text style={[s.ctaText, go && s.ctaTextOff]}>{go ? '달리는 중…' : '출발!'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const RUNGS = 8;
const RUNG_H = 34;

// 사다리는 세로/가로 선분뿐이라 View 사각형으로 그림
const Seg = ({ a, b, color, w }) => (
  <View
    pointerEvents="none"
    style={{
      position: 'absolute', backgroundColor: color, borderRadius: w / 2,
      left: Math.min(a.x, b.x) - w / 2, top: Math.min(a.y, b.y) - w / 2,
      width: Math.abs(a.x - b.x) + w, height: Math.abs(a.y - b.y) + w,
    }}
  />
);

function Ladder({ items, onWin }) {
  const n = items.length;
  const { width } = useWindowDimensions();
  const colW = Math.min(width - 48, 420) / n;
  const [grid] = useState(() => makeLadder(n, RUNGS));
  const [path, setPath] = useState(null);
  const [shown, setShown] = useState(0);
  const pt = ([c, l]) => ({ x: (c + 0.5) * colW, y: l * RUNG_H });
  const arrived = path && shown >= path.points.length - 1;

  // 경로를 한 마디씩 그려 내려감
  useEffect(() => {
    if (!path) return;
    const t = arrived
      ? setTimeout(() => onWin(items[path.end]), 900)
      : setTimeout(() => setShown((k) => k + 1), 160);
    return () => clearTimeout(t);
  }, [path, shown]);

  return (
    <ScrollView contentContainerStyle={s.pad}>
      <GameHead title="🪜 사다리 타기" hint="출발점(▼)을 하나 고르세요. 가로대는 고른 뒤에 보여요." />
      <View style={[s.ladder, { width: colW * n }]}>
        <View style={s.row0}>
          {items.map((f, c) => (
            <Pressable
              key={c}
              disabled={!!path}
              onPress={() => setPath(trace(grid, c))}
              accessibilityRole="button"
              accessibilityLabel={`${c + 1}번 출발`}
              style={({ pressed }) => [s.ladderTop, { width: colW }, pressed && s.pressed]}
            >
              <Text style={[s.ladderArrow, path?.points[0][0] === c && s.winText]}>▼</Text>
            </Pressable>
          ))}
        </View>
        <View style={{ height: (RUNGS + 1) * RUNG_H }}>
          {items.map((_, c) => <Seg key={c} a={pt([c, 0])} b={pt([c, RUNGS + 1])} color={C.ink} w={3} />)}
          {path && grid.flatMap((row, r) => row.map((on, c) => on && (
            <Seg key={`${r},${c}`} a={pt([c, r + 1])} b={pt([c + 1, r + 1])} color={C.ink} w={3} />
          )))}
          {path && path.points.slice(1, shown + 1).map((p, i) => (
            <Seg key={i} a={pt(path.points[i])} b={pt(p)} color={C.red} w={6} />
          ))}
        </View>
        <View style={s.row0}>
          {items.map((f, c) => {
            const hit = arrived && path.end === c;
            return (
              <View key={c} style={[s.ladderEnd, { width: colW }, hit && s.ladderHit]}>
                <Text style={s.ladderEmoji}>{f.emoji}</Text>
                <Text style={[s.ladderName, hit && s.winText]} numberOfLines={2}>{f.name.split('/')[0]}</Text>
              </View>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

const WHEEL_SPEED = 0.12; // 도/ms. 한 바퀴 3초
const DART_W = 56; // 잡는 영역 폭. 다트 끝(맨 위 가운데)이 맞는 점
const DART_H = 80;
// ponytail: 던지는 세기 보정값(손가락 속도 px/ms → 날아가는 거리 px). 기기마다 손맛이 다르면 이 숫자만 조절
const POWER = 220;

function Dart({ items, onWin }) {
  const n = items.length;
  const [geo, setGeo] = useState(null);
  const [msg, setMsg] = useState('다트를 잡고 아래에서 위로 휙 던져요');
  const g = useRef(null); // PanResponder는 처음 한 번 만들어지니 최신 값은 ref로
  const rot = useRef(new Animated.Value(0)).current;
  const angle = useRef(0);
  const spinning = useRef(true);
  const busy = useRef(false);
  const pos = useRef(new Animated.ValueXY()).current;
  const tilt = useRef(new Animated.Value(0)).current; // 다트가 향하는 각도(도)
  const size = useRef(new Animated.Value(1)).current; // 멀어질수록 작게
  const fade = useRef(new Animated.Value(1)).current;
  const timer = useRef();

  // 판 각도를 직접 들고 있어야 꽂힌 순간의 칸을 정확히 알 수 있음
  useEffect(() => {
    let last = Date.now();
    let id;
    const tick = () => {
      const now = Date.now();
      if (spinning.current) {
        angle.current = (angle.current + (now - last) * WHEEL_SPEED) % 360;
        rot.setValue(angle.current);
      }
      last = now;
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(id); clearTimeout(timer.current); };
  }, []);

  const home = () => Animated.spring(pos, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
  const reset = () => {
    pos.setValue({ x: 0, y: 0 }); tilt.setValue(0); size.setValue(1); fade.setValue(1);
    busy.current = false;
  };
  const anim = (v, toValue, duration, easing) => Animated.timing(v, { toValue, duration, easing, useNativeDriver: false });

  // 속도는 손 떼기 직전 80ms 이동량으로 직접 계산 (웹의 vx/vy는 너무 작게 나옴)
  const trail = useRef([]);
  const fling = (d) => {
    const now = Date.now();
    const old = trail.current.find((p) => now - p.t <= 80) ?? { x: 0, y: 0, t: now - 1000 };
    const dt = Math.max(now - old.t, 16);
    const vx = (d.dx - old.x) / dt;
    const vy = (d.dy - old.y) / dt;
    const speed = Math.hypot(vx, vy);
    if (!g.current || vy > -0.3) return home(); // 위로 던진 게 아니면 제자리로
    busy.current = true;
    const dist = speed * POWER;
    const tx = d.dx + (vx / speed) * dist;
    const ty = d.dy + (vy / speed) * dist;
    const a = (Math.atan2(vx, -vy) * 180) / Math.PI; // 날아가는 방향으로 다트 끝을 돌림
    Animated.parallel([
      anim(pos, { x: tx, y: ty }, 350, Easing.out(Easing.quad)),
      anim(tilt, a, 120),
      anim(size, 0.6, 350),
    ]).start(() => {
      const { cx, cy, ox, oy, R } = g.current;
      const dx = ox + tx - cx;
      const dy = oy + ty - cy;
      if (Math.hypot(dx, dy) > R) {
        setMsg('빗나갔어요! 다시 던져요');
        Animated.parallel([
          anim(pos.y, ty + 120, 400, Easing.in(Easing.quad)),
          anim(tilt, a + 160, 400),
          anim(fade, 0, 400),
        ]).start(() => { timer.current = setTimeout(reset, 200); });
        return;
      }
      // 날아가는 동안에도 판은 돌았으니, 꽂히는 순간의 각도로 판정
      spinning.current = false;
      const f = items[sliceAt(dx, dy, angle.current, n)];
      setMsg(`${f.emoji} ${f.name} 명중!`);
      // 꽂히는 액션: 판에 박히면서 살짝 작아지고, 꼬리가 부르르 떨다 멈춤
      Animated.sequence([
        anim(size, 0.5, 60),
        anim(tilt, a + 14, 70),
        anim(tilt, a - 9, 70),
        anim(tilt, a + 5, 70),
        anim(tilt, a, 70),
      ]).start();
      timer.current = setTimeout(() => onWin(f), 1400);
    });
  };

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => !busy.current,
    onMoveShouldSetPanResponder: () => !busy.current,
    onPanResponderGrant: () => { trail.current = []; },
    onPanResponderMove: (_, d) => {
      pos.setValue({ x: d.dx, y: d.dy });
      trail.current = [...trail.current.slice(-9), { x: d.dx, y: d.dy, t: Date.now() }];
    },
    onPanResponderRelease: (_, d) => fling(d),
    onPanResponderTerminate: home,
  })).current;

  const onLayout = (e) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    const R = Math.max(60, Math.min(w - 32, h - 200, 340) / 2);
    g.current = { R, cx: w / 2, cy: 8 + R, ox: w / 2, oy: h - 16 - DART_H };
    setGeo(g.current);
  };

  const step = 360 / n;
  const rotate = rot.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] });

  return (
    <View style={s.flex}>
      <View style={s.padX}>
        <GameHead title="🎯 다트 룰렛" hint={msg} />
      </View>
      <View style={s.flex} onLayout={onLayout}>
        {geo && (
          <>
            <Animated.View
              pointerEvents="none"
              style={[s.wheel, {
                width: geo.R * 2, height: geo.R * 2, borderRadius: geo.R,
                left: geo.cx - geo.R, top: geo.cy - geo.R, transform: [{ rotate }],
              }]}
            >
              {/* 테두리 4px 안쪽이 기준이라 중심은 R-4 */}
              {n > 1 && items.map((_, i) => (
                <View key={i} style={[StyleSheet.absoluteFill, { transform: [{ rotate: `${i * step}deg` }] }]}>
                  <View style={[s.spoke, { left: geo.R - 5.5, height: geo.R - 4 }]} />
                </View>
              ))}
              {items.map((f, i) => (
                <View key={i} style={[StyleSheet.absoluteFill, s.wheelLabel, { transform: [{ rotate: `${(i + 0.5) * step}deg` }] }]}>
                  <Text style={s.wheelEmoji}>{f.emoji}</Text>
                  <Text style={[s.wheelName, { maxWidth: Math.min(geo.R, (Math.PI * geo.R * 1.1) / n) }]} numberOfLines={2}>
                    {f.name.split('/')[0]}
                  </Text>
                </View>
              ))}
              <View style={[s.hub, { left: geo.R - 14, top: geo.R - 14 }]} />
            </Animated.View>
            <Animated.View
              {...pan.panHandlers}
              accessibilityLabel="다트. 위로 끌어서 던지기"
              style={[s.dart, {
                left: geo.ox - DART_W / 2, top: geo.oy, opacity: fade,
                transform: [
                  ...pos.getTranslateTransform(),
                  { rotate: tilt.interpolate({ inputRange: [-360, 360], outputRange: ['-360deg', '360deg'] }) },
                  { scale: size },
                ],
              }]}
            >
              <View style={s.dartTip} />
              <View style={s.dartBarrel} />
              <View style={s.dartShaft} />
              <View style={s.dartFlight} />
            </Animated.View>
          </>
        )}
      </View>
    </View>
  );
}

const PLAY = { race: Race, ladder: Ladder, dart: Dart };

function AddFood({ custom, onRemove, onBack, onSave }) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🍽️');
  const [tag, setTag] = useState({ 종류: GROUPS.종류[0], 맛: GROUPS.맛[0], 형태: GROUPS.형태[0] });

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave({ name: trimmed, emoji: emoji.trim() || '🍽️', ...tag });
  };

  return (
    <SafeAreaView style={s.safe}>
      <Back onPress={onBack} />
      <ScrollView contentContainerStyle={s.pad} keyboardShouldPersistTaps="handled">
        <Text style={s.h1} accessibilityRole="header">메뉴 추가</Text>
        <Text {...KO} style={s.sub}>비슷한 메뉴는 한 줄로 묶어 주세요.{'\n'}예: 짜장면/짬뽕</Text>

        <View style={s.row}>
          <TextInput
            style={[s.input, s.inputEmoji]}
            value={emoji}
            onChangeText={setEmoji}
            textAlign="center"
            accessibilityLabel="이모지"
          />
          <TextInput
            style={[s.input, s.inputName]}
            value={name}
            onChangeText={setName}
            placeholder="메뉴 이름"
            placeholderTextColor={C.muted}
            returnKeyType="done"
            onSubmitEditing={save}
            accessibilityLabel="메뉴 이름"
          />
        </View>

        {Object.entries(GROUPS).map(([g, opts]) => (
          <View key={g} style={s.group}>
            <Text style={s.groupTitle}>{g}</Text>
            <View style={s.chips}>
              {opts.map((o) => (
                <Chip key={o} label={o} on={tag[g] === o} onPress={() => setTag((t) => ({ ...t, [g]: o }))} />
              ))}
            </View>
          </View>
        ))}

        <Pressable
          onPress={save}
          disabled={!name.trim()}
          accessibilityRole="button"
          style={({ pressed }) => [s.cta, !name.trim() && s.ctaOff, pressed && s.pressed]}
        >
          <Text style={[s.ctaText, !name.trim() && s.ctaTextOff]}>추가</Text>
        </Pressable>

        {custom.length > 0 && (
          <View style={s.mine}>
            <Text style={s.groupTitle}>내가 추가한 메뉴</Text>
            <Text {...KO} style={s.note}>누르면 삭제돼요.</Text>
            <View style={s.chips}>
              {custom.map((f, i) => (
                <Chip key={i} label={`${f.emoji} ${f.name}  ✕`} a11y={`${f.name} 삭제`} onPress={() => onRemove(f)} />
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  pad: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  pressed: { opacity: 0.7 },
  hidden: { opacity: 0 },

  brand: { fontFamily: SIGN, color: C.red, fontSize: 22, marginBottom: 2 },
  h1: { fontFamily: SIGN, color: C.ink, fontSize: 46, lineHeight: 56 },
  sub: { color: C.muted, fontSize: 15, lineHeight: 23, marginTop: 8, marginBottom: 32, wordBreak: 'keep-all' },
  note: { color: C.muted, fontSize: 13, lineHeight: 19, marginTop: -6, marginBottom: 12, wordBreak: 'keep-all' },

  group: { marginBottom: 24 },
  groupHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  groupTitle: { fontFamily: SIGN, color: C.ink, fontSize: 20, marginBottom: 12 },
  clear: { color: C.muted, fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 44, justifyContent: 'center', paddingHorizontal: 16,
    borderRadius: 10, backgroundColor: C.paper, borderWidth: 2, borderColor: C.ink,
  },
  chipOn: { backgroundColor: C.ink },
  chipText: { color: C.ink, fontSize: 15, fontWeight: '700' },
  chipTextOn: { color: C.bg },

  link: { paddingVertical: 12, alignSelf: 'flex-start' },
  poolBox: { marginTop: 8, marginBottom: 12, paddingTop: 20, borderTopWidth: 2, borderTopColor: C.ink },
  item: {
    color: C.ink, fontSize: 14, fontWeight: '600', overflow: 'hidden',
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: C.paper,
  },
  linkText: { color: C.ink, fontSize: 15, fontWeight: '700', textDecorationLine: 'underline' },

  dock: {
    paddingHorizontal: 24, paddingTop: 12, paddingBottom: 12,
    borderTopWidth: 2, borderTopColor: C.ink, backgroundColor: C.bg,
  },
  count: { color: C.ink, fontSize: 14, fontWeight: '600', marginBottom: 10 },
  countWarn: { color: C.red },
  cta: {
    backgroundColor: C.red, borderRadius: 16, borderWidth: 2, borderColor: C.ink,
    minHeight: 60, alignItems: 'center', justifyContent: 'center',
  },
  ctaOff: { backgroundColor: C.paper, borderColor: C.muted },
  ctaTextOff: { color: C.muted },
  ctaText: { fontFamily: SIGN, color: C.paper, fontSize: 24 },

  back: { marginLeft: 12, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backText: { color: C.ink, fontSize: 28, fontWeight: '700' },

  verdict: { fontFamily: SIGN, color: C.red, fontSize: 22, marginBottom: 14 },
  reel: {
    height: ROW * (1 + 2 * PEEK), width: '100%', overflow: 'hidden',
    backgroundColor: C.paper, borderWidth: 3, borderColor: C.ink, borderRadius: 20,
  },
  reelStopped: { borderColor: C.red },
  window: {
    position: 'absolute', left: 0, right: 0, top: ROW * PEEK, height: ROW,
    borderTopWidth: 2, borderBottomWidth: 2, borderColor: C.ink,
  },
  windowStopped: { borderColor: C.red },
  slot: { height: ROW, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  emoji: { fontSize: 40 },
  emojiSide: { fontSize: 30, opacity: 0.3 },
  name: { fontFamily: SIGN, color: C.ink, fontSize: 32, marginTop: 2 },
  nameSide: { fontFamily: SIGN, color: C.ink, fontSize: 22, marginTop: 2, opacity: 0.3 },
  hint: { color: C.ink, fontSize: 16, fontWeight: '700', marginTop: 28 },

  row: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  input: {
    backgroundColor: C.paper, borderWidth: 2, borderColor: C.ink, borderRadius: 12,
    paddingHorizontal: 16, minHeight: 52, color: C.ink, fontSize: 17, fontWeight: '600',
  },
  inputEmoji: { width: 68, fontSize: 24, paddingHorizontal: 0 },
  inputName: { flex: 1, minWidth: 0 },
  mine: { marginTop: 40, paddingTop: 24, borderTopWidth: 2, borderTopColor: C.ink },

  flex: { flex: 1 },
  padX: { paddingHorizontal: 24 },
  gap: { marginTop: 16 },
  wide: { alignSelf: 'stretch', marginTop: 28 },
  winText: { color: C.red },

  gameBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12, padding: 16,
    backgroundColor: C.paper, borderWidth: 2, borderColor: C.ink, borderRadius: 16,
  },
  gameEmoji: { fontSize: 34 },
  gameName: { fontFamily: SIGN, color: C.ink, fontSize: 22 },
  gameDesc: { color: C.muted, fontSize: 14, fontWeight: '600', marginTop: 2 },
  gameHead: { paddingTop: 4, marginBottom: 8 },
  winCard: {
    alignSelf: 'stretch', alignItems: 'center', paddingVertical: 28, paddingHorizontal: 16,
    backgroundColor: C.paper, borderWidth: 3, borderColor: C.red, borderRadius: 20,
  },

  lane: { marginBottom: 10 },
  laneName: { color: C.ink, fontSize: 13, fontWeight: '700', marginBottom: 4 },
  track: {
    height: 46, justifyContent: 'center', backgroundColor: C.paper, borderRadius: 10,
    borderWidth: 2, borderColor: C.ink, borderRightWidth: 6, borderRightColor: C.red,
  },
  trackWin: { borderColor: C.red },
  runner: { position: 'absolute', width: RUNNER, textAlign: 'center', fontSize: 28 },

  ladder: { alignSelf: 'center' },
  row0: { flexDirection: 'row' },
  ladderTop: { alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  ladderArrow: { color: C.ink, fontSize: 22, fontWeight: '700' },
  ladderEnd: { alignItems: 'center', paddingTop: 8, paddingHorizontal: 2, borderRadius: 10 },
  ladderHit: { backgroundColor: C.paper },
  ladderEmoji: { fontSize: 26 },
  ladderName: { color: C.ink, fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: 2 },

  wheel: {
    position: 'absolute', backgroundColor: C.paper, borderWidth: 4, borderColor: C.ink, overflow: 'hidden',
    userSelect: 'none', // 웹에서 공을 끌 때 판 글자가 선택되지 않게
  },
  spoke: { position: 'absolute', top: 0, width: 3, backgroundColor: C.ink },
  wheelLabel: { alignItems: 'center', paddingTop: 12 },
  wheelEmoji: { fontSize: 26 },
  wheelName: { color: C.ink, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  hub: { position: 'absolute', width: 20, height: 20, borderRadius: 10, backgroundColor: C.ink },
  // 다트: 끝(위) → 배럴 → 샤프트 → 날개. 끝을 기준점으로 돌고 작아짐
  dart: { position: 'absolute', width: DART_W, height: DART_H, alignItems: 'center', transformOrigin: '50% 0%' },
  dartTip: {
    width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderBottomWidth: 18,
    borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: C.ink,
  },
  dartBarrel: { width: 12, height: 20, borderRadius: 3, backgroundColor: C.red, borderWidth: 2, borderColor: C.ink },
  dartShaft: { width: 4, height: 18, backgroundColor: C.ink },
  dartFlight: {
    width: 0, height: 0, borderLeftWidth: 16, borderRightWidth: 16, borderBottomWidth: 24,
    borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: C.red,
  },
});
