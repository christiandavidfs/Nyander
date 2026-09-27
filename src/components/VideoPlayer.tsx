import { useRef } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

type Props = {
  uri: string;
  style?: any;
};

export default function VideoPlayer({ uri, style }: Props) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
  });

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, style]}>
        <video
          src={uri}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          loop
          muted
          playsInline
          autoPlay
          controls
        />
      </View>
    );
  }

  return (
    <VideoView
      player={player}
      style={[styles.container, style]}
      nativeControls
      contentFit="cover"
    />
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000',
  },
});
