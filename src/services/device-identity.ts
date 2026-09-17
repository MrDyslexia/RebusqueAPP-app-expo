import * as Application from 'expo-application';
import { Platform } from 'react-native';

export class DeviceIdentityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeviceIdentityError';
  }
}

export async function getDeviceIdentifier(): Promise<string> {
  if (Platform.OS === 'android') {
    return `expo-${Application.getAndroidId()}`;
  }

  if (Platform.OS === 'ios') {
    const identifier = await Application.getIosIdForVendorAsync();

    if (identifier === null) {
      throw new DeviceIdentityError('El identificador de proveedor de iOS no está disponible temporalmente.');
    }

    return `expo-${identifier}`;
  }

  throw new DeviceIdentityError(
    `Los identificadores nativos del dispositivo no están disponibles en ${Platform.OS}.`,
  );
}
