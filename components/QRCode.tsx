import React from 'react';
import { View, StyleSheet } from 'react-native';
import Colors from '@/constants/colors';

interface QRCodeProps {
  value: string;
  size: number;
  color?: string;
  backgroundColor?: string;
}

// This is a simplified QR code component that just shows a visual representation
// In a real app, you would use a library like 'react-native-qrcode-svg'
export default function QRCode({
  value,
  size,
  color = Colors.light.text,
  backgroundColor = 'white'
}: QRCodeProps) {
  // Create a deterministic pattern based on the value string
  const createPattern = () => {
    // Convert string to a simple hash
    const hash = value.split('').reduce((acc, char) => {
      return acc + char.charCodeAt(0);
    }, 0);
    
    // Create a 7x7 pattern (simplified QR code representation)
    const pattern = [];
    for (let i = 0; i < 7; i++) {
      const row = [];
      for (let j = 0; j < 7; j++) {
        // Fixed corners for QR code appearance
        if ((i < 2 && j < 2) || (i < 2 && j > 4) || (i > 4 && j < 2)) {
          row.push(1);
        } else if (i === 1 && j === 1) {
          row.push(0);
        } else if (i === 1 && j === 5) {
          row.push(0);
        } else if (i === 5 && j === 1) {
          row.push(0);
        } else {
          // Use hash to determine other cells
          row.push(((hash + i * j) % 3) === 0 ? 1 : 0);
        }
      }
      pattern.push(row);
    }
    return pattern;
  };
  
  const pattern = createPattern();
  const cellSize = size / 7;
  
  return (
    <View style={[
      styles.container,
      {
        width: size,
        height: size,
        backgroundColor,
      }
    ]}>
      {pattern.map((row, i) => (
        <View key={i} style={styles.row}>
          {row.map((cell, j) => (
            <View
              key={j}
              style={[
                styles.cell,
                {
                  width: cellSize,
                  height: cellSize,
                  backgroundColor: cell ? color : backgroundColor,
                }
              ]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 10,
  },
  row: {
    flexDirection: 'row',
  },
  cell: {
    margin: 1,
  },
});