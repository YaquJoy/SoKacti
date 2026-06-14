import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useAuth } from '@/context/auth';
import { supabase } from '@/lib/supabase';

const TEAL = '#2BBFAE';

// Position the card just below the toolbar (~header 52 + safe-area ~50 + toolbar 48)
const CARD_TOP = 150;

interface Props {
  onUploadComplete: () => Promise<void>;
}

// ─── Main component ───────────────────────────────────────────────────────────
export function AddPlantMenu({ onUploadComplete }: Props) {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  function close() {
    setOpen(false);
  }

  // ── Upload helper ──────────────────────────────────────────────────────────
  async function uploadAsset(asset: ImagePicker.ImagePickerAsset) {
    if (!session?.user) throw new Error('请先登录');

    const mimeType = asset.mimeType ?? 'image/jpeg';
    const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
    const storagePath = `${session.user.id}/${Date.now()}.${ext}`;

    // Web: expo-image-picker returns a blob: URL — use fetch + arrayBuffer
    // Mobile: use expo-file-system which handles file:// and content:// URIs
    let bytes: Uint8Array;
    if (Platform.OS === 'web') {
      const resp = await fetch(asset.uri);
      if (!resp.ok) throw new Error(`读取文件失败 (${resp.status})`);
      bytes = new Uint8Array(await resp.arrayBuffer());
    } else {
      const base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const binaryStr = atob(base64);
      bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
    }

    if (bytes.length === 0) throw new Error('文件内容为空，请重新选择图片');

    const { error: storageErr } = await supabase.storage
      .from('plant-photos')
      .upload(storagePath, bytes, { contentType: mimeType });
    if (storageErr) throw new Error(`存储上传失败: ${storageErr.message}`);

    // Signed URL works for both public and private buckets (5-year expiry)
    const { data: signedData, error: signedErr } = await supabase.storage
      .from('plant-photos')
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365 * 5);
    if (signedErr) throw signedErr;

    const { data: plant, error: plantErr } = await supabase
      .from('plants')
      .insert({ user_id: session.user.id })
      .select('id')
      .single();
    if (plantErr) throw plantErr;

    const { error: photoErr } = await supabase
      .from('plant_photos')
      .insert({ plant_id: plant.id, url: signedData.signedUrl, taken_at: new Date().toISOString() });
    if (photoErr) throw photoErr;
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  async function handleLibrary(multiple: boolean) {
    close();
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('需要相册权限', '请在系统设置中开启相册访问权限');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: !multiple,
      allowsMultipleSelection: multiple,
      quality: 0.85,
      exif: false,
    });

    if (result.canceled || !result.assets.length) return;

    setUploading(true);
    try {
      for (const asset of result.assets) {
        await uploadAsset(asset);
      }
      await onUploadComplete();
      Alert.alert('上传成功', `已添加 ${result.assets.length} 张图片`);
    } catch (err) {
      Alert.alert('上传失败', err instanceof Error ? err.message : '请稍后重试');
    } finally {
      setUploading(false);
    }
  }

  async function handleCamera() {
    close();
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('需要相机权限', '请在系统设置中开启相机访问权限');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.85,
      allowsEditing: true,
      exif: false,
    });

    if (result.canceled || !result.assets.length) return;

    setUploading(true);
    try {
      await uploadAsset(result.assets[0]);
      await onUploadComplete();
      Alert.alert('上传成功', '已添加照片');
    } catch (err) {
      Alert.alert('上传失败', err instanceof Error ? err.message : '请稍后重试');
    } finally {
      setUploading(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Full-screen modal — backdrop + floating card */}
      <Modal
        transparent
        visible={open}
        onRequestClose={close}
        animationType="fade"
        statusBarTranslucent
      >
        {/* Tap outside to close */}
        <Pressable style={styles.backdrop} onPress={close} />

        {/* Floating action card */}
        <Animated.View
          entering={FadeInDown.springify().damping(18).mass(0.7)}
          style={styles.menuCard}
        >
          <ActionBtn
            icon="camera"
            label="拍照"
            color="#FF6B6B"
            onPress={handleCamera}
          />
          <ActionBtn
            icon="image"
            label="选一张"
            color={TEAL}
            onPress={() => handleLibrary(false)}
          />
          <ActionBtn
            icon="images"
            label="批量选"
            color="#7B68EE"
            onPress={() => handleLibrary(true)}
          />
        </Animated.View>
      </Modal>

      {/* + / close toggle — sits inside the yellow pill */}
      <Pressable
        style={[styles.pillBtn, open && styles.pillBtnActive]}
        onPress={() => setOpen(o => !o)}
        disabled={uploading}
      >
        {uploading ? (
          <ActivityIndicator size="small" color="white" />
        ) : (
          <Ionicons name={open ? 'close' : 'add'} size={17} color="white" />
        )}
      </Pressable>
    </>
  );
}

// ─── ActionBtn ────────────────────────────────────────────────────────────────
function ActionBtn({
  icon,
  label,
  color,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.75 }]}
      onPress={onPress}
    >
      <View style={[styles.actionCircle, { backgroundColor: color }]}>
        <Ionicons name={icon} size={24} color="white" />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Toggle button (inside the yellow pill)
  pillBtn: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 15,
  },
  pillBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.35)',
  },

  // Modal backdrop
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },

  // Floating card — positioned below the toolbar, anchored to right edge
  menuCard: {
    position: 'absolute',
    top: CARD_TOP,
    right: 16,
    flexDirection: 'row',
    gap: 20,
    backgroundColor: 'white',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 10,
  },

  // Each action button
  actionBtn: {
    alignItems: 'center',
    gap: 8,
  },
  actionCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#444',
  },
});
