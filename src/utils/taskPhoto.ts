import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import i18n from '../i18n';

export async function takeTaskConfirmationPhoto(): Promise<string | undefined> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    Alert.alert(i18n.t('taskPhoto.permissionTitle'), i18n.t('taskPhoto.permissionBody'));
    return undefined;
  }

  const result = await ImagePicker.launchCameraAsync({
    quality: 0.8,
    allowsEditing: true,
  });

  if (result.canceled || !result.assets[0]) return undefined;
  return result.assets[0].uri;
}
