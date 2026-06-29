import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SectionHeader } from '../components/CommonComponents';
import { generateCloudGeminiContent, cloudGeminiRegionLabel, isCloudGeminiAvailable } from '../native/GeminiCloud';
import {
  generateAzureChatContent,
  isAzureChatAvailable,
  azureChatModelLabel,
  type ChatBackend,
} from '../native/AzureChat';
import { colors } from '../theme/colors';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  latencyMs?: number;
  source?: ChatBackend;
}

export function ChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'system',
      text: 'Chat with Azure ChatGPT or Cloud Gemini. Ask about site diary, safety, or progress.',
    },
  ]);
  const [input, setInput] = useState('');
  const [backend, setBackend] = useState<ChatBackend>(isAzureChatAvailable ? 'azure' : 'cloud');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    const prompt = input.trim();
    const canUseAzure = backend === 'azure' && isAzureChatAvailable;
    const canUseCloud = backend === 'cloud' && isCloudGeminiAvailable;
    if (!prompt || sending || (!canUseAzure && !canUseCloud)) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: prompt,
    };
    setMessages((current) => [...current, userMessage]);
    setInput('');
    setSending(true);

    try {
      const response =
        backend === 'cloud'
          ? await generateCloudGeminiContent(prompt)
          : await generateAzureChatContent(prompt);

      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          text: response.text || '(No response text returned)',
          latencyMs: response.latencyMs,
          source: response.source,
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: `error-${Date.now()}`,
          role: 'system',
          text: error instanceof Error ? error.message : 'Chat request failed.',
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const chatReady =
    (backend === 'azure' && isAzureChatAvailable) ||
    (backend === 'cloud' && isCloudGeminiAvailable);
  const canSend = chatReady && !sending && input.trim().length > 0;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      <SectionHeader
        title="AI chat"
        description="Azure ChatGPT vs Cloud Gemini for site diary questions"
      />

      <View style={styles.backendRow}>
        <Pressable
          style={[styles.backendChip, backend === 'azure' && styles.backendChipActive]}
          onPress={() => setBackend('azure')}
        >
          <Text style={[styles.backendChipText, backend === 'azure' && styles.backendChipTextActive]}>
            Azure ChatGPT
          </Text>
        </Pressable>
        <Pressable
          style={[styles.backendChip, backend === 'cloud' && styles.backendChipActive]}
          onPress={() => setBackend('cloud')}
        >
          <Text style={[styles.backendChipText, backend === 'cloud' && styles.backendChipTextActive]}>
            Cloud Gemini
          </Text>
        </Pressable>
      </View>

      {backend === 'azure' ? (
        <View
          style={[
            styles.statusBanner,
            isAzureChatAvailable ? styles.statusAvailable : styles.statusUnavailable,
          ]}
        >
          <Ionicons
            name={isAzureChatAvailable ? 'cloud-done-outline' : 'alert-circle-outline'}
            size={18}
            color={isAzureChatAvailable ? colors.success : colors.error}
          />
          <View style={styles.statusCopy}>
            <Text style={styles.statusText}>
              {isAzureChatAvailable
                ? `Azure OpenAI (${azureChatModelLabel}).`
                : 'Azure ChatGPT is not configured. Set EXPO_PUBLIC_AZURE_OPENAI_API_KEY in .env.'}
            </Text>
          </View>
        </View>
      ) : (
        <View style={[styles.statusBanner, styles.statusPending]}>
          <Ionicons name="cloud-outline" size={18} color={colors.primary} />
          <View style={styles.statusCopy}>
            <Text style={styles.statusText}>
              {isCloudGeminiAvailable
                ? `Cloud Gemini via Vertex AI (${cloudGeminiRegionLabel}).`
                : 'Cloud Gemini is unavailable.'}
            </Text>
          </View>
        </View>
      )}

      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View
            style={[
              styles.bubble,
              item.role === 'user' ? styles.userBubble : styles.assistantBubble,
              item.role === 'system' ? styles.systemBubble : undefined,
            ]}
          >
            <Text
              style={[
                styles.bubbleText,
                item.role === 'user' ? styles.userBubbleText : undefined,
              ]}
            >
              {item.text}
            </Text>
            {item.latencyMs != null ? (
              <Text style={styles.latency}>
                {item.source === 'cloud' ? 'Cloud' : 'Azure'} · {item.latencyMs} ms
              </Text>
            ) : null}
          </View>
        )}
      />

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder={
            chatReady
              ? 'Ask about site diary, safety, or progress...'
              : backend === 'cloud'
                ? 'Cloud Gemini unavailable'
                : 'Azure ChatGPT not configured'
          }
          value={input}
          onChangeText={setInput}
          editable={chatReady && !sending}
          multiline
        />
        <Pressable
          style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!canSend}
        >
          {sending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Ionicons name="send" size={20} color="#fff" />
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  backendRow: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  backendChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  backendChipActive: {
    borderColor: colors.primary,
    backgroundColor: '#E3F2FD',
  },
  backendChipText: {
    color: colors.textMuted,
    fontWeight: '600',
    fontSize: 13,
  },
  backendChipTextActive: {
    color: colors.primary,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusCopy: {
    flex: 1,
  },
  statusAvailable: {
    backgroundColor: '#E8F5E9',
    borderColor: colors.success,
  },
  statusPending: {
    backgroundColor: '#FFF3E0',
    borderColor: colors.secondary,
  },
  statusUnavailable: {
    backgroundColor: '#FFEBEE',
    borderColor: colors.error,
  },
  statusText: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  bubble: {
    maxWidth: '88%',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  systemBubble: {
    alignSelf: 'center',
    backgroundColor: '#ECEFF1',
    maxWidth: '100%',
  },
  bubbleText: {
    color: colors.text,
    lineHeight: 20,
  },
  userBubbleText: {
    color: '#fff',
  },
  latency: {
    marginTop: 8,
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: colors.background,
    color: colors.text,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
