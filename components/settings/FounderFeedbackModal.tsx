import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { X, ImagePlus, Video, Send } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { FOUNDER_SUPPORT_EMAIL } from '@/constants/config';
import {
  FOUNDER_FEEDBACK_MAX_ATTACHMENTS,
  FOUNDER_FEEDBACK_MAX_BODY,
  submitFounderFeedback,
  type LocalFeedbackAttachment,
} from '@/lib/founder-feedback-service';
import { generateUUID } from '@/utils/idGenerator';

type PickedItem = LocalFeedbackAttachment & { key: string };

type Props = {
  visible: boolean;
  onClose: () => void;
  userEmailSnapshot: string | null;
};

function mimeForAsset(asset: ImagePicker.ImagePickerAsset): string {
  if (asset.mimeType) return asset.mimeType;
  if (asset.type === 'video') {
    return asset.uri.toLowerCase().endsWith('.mov') ? 'video/quicktime' : 'video/mp4';
  }
  return 'image/jpeg';
}

function kindForAsset(asset: ImagePicker.ImagePickerAsset): 'image' | 'video' {
  if (asset.type === 'video' || asset.type === 'pairedVideo') return 'video';
  return 'image';
}

export default function FounderFeedbackModal({ visible, onClose, userEmailSnapshot }: Props) {
  const [body, setBody] = useState('');
  const [items, setItems] = useState<PickedItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const reset = useCallback(() => {
    setBody('');
    setItems([]);
    setSubmitting(false);
  }, []);

  const handleClose = useCallback(() => {
    if (submitting) return;
    reset();
    onClose();
  }, [submitting, onClose, reset]);

  const addMedia = useCallback(async () => {
    if (items.length >= FOUNDER_FEEDBACK_MAX_ATTACHMENTS) {
      Alert.alert(
        'Limit reached',
        `You can add up to ${FOUNDER_FEEDBACK_MAX_ATTACHMENTS} photos or videos.`
      );
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to attach images or videos.');
      return;
    }

    const remaining = FOUNDER_FEEDBACK_MAX_ATTACHMENTS - items.length;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.85,
    });

    if (result.canceled || !result.assets?.length) return;

    const next: PickedItem[] = result.assets.map((asset) => ({
      key: generateUUID(),
      uri: asset.uri,
      mimeType: mimeForAsset(asset),
      kind: kindForAsset(asset),
    }));

    setItems((prev) => [...prev, ...next].slice(0, FOUNDER_FEEDBACK_MAX_ATTACHMENTS));
  }, [items.length]);

  const removeItem = useCallback((key: string) => {
    setItems((prev) => prev.filter((p) => p.key !== key));
  }, []);

  const onSubmit = useCallback(async () => {
    const trimmed = body.trim();
    if (trimmed.length < 1) {
      Alert.alert('Message required', 'Please write something for the founder.');
      return;
    }

    setSubmitting(true);
    try {
      await submitFounderFeedback({
        body: trimmed,
        attachments: items.map(({ uri, mimeType, kind }) => ({ uri, mimeType, kind })),
        userEmailSnapshot,
      });
      Alert.alert('Thank you', 'Your feedback was sent. We read every message.', [
        {
          text: 'OK',
          onPress: () => {
            reset();
            onClose();
          },
        },
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong. Try again later.';
      Alert.alert('Could not send', msg);
    } finally {
      setSubmitting(false);
    }
  }, [body, items, userEmailSnapshot, handleClose, onClose, reset]);

  const charsLeft = FOUNDER_FEEDBACK_MAX_BODY - body.length;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'fullScreen' : 'pageSheet'}
    >
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.title}>Give feedback to founder</Text>
          <TouchableOpacity
            onPress={handleClose}
            hitSlop={12}
            disabled={submitting}
            accessibilityLabel="Close feedback"
          >
            <X size={24} color={Colors.light.secondaryText} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        >
          <Text style={styles.intro}>
            Share what you like, what to improve, or bugs. You can attach photos or short videos.
            You can also email{' '}
            <Text style={styles.emailInline}>{FOUNDER_SUPPORT_EMAIL}</Text>.
          </Text>

          <Text style={styles.label}>Your message</Text>
          <TextInput
            style={styles.input}
            multiline
            placeholder="Write your feedback…"
            placeholderTextColor={Colors.light.secondaryText}
            value={body}
            onChangeText={(t) => setBody(t.slice(0, FOUNDER_FEEDBACK_MAX_BODY))}
            textAlignVertical="top"
            editable={!submitting}
          />
          <Text
            style={[styles.counter, charsLeft < 200 ? styles.counterWarn : undefined]}
          >
            {body.length} / {FOUNDER_FEEDBACK_MAX_BODY}
          </Text>

          <Text style={styles.label}>Attachments</Text>
          <TouchableOpacity
            style={styles.addMediaBtn}
            onPress={() => void addMedia()}
            disabled={submitting || items.length >= FOUNDER_FEEDBACK_MAX_ATTACHMENTS}
          >
            <ImagePlus size={20} color={Colors.light.primary} />
            <Text style={styles.addMediaText}>Add photos or videos</Text>
          </TouchableOpacity>
          <Text style={styles.hint}>
            Up to {FOUNDER_FEEDBACK_MAX_ATTACHMENTS} files, 50 MB each.
          </Text>

          <View style={styles.thumbRow}>
            {items.map((item) => (
              <View key={item.key} style={styles.thumbWrap}>
                {item.kind === 'image' ? (
                  <Image source={{ uri: item.uri }} style={styles.thumb} contentFit="cover" />
                ) : (
                  <View style={[styles.thumb, styles.videoPlaceholder]}>
                    <Video size={28} color={Colors.light.secondaryText} />
                  </View>
                )}
                <TouchableOpacity
                  style={styles.thumbRemove}
                  onPress={() => removeItem(item.key)}
                  disabled={submitting}
                >
                  <X size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.submitBtn, submitting ? styles.submitBtnDisabled : null]}
            onPress={() => void onSubmit()}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Send size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.submitText}>Send to founder</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    flex: 1,
    paddingRight: 12,
  },
  scroll: { flex: 1 },
  scrollContent: {
    padding: 20,
    paddingBottom: 32,
  },
  intro: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.light.secondaryText,
    marginBottom: 20,
  },
  emailInline: {
    color: Colors.light.primary,
    fontWeight: '600',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 8,
  },
  input: {
    minHeight: 140,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: Colors.light.text,
    backgroundColor: Colors.light.background,
  },
  counter: {
    fontSize: 12,
    color: Colors.light.secondaryText,
    textAlign: 'right',
    marginTop: 6,
  },
  counterWarn: {
    color: Colors.light.destructive,
  },
  addMediaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.primary,
    backgroundColor: Colors.light.primary + '12',
  },
  addMediaText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.primary,
  },
  hint: {
    fontSize: 13,
    color: Colors.light.secondaryText,
    marginTop: 8,
    marginBottom: 16,
  },
  thumbRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  thumbWrap: {
    position: 'relative',
  },
  thumb: {
    width: 88,
    height: 88,
    borderRadius: 10,
    backgroundColor: Colors.light.buttonBackground,
  },
  videoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.primary,
    paddingVertical: 16,
    borderRadius: 12,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
