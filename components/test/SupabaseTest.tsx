import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { supabase } from '@/lib/supabase';

export default function SupabaseTest() {
  const [status, setStatus] = useState('Ready to test');
  const [loading, setLoading] = useState(false);

  const testConnection = async () => {
    setLoading(true);
    setStatus('Testing connection...');

    try {
      // Test 1: Basic connection
      const { data, error } = await supabase
        .from('users')
        .select('count')
        .single();
      
      if (error) {
        setStatus(`Connection Error: ${error.message}`);
        console.log('Supabase Error:', error);
        return;
      }

      setStatus('✅ Connection successful! Database is reachable.');
    } catch (err: any) {
      setStatus(`Network Error: ${err.message}`);
      console.log('Network Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const testAuthConnection = async () => {
    setLoading(true);
    setStatus('Testing auth connection...');

    try {
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        setStatus(`Auth Error: ${error.message}`);
        return;
      }

      setStatus('✅ Auth connection successful!');
    } catch (err: any) {
      setStatus(`Auth Network Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Supabase Connection Test</Text>
      <Text style={styles.status}>{status}</Text>
      
      <TouchableOpacity 
        style={styles.button} 
        onPress={testConnection}
        disabled={loading}
      >
        <Text style={styles.buttonText}>Test Database Connection</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.button} 
        onPress={testAuthConnection}
        disabled={loading}
      >
        <Text style={styles.buttonText}>Test Auth Connection</Text>
      </TouchableOpacity>

      <View style={styles.info}>
        <Text style={styles.infoText}>URL: https://nfzbvuyntzgszqdlsusj.supabase.co</Text>
        <Text style={styles.infoText}>Key: [REDACTED FOR SECURITY]</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  status: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 6,
    marginBottom: 10,
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: '600',
  },
  info: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 4,
  },
  infoText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
}); 