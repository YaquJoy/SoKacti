import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/auth';
import { BottomTabInset } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import type { Plant, PlantPhoto } from '@/types/plant';
import { AddPlantMenu } from '@/components/add-plant-menu';

// ─── Design tokens ────────────────────────────────────────────────────────────
const TEAL = '#2BBFAE';
const YELLOW = '#F5C219';
const RED = '#E53935';
const LABEL_STRIP_W = 40;
const GAP = 1;
const CARD_H = 130;
const NAME_W = 26;

const SCREEN_W = Dimensions.get('window').width;
const GRID_W = SCREEN_W - LABEL_STRIP_W;
const CARD_W = (GRID_W - GAP * 2) / 3;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function displayName(plant: Plant): string {
  if (plant.common_name) return plant.common_name;
  if (plant.genus && plant.species) return `${plant.genus} ${plant.species}`;
  return plant.genus ?? plant.species ?? '未知';
}

function latestPhoto(plant: Plant): string | null {
  const sorted = [...plant.plant_photos].sort(
    (a, b) => new Date(b.taken_at ?? 0).getTime() - new Date(a.taken_at ?? 0).getTime()
  );
  return sorted[0]?.url ?? null;
}

// fallback card color based on plant id
const FALLBACK_COLORS = [
  '#7A9B6A', '#5A7B5A', '#6BA86A', '#5A8A6A', '#C9A840',
  '#857060', '#4A7A6A', '#6A9A6A', '#8A4A6A', '#5A8A5A',
];
function fallbackColor(id: string): string {
  const n = id.charCodeAt(0) + id.charCodeAt(id.length - 1);
  return FALLBACK_COLORS[n % FALLBACK_COLORS.length];
}

