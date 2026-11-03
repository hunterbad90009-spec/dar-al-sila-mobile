import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet } from "react-native";
import { useEvent } from "expo";
import { useVideoPlayer, VideoView } from "expo-video";
import { createStyles } from "@/lib/i18n/rtl";

/**
 * Launch intro: the 6-second Muscat video plays over the app once per launch,
 * then fades out to whatever screen is underneath (normally the home tab).
 *
 * It is an overlay rather than a route because "/" already belongs to the home tab
 * (app/(tabs)/index.tsx shadows app/index.tsx), so a route-based intro never shows.
 */
const OPENING_VIDEO = require("@/assets/videos/souq-muscat-opening.mp4");
// Safety net if the video never starts or never reports its end (slow network, blocked autoplay).
const FALLBACK_MS = 9000;

export function OpeningVideo() {
  const [visible, setVisible] = useState(true);
  const opacity = useRef(new Animated.Value(1)).current;
  const finished = useRef(false);

  const player = useVideoPlayer(OPENING_VIDEO, (p) => {
    p.loop = false;
    p.muted = true; // muted video may autoplay on the web and on phones
  });

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    Animated.timing(opacity, { toValue: 0, duration: 350, useNativeDriver: true }).start(() => setVisible(false));
  };

  const { status } = useEvent(player, "statusChange", { status: player.status });

  useEffect(() => {
    // Start after mount: on the web, play() before the <video> element exists is ignored.
    player.muted = true;
    player.play();
    const ended = player.addListener("playToEnd", finish);
    const timer = setTimeout(finish, FALLBACK_MS);
    return () => {
      ended.remove();
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player]);

  useEffect(() => {
    if (status === "error") finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.overlay, { opacity }]}>
      <VideoView
        player={player}
        style={styles.video}
        contentFit="cover"
        nativeControls={false}
        allowsFullscreen={false}
        allowsPictureInPicture={false}
      />
    </Animated.View>
  );
}

const styles = createStyles({
  // Matches the video's first frame so there is no flash before it starts.
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "#000305", zIndex: 1000 },
  // Explicit size: on the web absoluteFill alone leaves the <video> at its natural 360×534.
  video: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%" },
});
