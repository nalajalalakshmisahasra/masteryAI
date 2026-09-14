import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type {
  KeyboardTypeOptions,
  ReturnKeyTypeOptions,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { PALETTE, RADIUS, SPACING, TOUCH_TARGET, TYPOGRAPHY } from '../../theme/tokens';
import { useLanguage } from '../../i18n/LanguageContext';
import { VoiceInputButton } from './VoiceInputButton';

export interface TextFieldProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  maxLength?: number;
  multiline?: boolean;
  numberOfLines?: number;
  secureTextEntry?: boolean;
  returnKeyType?: ReturnKeyTypeOptions;
  autoCorrect?: boolean;
  editable?: boolean;
  error?: string | null;
  helper?: string | null;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  /**
   * VOICE INPUT: renders a speech-to-text microphone next to the input. The
   * transcript is appended into this TextField's own value. Keep it off for
   * passwords, OTP/PIN, email, and phone fields.
   */
  enableVoiceInput?: boolean;
  /** Explicit language for recognition; defaults to the selected app language. */
  voiceInputLanguage?: string;
}

/**
 * Native text input with label, focus ring, inline error/helper text and a
 * disabled state. Focused state uses borderActive + a lighter surface so the
 * active field is obvious without any layout shift.
 *
 * With `enableVoiceInput`, a provider-agnostic VoiceInputButton sits inside
 * the field (right edge) and any transcription lands directly in this input.
 */
export const TextField: React.FC<TextFieldProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  maxLength,
  multiline = false,
  numberOfLines,
  secureTextEntry = false,
  returnKeyType,
  autoCorrect,
  editable = true,
  error,
  helper,
  style,
  accessibilityLabel,
  enableVoiceInput = false,
  voiceInputLanguage,
}) => {
  const { t } = useLanguage();
  const [isFocused, setIsFocused] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const hasError = Boolean(error);

  return (
    <View style={style}>
      {label ? <Text style={[TYPOGRAPHY.caption, styles.label]}>{label}</Text> : null}

      <View style={styles.inputRow}>
        <TextInput
          accessibilityLabel={accessibilityLabel || label || 'Text input'}
          accessibilityState={{ disabled: !editable }}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={PALETTE.textMuted}
          keyboardType={keyboardType}
          maxLength={maxLength}
          multiline={multiline}
          numberOfLines={multiline ? numberOfLines : undefined}
          secureTextEntry={secureTextEntry}
          returnKeyType={returnKeyType}
          autoCorrect={autoCorrect}
          editable={editable}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={[
            styles.input,
            multiline && styles.inputMultiline,
            isFocused && !hasError && styles.inputFocused,
            hasError && styles.inputError,
            !editable && styles.inputDisabled,
          ]}
        />

        {enableVoiceInput && editable ? (
          <View style={styles.micWrap}>
            <VoiceInputButton
              value={value}
              onChangeText={onChangeText}
              language={voiceInputLanguage}
              disabled={!editable}
              onErrorChange={setVoiceError}
              accessibilityLabel={
                accessibilityLabel || label
                  ? `${t('voiceSpeakA11y')}: ${accessibilityLabel || label}`
                  : undefined
              }
            />
          </View>
        ) : null}
      </View>

      {hasError ? (
        <Text style={[TYPOGRAPHY.footnote, styles.errorText]}>{error}</Text>
      ) : voiceError ? (
        <Text style={[TYPOGRAPHY.footnote, styles.errorText]}>{voiceError}</Text>
      ) : helper ? (
        <Text style={[TYPOGRAPHY.footnote, styles.helperText]}>{helper}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  label: {
    marginBottom: SPACING.xs,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  input: {
    flex: 1,
    minHeight: TOUCH_TARGET.minHeight,
    backgroundColor: PALETTE.inputBg,
    borderColor: PALETTE.surfaceBorder,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    color: PALETTE.textPrimary,
    fontSize: 15,
  },
  inputMultiline: {
    minHeight: 88,
    textAlignVertical: 'top',
    paddingTop: SPACING.md,
    paddingBottom: SPACING.md,
  },
  inputFocused: {
    borderColor: PALETTE.borderActive,
    backgroundColor: PALETTE.surfaceHighlight,
  },
  inputError: {
    borderColor: PALETTE.error,
  },
  inputDisabled: {
    opacity: 0.5,
  },
  micWrap: {
    justifyContent: 'center',
  },
  errorText: {
    color: PALETTE.error,
    marginTop: SPACING.xs,
  },
  helperText: {
    color: PALETTE.textMuted,
    marginTop: SPACING.xs,
  },
});
