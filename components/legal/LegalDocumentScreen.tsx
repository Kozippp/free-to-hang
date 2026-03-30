import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';

type Section = { heading?: string; body: string };

type Props = {
  sections: Section[];
  /**
   * `screen` — auth stack screens (top inset from navigator).
   * `embedded` — inside a modal with its own header / safe area.
   */
  variant?: 'screen' | 'embedded';
};

export function LegalDocumentScreen({ sections, variant = 'screen' }: Props) {
  const body = (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator
    >
      {sections.map((section, index) => (
        <View key={index} style={styles.block}>
          {section.heading ? (
            <Text style={styles.heading}>{section.heading}</Text>
          ) : null}
          <Text style={styles.body}>{section.body}</Text>
        </View>
      ))}
    </ScrollView>
  );

  if (variant === 'embedded') {
    return <View style={styles.embeddedRoot}>{body}</View>;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {body}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#fff',
  },
  embeddedRoot: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  block: {
    marginBottom: 20,
  },
  heading: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 8,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.light.secondaryText,
  },
});