// ─── PlantCard ────────────────────────────────────────────────────────────────
function PlantCard({ plant }: { plant: Plant }) {
  const name = displayName(plant);
  const photoUrl = latestPhoto(plant);

  return (
    <View style={[styles.card, { width: CARD_W }]}>
      {/* Left name strip */}
      <View style={styles.nameStrip}>
        {name.split('').map((ch, i) => (
          <Text key={i} style={styles.nameChar} numberOfLines={1}>
            {ch}
          </Text>
        ))}
      </View>

      {/* Photo area */}
      <View style={[styles.photo, !photoUrl && { backgroundColor: fallbackColor(plant.id) }]}>
        {photoUrl ? (
          <Image
            source={{ uri: photoUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
            placeholder={fallbackColor(plant.id)}
          />
        ) : null}

        {/* Icons overlay */}
        <View style={styles.cardIcons}>
          <View style={styles.iconBubble}>
            <Ionicons name="camera-outline" size={13} color="rgba(255,255,255,0.9)" />
          </View>
          <View>
            <View style={styles.iconBubble}>
              <Ionicons name="water-outline" size={13} color="rgba(255,255,255,0.9)" />
            </View>
            <View style={styles.redBadge} />
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── PlantGrid ────────────────────────────────────────────────────────────────
function PlantGrid({ plants }: { plants: Plant[] }) {
  const rows: Plant[][] = [];
  for (let i = 0; i < plants.length; i += 3) {
    rows.push(plants.slice(i, i + 3));
  }

  return (
    <View style={styles.sectionRow}>
      <View style={styles.grid}>
        {rows.map((row, ri) => (
          <View key={ri} style={[styles.gridRow, ri > 0 && styles.rowGap]}>
            {row.map((plant, ci) => (
              <React.Fragment key={plant.id}>
                {ci > 0 && <View style={styles.colGap} />}
                <PlantCard plant={plant} />
              </React.Fragment>
            ))}
            {row.length < 3 &&
              Array.from({ length: 3 - row.length }).map((_, i) => (
                <React.Fragment key={`pad${i}`}>
                  <View style={styles.colGap} />
                  <View style={styles.cardPad} />
                </React.Fragment>
              ))}
          </View>
        ))}
      </View>

      {/* Right label strip */}
      <View style={styles.labelStrip}>
        {'我的植物'.split('').map((ch, i) => (
          <Text key={i} style={[styles.labelChar, { color: TEAL }]}>{ch}</Text>
        ))}
      </View>
    </View>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <View style={styles.emptyWrap}>
      <Ionicons name="leaf-outline" size={64} color={TEAL} />
      <Text style={styles.emptyTitle}>还没有植物</Text>
      <Text style={styles.emptyHint}>点击右上角 + 添加你的第一株植物</Text>
    </View>
  );
}

// ─── HomeScreen ───────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const { session } = useAuth();
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPlants = useCallback(async () => {
    if (!session?.user) return;
    setLoading(true);

    // Step 1: fetch plants
    const { data: plantsData, error: plantsErr } = await supabase
      .from('plants')
      .select('id, user_id, common_name, genus, species, confidence, confirmed, acquired_at, is_public, for_trade, country, created_at')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (plantsErr) {
      console.error('plants query:', plantsErr.message);
      setLoading(false);
      return;
    }

    const rows = (plantsData ?? []) as Omit<Plant, 'plant_photos'>[];

    // Step 2: fetch photos separately (avoids needing FK defined in Supabase)
    let photos: PlantPhoto[] = [];
    if (rows.length > 0) {
      const ids = rows.map(p => p.id);
      const { data: photosData, error: photosErr } = await supabase
        .from('plant_photos')
        .select('id, plant_id, url, taken_at')
        .in('plant_id', ids);
      if (photosErr) {
        console.error('photos query:', photosErr.message);
      } else {
        photos = (photosData ?? []) as PlantPhoto[];
      }
    }

    // Merge
    const merged: Plant[] = rows.map(p => ({
      ...p,
      plant_photos: photos.filter(ph => ph.plant_id === p.id),
    }));

    setPlants(merged);
    setLoading(false);
  }, [session]);

  useEffect(() => {
    fetchPlants();
  }, [fetchPlants]);

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.logoCircle}>
              <Ionicons name="leaf" size={18} color="white" />
            </View>
            <Text style={styles.headerTitle}>我的多肉</Text>
          </View>
          <View style={styles.headerRight}>
            <Pressable style={styles.headerBtn}>
              <Ionicons name="notifications-outline" size={22} color="white" />
            </Pressable>
            <Pressable style={styles.headerBtn}>
              <Ionicons name="grid-outline" size={22} color="white" />
            </Pressable>
            <Pressable style={styles.headerBtn}>
              <Ionicons name="menu-outline" size={22} color="white" />
            </Pressable>
            <View>
              <Pressable style={styles.headerBtn} onPress={fetchPlants}>
                <Ionicons name="refresh-outline" size={22} color="white" />
              </Pressable>
            </View>
          </View>
        </View>

        {/* ── Toolbar ── */}
        <View style={styles.toolbar}>
          <View style={styles.filterGroup}>
            <Pressable style={styles.toolBtn}>
              <MaterialCommunityIcons name="watering-can-outline" size={22} color={TEAL} />
            </Pressable>
            <Pressable style={styles.toolBtn}>
              <MaterialCommunityIcons name="mushroom-outline" size={22} color="#AAA" />
            </Pressable>
            <Pressable style={styles.toolBtn}>
              <MaterialCommunityIcons name="sprout-outline" size={22} color="#AAA" />
            </Pressable>
            <Pressable style={styles.toolBtn}>
              <MaterialCommunityIcons name="flower-outline" size={22} color="#AAA" />
            </Pressable>
            <Pressable style={styles.toolBtn}>
              <Ionicons name="list-outline" size={22} color="#AAA" />
            </Pressable>
          </View>

          <View style={styles.viewPill}>
            <Pressable style={[styles.pillBtn, styles.pillBtnOn]}>
              <Ionicons name="camera" size={17} color="white" />
            </Pressable>
            <Pressable style={styles.pillBtn}>
              <Ionicons name="image" size={17} color="white" />
            </Pressable>
            <Pressable style={styles.pillBtn}>
              <Ionicons name="images" size={17} color="white" />
            </Pressable>
            <AddPlantMenu onUploadComplete={fetchPlants} />
          </View>

          <Pressable style={styles.toolBtn}>
            <Ionicons name="search-outline" size={22} color="#666" />
          </Pressable>
        </View>

        {/* ── Content ── */}
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={TEAL} />
          </View>
        ) : plants.length === 0 ? (
          <EmptyState />
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={{ paddingBottom: BottomTabInset + 16 }}
            showsVerticalScrollIndicator={false}
          >
            <PlantGrid plants={plants} />
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: TEAL },
  safeTop: { flex: 1 },

  // Header
  header: {
    height: 52,
    backgroundColor: TEAL,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoCircle: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.22)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '600', color: 'white' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  headerBtn: { padding: 5 },

  // Toolbar
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
  },
  filterGroup: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 1 },
  toolBtn: { padding: 4 },
  viewPill: {
    flexDirection: 'row', backgroundColor: YELLOW,
    borderRadius: 22, padding: 3, gap: 1,
  },
  pillBtn: { width: 30, height: 30, justifyContent: 'center', alignItems: 'center', borderRadius: 15 },
  pillBtnOn: { backgroundColor: 'rgba(255,255,255,0.35)' },

  // Loading / empty
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#E8EAEC' },
  emptyWrap: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#E8EAEC', gap: 12, paddingHorizontal: 40,
  },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#555' },
  emptyHint: { fontSize: 13, color: '#888', textAlign: 'center', lineHeight: 20 },

  // Scroll / grid
  scroll: { flex: 1, backgroundColor: '#E8EAEC' },
  sectionRow: { flexDirection: 'row' },
  grid: { flex: 1 },
  gridRow: { flexDirection: 'row' },
  rowGap: { marginTop: GAP },
  colGap: { width: GAP, backgroundColor: '#E8EAEC' },

  // Plant card
  card: { height: CARD_H, flexDirection: 'row', overflow: 'hidden' },
  nameStrip: {
    width: NAME_W, backgroundColor: TEAL,
    alignItems: 'center', justifyContent: 'center', paddingVertical: 6,
  },
  nameChar: { fontSize: 11, color: 'white', fontWeight: '500', lineHeight: 14, textAlign: 'center' },
  photo: { flex: 1, alignItems: 'flex-end', padding: 4 },
  cardIcons: { flexDirection: 'row', gap: 4 },
  iconBubble: { backgroundColor: 'rgba(0,0,0,0.28)', borderRadius: 10, padding: 3 },
  redBadge: {
    position: 'absolute', top: -1, right: -1,
    width: 7, height: 7, borderRadius: 3.5,
    backgroundColor: RED, borderWidth: 1, borderColor: 'white',
  },
  cardPad: { width: CARD_W, height: CARD_H, backgroundColor: '#E8EAEC' },

  // Right label strip
  labelStrip: {
    width: LABEL_STRIP_W, backgroundColor: '#E8EAEC',
    justifyContent: 'center', alignItems: 'center', paddingVertical: 8,
  },
  labelChar: { fontSize: 11, fontWeight: '500', lineHeight: 15, textAlign: 'center' },
});
