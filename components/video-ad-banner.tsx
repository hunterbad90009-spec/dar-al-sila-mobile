import { useQuery } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useEvent } from "expo";
import { useVideoPlayer, VideoView } from "expo-video";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { t } from "@/lib/i18n";
import { createStyles } from "@/lib/i18n/rtl";
import { type LiveVideoAd, getLiveVideoAds, recordVideoAdEvent } from "@/lib/video-ads";

// If a video never reports its end (slow network), move on anyway.
const MAX_SLOT_MS = 60_000;

/**
 * Home banner: plays the paid video ads that are live right now, one after another.
 * Always muted (no sound button, by design). With no live ad (or if every video fails to load) it shows `fallback` — the usual green box.
 */
export function VideoAdBanner({ fallback }: { fallback: ReactNode }) {
  const ads = useQuery({ queryKey: ["video-ads", "live"], queryFn: getLiveVideoAds, staleTime: 5 * 60 * 1000 });
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const [index, setIndex] = useState(0);
  const [focused, setFocused] = useState(true);

  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));

  const playable = (ads.data ?? []).filter((a) => !failed.has(a.id));
  if (!playable.length) return <>{fallback}</>;
  const ad = playable[index % playable.length];
  const next = () => setIndex((i) => (i + 1) % Math.max(1, playable.length));

  return (
    <AdSlot
      key={ad.id}
      ad={ad}
      loop={playable.length === 1}
      paused={!focused}
      onEnd={next}
      onError={() => setFailed((f) => new Set(f).add(ad.id))}
    />
  );
}

function AdSlot({ ad, loop, paused, onEnd, onError }: {
  ad: LiveVideoAd; loop: boolean; paused: boolean; onEnd: () => void; onError: () => void;
}) {
  const player = useVideoPlayer(ad.videoUrl, (p) => { p.loop = loop; p.muted = true; });
  const { status } = useEvent(player, "statusChange", { status: player.status });
  const viewed = useRef(false);

  useEffect(() => { player.loop = loop; }, [player, loop]);

  useEffect(() => {
    // Start after mount: on the web, play() before the <video> element exists is ignored.
    if (paused) { player.pause(); return; }
    player.muted = true;
    player.play();
    const ended = player.addListener("playToEnd", () => { if (!loop) onEnd(); });
    const timer = loop ? undefined : setTimeout(onEnd, MAX_SLOT_MS);
    return () => { ended.remove(); if (timer) clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player, paused, loop]);

  useEffect(() => {
    if (status === "error") onError();
    if (status === "readyToPlay" && !viewed.current) { viewed.current = true; recordVideoAdEvent(ad.id, "view"); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const open = () => {
    if (!ad.contactUrl) return;
    recordVideoAdEvent(ad.id, "click");
    void Linking.openURL(ad.contactUrl).catch(() => undefined);
  };

  return (
    <View style={styles.box}>
      <VideoView player={player} style={styles.video} contentFit="cover" nativeControls={false} allowsFullscreen={false} allowsPictureInPicture={false} />
      <Pressable
        accessibilityRole={ad.contactUrl ? "link" : undefined}
        accessibilityLabel={t("إعلان: {name}", { name: ad.companyName })}
        onPress={open}
        style={styles.tapArea}
      />
      <View pointerEvents="none" style={styles.caption}>
        <View style={styles.adBadge}><Text style={styles.adBadgeText}>{t("إعلان")}</Text></View>
        <Text style={styles.company} numberOfLines={1}>{ad.companyName}</Text>
        {ad.contactUrl ? <MaterialIcons name="open-in-new" size={15} color="#FFFFFF" /> : null}
      </View>
    </View>
  );
}

const styles = createStyles({
  box: { aspectRatio: 16 / 9, backgroundColor: "#0B1F17", borderRadius: 22, marginTop: 22, overflow: "hidden", width: "100%" },
  // Explicit size: on the web absoluteFill alone leaves the <video> at its natural size.
  video: { height: "100%", left: 0, position: "absolute", top: 0, width: "100%" },
  tapArea: { bottom: 0, left: 0, position: "absolute", right: 0, top: 0 },
  caption: { alignItems: "center", backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 12, bottom: 10, flexDirection: "row-reverse", gap: 6, maxWidth: "75%", paddingHorizontal: 8, paddingVertical: 5, position: "absolute", right: 10 },
  adBadge: { backgroundColor: "#D4AF37", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  adBadgeText: { color: "#0B1F17", fontSize: 10, fontWeight: "900" },
  company: { color: "#FFFFFF", flexShrink: 1, fontSize: 13, fontWeight: "800", textAlign: "right" },
});
