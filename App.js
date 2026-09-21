import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts, BlackHanSans_400Regular } from '@expo-google-fonts/black-han-sans';
import { FOODS, GROUPS, matchesFilter } from './foods';

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

  if (screen === 'spin') return <Spin pool={pool} onBack={() => setScreen('home')} />;
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
          onPress={() => setScreen('spin')}
          accessibilityRole="button"
          style={({ pressed }) => [s.cta, empty && s.ctaOff, pressed && s.pressed]}
        >
          <Text style={[s.ctaText, empty && s.ctaTextOff]}>돌리기</Text>
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
    </SafeAreaView>
  );
}

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
});
