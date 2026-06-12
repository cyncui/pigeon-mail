import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CreateButton } from '@/components/create-button';
import { DeskCard, type DeskTarget, type SettleMode } from '@/components/desk-card';
import { PostcardFocus, type FocusOrigin } from '@/components/postcard-focus';
import { POSTCARD_ASPECT, STAMP_BORDER } from '@/components/stamp-frame';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { useShake } from '@/hooks/use-shake';
import {
  claimNextZ,
  commitPlacement,
  commitPlacements,
  getPlacement,
  loadDeskLayout,
  peekNextZ,
  placementToPx,
  pruneTo,
  pxToPlacement,
  resetDeskLayout,
  scatterPlacements,
  seedPlacement,
  type DeskRect,
} from '@/lib/desk-layout';
import { loadHandling, pruneHandlingTo, recordPickup, useHandlingVersion, wearLevel } from '@/lib/handling';
import { hapticLight, hapticMedium } from '@/lib/haptics';
import type { PostcardData } from '@/lib/postcards';
import { unitFromSeed } from '@/lib/tilt';

const FAB_SIZE = 56;

type CardTarget = DeskTarget & { entering: boolean; arrival: number };

type Props = {
  cards: PostcardData[];
  /** True while the sent-postcards store is still loading. */
  loading: boolean;
  onCreate: () => void;
};

/**
 * The desk: every postcard lives somewhere on it. The mail arrives as a neat
 * center pile — shake the phone to scatter it across the desk. Drag to
 * rearrange (positions persist), toss with a flick, tap one to pick it up and
 * read it, and "tidy up" to spring everything back into the pile.
 */
/**
 * Every card carries gestures, an SVG perforation mask, and textures — a desk
 * holding years of mail would crawl. Until an archive exists, the desk shows
 * the most recent cards only.
 */
const MAX_DESK_CARDS = 60;

