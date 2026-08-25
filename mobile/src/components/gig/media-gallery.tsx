import { useMemo, useState } from "react";
import { Image } from "expo-image";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";

import { gigMediaUrl } from "@/lib/media";
import { colors, space } from "@/lib/theme";
import { Eyebrow } from "@/components/ui";

/**
 * The photo gallery on a past gig, matching the web's masonry.
 *
 * Two columns, each photo at its own aspect ratio, packed greedily into the
 * shorter column — which is all a masonry is on a screen this narrow. The
 * web's zip download stays on the web: a phone's version of "take these home"
 * is the full-screen viewer and a long-press save, both of which the OS
 * already provides on any image.
 */

type MediaItem = {
  id: string;
  type: string;
  url: string | null;
  fileUploadId?: string | null;
  fileUpload?: {
    id: string;
    url: string;
    width?: number | null;
    height?: number | null;
  } | null;
};

export function MediaGallery({ media }: { media: MediaItem[] }) {
  const { width: screenWidth } = useWindowDimensions();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const photos = useMemo(
    () =>
      media
        .filter((item) => item.type === "photo")
        .map((item) => ({
          id: item.id,
          uri: gigMediaUrl(item),
          // Unknown dimensions land as square rather than being dropped.
          ratio:
            item.fileUpload?.width && item.fileUpload?.height
              ? item.fileUpload.width / item.fileUpload.height
              : 1,
        }))
        .filter(
          (photo): photo is typeof photo & { uri: string } => !!photo.uri,
        ),
    [media],
  );

  const columns = useMemo(() => {
    const left: typeof photos = [];
    const right: typeof photos = [];
    let leftHeight = 0;
    let rightHeight = 0;
    for (const photo of photos) {
      const height = 1 / photo.ratio;
      if (leftHeight <= rightHeight) {
        left.push(photo);
        leftHeight += height;
      } else {
        right.push(photo);
        rightHeight += height;
      }
    }
    return [left, right];
  }, [photos]);

  if (photos.length === 0) return null;

  return (
    <View style={{ gap: space.md }}>
      <View style={styles.header}>
        <Eyebrow>Photos</Eyebrow>
        <Text style={styles.count}>{photos.length}</Text>
      </View>

      <View style={{ flexDirection: "row", gap: space.sm }}>
        {columns.map((column, columnIndex) => (
          <View key={columnIndex} style={{ flex: 1, gap: space.sm }}>
            {column.map((photo) => (
              <Pressable
                key={photo.id}
                accessibilityRole="imagebutton"
                onPress={() =>
                  setOpenIndex(photos.findIndex((p) => p.id === photo.id))
                }
              >
                <Image
                  source={{ uri: photo.uri }}
                  style={[styles.photo, { aspectRatio: photo.ratio }]}
                  contentFit="cover"
                  transition={150}
                />
              </Pressable>
            ))}
          </View>
        ))}
      </View>

      <Viewer
        photos={photos}
        index={openIndex}
        screenWidth={screenWidth}
        onClose={() => setOpenIndex(null)}
      />
    </View>
  );
}

/**
 * Full screen, paged. Opens on the tapped photo and swipes through the rest.
 * Long-pressing an image gets the system share/save sheet for free.
 */
function Viewer({
  photos,
  index,
  screenWidth,
  onClose,
}: {
  photos: { id: string; uri: string; ratio: number }[];
  index: number | null;
  screenWidth: number;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={index !== null}
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: (index ?? 0) * screenWidth, y: 0 }}
        >
          {photos.map((photo) => (
            <View
              key={photo.id}
              style={{ width: screenWidth, justifyContent: "center" }}
            >
              <Image
                source={{ uri: photo.uri }}
                style={{ width: screenWidth, aspectRatio: photo.ratio }}
                contentFit="contain"
                transition={150}
              />
            </View>
          ))}
        </ScrollView>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          hitSlop={12}
          style={[styles.close, { top: insets.top + space.sm }]}
        >
          <X color={colors.text} size={20} strokeWidth={2.5} />
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  count: { color: colors.textFaint, fontSize: 11, fontFamily: "Menlo" },
  photo: {
    width: "100%",
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  close: {
    position: "absolute",
    right: space.lg,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.3)",
  },
});
