import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FOODS, GROUPS, matchesFilter } from './foods';

const C = { bg: '#0F0E13', card: '#1B1A22', line: '#2B2A35', accent: '#FF5A3C', text: '#F6F3EE', muted: '#8A8797' };
const ROW = 116;
const TICK = 80;
const KEY = 'mukmuk:custom';

const Chip = ({ label, on, onPress }) => (
  <Pressable onPress={onPress} style={[s.chip, on && s.chipOn]}>
    <Text style={[s.chipText, on && s.chipTextOn]}>{label}</Text>
  </Pressable>
);

export default function App() {
  const [screen, setScreen] = useState('home');
  const [picked, setPicked] = useState({});
  const [custom, setCustom] = useState([]);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => v && setCustom(JSON.parse(v)));
  }, []);

  const addFood = (food) => {
    const next = [...custom, food];
    setCustom(next);
    AsyncStorage.setItem(KEY, JSON.stringify(next));
  };

  const all = useMemo(() => [...FOODS, ...custom], [custom]);
  const pool = useMemo(() => all.filter((f) => matchesFilter(f, picked)), [all, picked]);

  const toggle = (g, opt) =>
    setPicked((p) => {
      const on = p[g] || [];
      return { ...p, [g]: on.includes(opt) ? on.filter((x) => x !== opt) : [...on, opt] };
    });

  if (screen === 'spin') return <Spin pool={pool} onBack={() => setScreen('home')} />;
  if (screen === 'add') {
    return <AddFood onBack={() => setScreen('home')} onSave={(f) => { addFood(f); setScreen('home'); }} />;
  }

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={s.pad}>
        <Text style={s.h1}>오늘 뭐 먹지</Text>
        <Text style={s.sub}>필터 고르고 돌리기. 안 고르면 전체.</Text>

        {Object.entries(GROUPS).map(([g, opts]) => (
          <View key={g} style={s.group}>
            <View style={s.groupHead}>
              <Text style={s.groupTitle}>{g}</Text>
              {(picked[g] || []).length > 0 && (
                <Pressable onPress={() => setPicked((p) => ({ ...p, [g]: [] }))}>
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

        <Text style={s.count}>
          {pool.length}개 메뉴{custom.length > 0 ? ` · 내가 추가한 ${custom.length}개 포함` : ''}
        </Text>

        <Pressable
          disabled={pool.length === 0}
          onPress={() => setScreen('spin')}
          style={[s.cta, pool.length === 0 && s.ctaOff]}
        >
          <Text style={s.ctaText}>돌리기</Text>
        </Pressable>

        <Pressable onPress={() => setScreen('add')} style={s.ghost}>
          <Text style={s.ghostText}>+ 먹고 싶은 메뉴 추가</Text>
        </Pressable>
      </ScrollView>
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
      <StatusBar style="light" />
      <Pressable onPress={onBack} style={s.back} hitSlop={12}>
        <Text style={s.backText}>←</Text>
      </Pressable>

      {n === 0 ? (
        <View style={s.center}>
          <Text style={s.sub}>조건에 맞는 메뉴가 없어요</Text>
        </View>
      ) : (
        <Pressable style={s.center} onPressIn={stop} onPressOut={retry}>
          <View style={s.reel}>
            <Animated.View style={{ marginTop: -ROW, transform: [{ translateY: y }] }}>
              {[-1, 0, 1].map((o) => {
                const f = at(o);
                const mid = o === 0;
                return (
                  <View key={o} style={s.slot}>
                    <Text style={mid ? s.emoji : s.emojiSide}>{f.emoji}</Text>
                    <Text style={mid ? s.name : s.nameSide} numberOfLines={1}>{f.name}</Text>
                  </View>
                );
              })}
            </Animated.View>
          </View>
          <Text style={s.hint}>{running ? '꾹 눌러서 멈추기' : '떼면 다시 돌아가요'}</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

function AddFood({ onBack, onSave }) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🍽️');
  const [tag, setTag] = useState({ 종류: GROUPS.종류[0], 맛: GROUPS.맛[0], 형태: GROUPS.형태[0] });

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave({ name: trimmed, emoji: emoji.trim() || '🍽️', cat: tag.종류, taste: tag.맛, form: tag.형태 });
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="light" />
      <Pressable onPress={onBack} style={s.back} hitSlop={12}>
        <Text style={s.backText}>←</Text>
      </Pressable>
      <ScrollView contentContainerStyle={[s.pad, { paddingTop: 70 }]}>
        <Text style={s.h1}>메뉴 추가</Text>
        <Text style={s.sub}>겹치는 메뉴는 "짜장면/짬뽕"처럼 묶어서 적어요.</Text>

        <View style={s.row}>
          <TextInput
            style={[s.input, s.inputEmoji]}
            value={emoji}
            onChangeText={setEmoji}
            maxLength={4}
            textAlign="center"
          />
          <TextInput
            style={[s.input, { flex: 1 }]}
            value={name}
            onChangeText={setName}
            placeholder="메뉴 이름"
            placeholderTextColor={C.muted}
            returnKeyType="done"
            onSubmitEditing={save}
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

        <Pressable onPress={save} style={[s.cta, !name.trim() && s.ctaOff]} disabled={!name.trim()}>
          <Text style={s.ctaText}>저장</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  pad: { padding: 24, paddingBottom: 60 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  h1: { color: C.text, fontSize: 34, fontWeight: '800', letterSpacing: -1 },
  sub: { color: C.muted, fontSize: 15, marginTop: 6, marginBottom: 24 },
  group: { marginBottom: 20 },
  groupHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  groupTitle: { color: C.text, fontSize: 13, fontWeight: '700', marginBottom: 10, opacity: 0.7 },
  clear: { color: C.muted, fontSize: 12, marginBottom: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.line,
  },
  chipOn: { backgroundColor: C.accent, borderColor: C.accent },
  chipText: { color: C.muted, fontSize: 14, fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  count: { color: C.muted, fontSize: 13, marginTop: 8, marginBottom: 16 },
  cta: { backgroundColor: C.accent, borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
  ctaOff: { opacity: 0.3 },
  ctaText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  ghost: { paddingVertical: 18, alignItems: 'center' },
  ghostText: { color: C.muted, fontSize: 14, fontWeight: '600' },
  back: {
    position: 'absolute', top: 60, left: 20, zIndex: 1,
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
  },
  backText: { color: C.text, fontSize: 26 },
  reel: { height: ROW, width: '100%', overflow: 'hidden' },
  slot: { height: ROW, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 52 },
  emojiSide: { fontSize: 36, opacity: 0.25 },
  name: { color: C.text, fontSize: 28, fontWeight: '800', marginTop: 4 },
  nameSide: { color: C.muted, fontSize: 20, fontWeight: '700', marginTop: 4, opacity: 0.25 },
  hint: { color: C.muted, fontSize: 14, marginTop: 48 },
  row: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  input: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14, color: C.text, fontSize: 17,
  },
  inputEmoji: { width: 64, fontSize: 22 },
});