export function DeskScreen({ cards: allCards, loading, onCreate }: Props) {
  const cards = allCards.length > MAX_DESK_CARDS ? allCards.slice(0, MAX_DESK_CARDS) : allCards;
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  const cardW = Math.max(200, Math.min(280, screenW * 0.62));
  const cardH = (cardW - STAMP_BORDER * 2) / POSTCARD_ASPECT + STAMP_BORDER * 2;

  const deskRect: DeskRect = useMemo(
    () => ({
      left: 24,
      top: insets.top + 64,
      right: screenW - 24,
      bottom: screenH - insets.bottom - 32,
    }),
    [insets.top, insets.bottom, screenW, screenH],
  );

  const [mountIds, setMountIds] = useState<Set<string> | null>(null);
  const [settleEpoch, setSettleEpoch] = useState(0);
  const [settleMode, setSettleMode] = useState<SettleMode>('glide');
  const [targets, setTargets] = useState<Map<string, CardTarget>>(new Map());
  const [focused, setFocused] = useState<{ postcard: PostcardData; origin: FocusOrigin } | null>(null);
  const [routeFocused, setRouteFocused] = useState(false);
  // True while the mail still sits in its untouched pile — drives the shake hint.
  const [piled, setPiled] = useState(false);

  const zCounter = useSharedValue(1);
  const arrivals = useRef(new Map<string, number>());
  const cardsRef = useRef(cards);
  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);
  const rectRef = useRef(deskRect);
  useEffect(() => {
    rectRef.current = deskRect;
  }, [deskRect]);

  // Load the saved layout (and each card's handling record) once the card
  // list is real, and snapshot which ids were present at first render —
  // anything appearing later is an "arrival".
  useEffect(() => {
    if (loading || mountIds !== null) return;
    let cancelled = false;
    void Promise.all([loadDeskLayout(), loadHandling()]).then(() => {
      if (cancelled) return;
      const ids = cardsRef.current.map((c) => c.id);
      pruneTo(ids);
      pruneHandlingTo(ids);
      zCounter.value = Math.max(peekNextZ(), ids.length + 1);
      setMountIds(new Set(ids));
    });
    return () => {
      cancelled = true;
    };
  }, [loading, mountIds, zCounter]);

  useFocusEffect(
    useCallback(() => {
      setRouteFocused(true);
      return () => setRouteFocused(false);
    }, []),
  );

  // (Re)derive every card's resting target. Runs on load and card arrival —
  // placement claims/commits are side effects, so this lives in an effect,
  // not render. (Tidy/shake/resize go through settleTo instead, which updates
  // targets and the epoch in the same commit so cards never spring to a
  // stale target.)
  const ids = cards.map((c) => c.id).join(' ');
  useEffect(() => {
    if (mountIds === null) return;
    const list = cardsRef.current;
    const next = new Map<string, CardTarget>();
    let anyStored = false;
    list.forEach((card, i) => {
      const entering = !mountIds.has(card.id);
      let placement = getPlacement(card.id);
      if (placement) anyStored = true;
      if (!placement) {
        placement = seedPlacement(card.id, list.length - 1 - i, rectRef.current);
        if (entering) {
          placement = { ...placement, z: claimNextZ() };
          commitPlacement(card.id, placement);
          if (!arrivals.current.has(card.id)) {
            arrivals.current.set(card.id, arrivals.current.size);
          }
        }
      }
      const { x, y } = placementToPx(placement, rectRef.current);
      next.set(card.id, {
        x,
        y,
        rot: placement.rot,
        z: placement.z,
        entering,
        arrival: arrivals.current.get(card.id) ?? 0,
      });
    });
    setTargets(next);
    setPiled(!anyStored);
  }, [mountIds, ids]);

  // Re-aim every card and play one settle animation. Targets and the epoch
  // bump land in the same commit, so each card's settle effect reads the
  // fresh target the moment it fires.
  const settleTo = useCallback((mode: SettleMode) => {
    setTargets((prev) => {
      const list = cardsRef.current;
      const next = new Map<string, CardTarget>();
      list.forEach((card, i) => {
        const placement =
          getPlacement(card.id) ?? seedPlacement(card.id, list.length - 1 - i, rectRef.current);
        const { x, y } = placementToPx(placement, rectRef.current);
        const before = prev.get(card.id);
        next.set(card.id, {
          x,
          y,
          rot: placement.rot,
          z: placement.z,
          // A card mid-arrival keeps its pending entrance.
          entering: before?.entering ?? false,
          arrival: before?.arrival ?? arrivals.current.get(card.id) ?? 0,
        });
      });
      return next;
    });
    setSettleMode(mode);
    setSettleEpoch((e) => e + 1);
  }, []);

  // The shake: throw the pile across the desk.
  const scatter = useCallback(() => {
    const list = cardsRef.current;
    if (list.length === 0) return;
    commitPlacements(scatterPlacements(list.map((c) => c.id), rectRef.current));
    zCounter.value = Math.max(zCounter.value, peekNextZ());
    hapticMedium();
    setPiled(false);
    settleTo('toss');
  }, [settleTo, zCounter]);

  const shakeReady = useShake(routeFocused && !focused && mountIds !== null, scatter);

  // Shake while holding a card = let go: it puts itself back down. Same
  // gesture, same meaning, opposite end of the pickup.
  const [closeSignal, setCloseSignal] = useState(0);
  const putDown = useCallback(() => {
    hapticLight();
    setCloseSignal((n) => n + 1);
  }, []);
  useShake(routeFocused && focused !== null, putDown);

  // Window resized (web): re-derive px targets and let cards glide over.
  const firstRect = useRef(true);
  useEffect(() => {
    if (firstRect.current) {
      firstRect.current = false;
      return;
    }
    settleTo('glide');
  }, [deskRect, settleTo]);

  const handleCommit = useCallback((id: string, x: number, y: number, rot: number, z: number) => {
    const { cx, cy } = pxToPlacement(x, y, rectRef.current);
    commitPlacement(id, { cx, cy, rot, z });
    setPiled(false);
  }, []);

  const handleTap = useCallback(
    (id: string, x: number, y: number, rot: number) => {
      const postcard = cardsRef.current.find((c) => c.id === id);
      if (postcard) {
        // Picking a card up leaves a mark on it — that's the point.
        recordPickup(id);
        setFocused({ postcard, origin: { x, y, rot, width: cardW } });
      }
    },
    [cardW],
  );

  // Subscribe to handling so wearLevel() reads fresh after every pickup.
  useHandlingVersion();

  async function tidyUp() {
    await resetDeskLayout();
    setPiled(true);
    settleTo('glide');
  }

  // Furniture fades away while a card is held.
  const furniture = useSharedValue(1);
  useEffect(() => {
    furniture.value = withTiming(focused ? 0 : 1, { duration: 200 });
  }, [focused, furniture]);
  const furnitureStyle = useAnimatedStyle(() => ({ opacity: furniture.value }));

  return (
    <Animated.View style={styles.root}>
      <Animated.View
        style={[styles.deskPrint, { paddingTop: insets.top + Spacing.five }, furnitureStyle]}
        pointerEvents="none"
      >
        <Text style={styles.title}>Pigeon Mail</Text>
      </Animated.View>

      {cards.map((card) => {
        const target = targets.get(card.id);
        if (!target) return null;
        return (
          <DeskCard
            key={card.id}
            postcard={card}
            width={cardW}
            height={cardH}
            target={target}
            settleEpoch={settleEpoch}
            settleMode={settleMode}
            settleDelay={
              // A shake is one impulse: a short ragged burst (re-rolled per
              // shake), not the tidy-up's orderly bottom-of-pile-first cascade.
              settleMode === 'toss'
                ? Math.round(unitFromSeed(card.id, `burst${settleEpoch}`) * 110)
                : Math.min(target.z * 25, 250)
            }
            bounds={{
              minX: deskRect.left,
              maxX: deskRect.right,
              minY: deskRect.top,
              maxY: deskRect.bottom,
            }}
            zCounter={zCounter}
            entering={target.entering}
            playEntrance={routeFocused}
            entranceDelay={120 + target.arrival * 80}
            wear={wearLevel(card.id)}
            held={focused?.postcard.id === card.id}
            reduceMotion={reduceMotion}
            onCommit={handleCommit}
            onTap={handleTap}
          />
        );
      })}

      <Animated.View style={[styles.furnitureLayer, furnitureStyle]} pointerEvents={focused ? 'none' : 'box-none'}>
        {shakeReady && piled && cards.length > 1 ? (
          <Animated.View
            entering={FadeIn.duration(400).delay(900).reduceMotion(ReduceMotion.System)}
            exiting={FadeOut.duration(180).reduceMotion(ReduceMotion.System)}
            style={[
              styles.shakeHint,
              {
                // A pencil note just under the pile.
                top: deskRect.top + (deskRect.bottom - deskRect.top) / 2 - 12 + cardH / 2 + 14,
              },
            ]}
            pointerEvents="none"
          >
            <Text style={styles.shakeHintText}>shake to scatter the mail</Text>
          </Animated.View>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tidy the desk"
          hitSlop={16}
          onPress={tidyUp}
          style={({ pressed }) => [
            styles.tidy,
            { bottom: insets.bottom + Spacing.four + Spacing.two, opacity: pressed ? 0.55 : 1 },
          ]}
        >
          <Text style={styles.tidyText}>Tidy up</Text>
        </Pressable>
        <CreateButton
          size={FAB_SIZE}
          onPress={onCreate}
          style={{ right: Spacing.four, bottom: insets.bottom + Spacing.four }}
        />
      </Animated.View>

      {focused ? (
        <PostcardFocus
          postcard={focused.postcard}
          origin={focused.origin}
          closeSignal={closeSignal}
          onClose={() => setFocused(null)}
        />
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Brand.cream,
    overflow: 'hidden',
  },
  deskPrint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    zIndex: 0,
  },
  title: {
    // Hand of Cynthia runs optically small — sized up to keep its presence.
    fontFamily: Fonts.serifItalic,
    fontSize: 38,
    lineHeight: 46,
    color: Brand.brown,
    textAlign: 'center',
  },
  furnitureLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100000,
  },
  tidy: {
    position: 'absolute',
    left: Spacing.four,
  },
  shakeHint: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  shakeHintText: {
    fontFamily: Fonts.caption,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: Brand.brown60,
    transform: [{ rotate: '-1deg' }],
  },
  tidyText: {
    fontFamily: Fonts.caption,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: Brand.brown60,
  },
});
