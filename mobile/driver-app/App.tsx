import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { apiBaseUrl, apiLogin, apiMe, type AuthUser } from './src/api';

const TOKEN_KEY = 'driver_app_token';

export default function App() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      try {
        const storedToken = await AsyncStorage.getItem(TOKEN_KEY);
        if (!storedToken) {
          return;
        }

        const currentUser = await apiMe(storedToken);

        if (!mounted) {
          return;
        }

        setToken(storedToken);
        setUser(currentUser);
      } catch {
        await AsyncStorage.removeItem(TOKEN_KEY);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    bootstrap();

    return () => {
      mounted = false;
    };
  }, []);

  const canSubmit = useMemo(() => email.trim() !== '' && password.trim() !== '', [email, password]);

  const onLogin = async () => {
    if (!canSubmit) {
      return;
    }

    setSubmitting(true);

    try {
      const payload = await apiLogin(email.trim(), password);
      await AsyncStorage.setItem(TOKEN_KEY, payload.token);
      setToken(payload.token);
      setUser(payload.user);
      setPassword('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro inesperado no login';
      Alert.alert('Não foi possível entrar', message);
    } finally {
      setSubmitting(false);
    }
  };

  const onRefreshProfile = async () => {
    if (!token) {
      return;
    }

    setSubmitting(true);
    try {
      const currentUser = await apiMe(token);
      setUser(currentUser);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao atualizar perfil';
      Alert.alert('Sessão inválida', message);
      await onLogout();
    } finally {
      setSubmitting(false);
    }
  };

  const onLogout = async () => {
    await AsyncStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setPassword('');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.helper}>Carregando sessão...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <View style={styles.card}>
        <Text style={styles.title}>Kaique Motorista</Text>
        <Text style={styles.helper}>API: {apiBaseUrl}</Text>

        {!user ? (
          <>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="Email"
              style={styles.input}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="Senha"
              style={styles.input}
            />
            <Pressable style={[styles.button, !canSubmit && styles.buttonDisabled]} disabled={!canSubmit || submitting} onPress={onLogin}>
              <Text style={styles.buttonText}>{submitting ? 'Entrando...' : 'Entrar'}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.info}>Logado como:</Text>
            <Text style={styles.value}>{user.name}</Text>
            <Text style={styles.value}>{user.email}</Text>
            <Text style={styles.info}>Perfil: {user.role ?? 'sem role'}</Text>

            <Pressable style={styles.button} disabled={submitting} onPress={onRefreshProfile}>
              <Text style={styles.buttonText}>{submitting ? 'Atualizando...' : 'Atualizar perfil'}</Text>
            </Pressable>

            <Pressable style={[styles.button, styles.buttonGhost]} onPress={onLogout}>
              <Text style={styles.buttonGhostText}>Sair</Text>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    padding: 20,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  helper: {
    color: '#6b7280',
    fontSize: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: '#111827',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  buttonGhost: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#111827',
  },
  buttonGhostText: {
    color: '#111827',
    fontWeight: '600',
  },
  info: {
    color: '#374151',
    fontWeight: '600',
  },
  value: {
    color: '#111827',
    fontSize: 16,
  },
});
