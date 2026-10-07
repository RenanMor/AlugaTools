import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { Alert, Linking, Platform } from "react-native";

export type AppPermission = "notifications" | "location" | "camera";
export type PermissionState = "granted" | "denied" | "blocked" | "undetermined";

export const PERMISSION_LABELS: Record<AppPermission, { title: string; reason: string }> = {
  notifications: { title: "Notificações", reason: "Avisos sobre seus pedidos e entregas." },
  location: { title: "Localização", reason: "Preencher o endereço de entrega automaticamente." },
  camera: { title: "Câmera", reason: "Fotografar as ferramentas na entrega e nos anúncios." },
};

type PermissionResponse = { granted: boolean; canAskAgain: boolean; status: string };

const toState = (res: PermissionResponse): PermissionState => {
  if (res.granted) return "granted";
  if (res.status === "undetermined") return "undetermined";
  // Android stops showing the system dialog after the user denies twice.
  return res.canAskAgain ? "denied" : "blocked";
};

const getters: Record<AppPermission, () => Promise<PermissionResponse>> = {
  notifications: () => Notifications.getPermissionsAsync(),
  location: () => Location.getForegroundPermissionsAsync(),
  camera: () => ImagePicker.getCameraPermissionsAsync(),
};

const requesters: Record<AppPermission, () => Promise<PermissionResponse>> = {
  notifications: async () => {
    // Android 13+ only shows the notification prompt once a channel exists.
    await setupNotificationChannel();
    return Notifications.requestPermissionsAsync();
  },
  location: () => Location.requestForegroundPermissionsAsync(),
  camera: () => ImagePicker.requestCameraPermissionsAsync(),
};

export async function getPermissionState(permission: AppPermission): Promise<PermissionState> {
  try {
    return toState(await getters[permission]());
  } catch {
    return "undetermined";
  }
}

export async function getAllPermissionStates(): Promise<Record<AppPermission, PermissionState>> {
  const [notifications, location, camera] = await Promise.all([
    getPermissionState("notifications"),
    getPermissionState("location"),
    getPermissionState("camera"),
  ]);
  return { notifications, location, camera };
}

/**
 * Asks for a permission. When the system dialog can no longer be shown (the user
 * denied it before), offers to open the app settings instead.
 */
export async function ensurePermission(permission: AppPermission): Promise<boolean> {
  try {
    const current = await getters[permission]();
    if (current.granted) return true;
    if (current.canAskAgain) {
      const res = await requesters[permission]();
      if (res.granted) return true;
      if (res.canAskAgain) return false;
    }
  } catch (err) {
    console.warn(`[Permissions] ${permission}:`, err);
    return false;
  }

  const { title, reason } = PERMISSION_LABELS[permission];
  Alert.alert(
    `Permitir ${title.toLowerCase()}`,
    `${reason}\n\nA permissão foi negada. Ative em Configurações > Permissões.`,
    [
      { text: "Agora não", style: "cancel" },
      { text: "Abrir configurações", onPress: () => Linking.openSettings() },
    ],
  );
  return false;
}

export async function setupNotificationChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "Pedidos e entregas",
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: "#F97316",
  });
}

const FIRST_LAUNCH_KEY = "permissions_first_launch_asked";

/**
 * On the first launch of the native app, asks for notifications and location
 * (used across the app). The camera is asked when it is first used.
 */
export async function requestInitialPermissions(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    await setupNotificationChannel();

    if (await AsyncStorage.getItem(FIRST_LAUNCH_KEY)) return;
    await AsyncStorage.setItem(FIRST_LAUNCH_KEY, "1");

    for (const permission of ["notifications", "location"] as const) {
      const current = await getters[permission]();
      if (!current.granted && current.canAskAgain) {
        await requesters[permission]();
      }
    }
  } catch (err) {
    console.warn("[Permissions] initial request failed:", err);
  }
}

/**
 * Takes a photo (or picks one from the gallery) and returns it as a compressed
 * JPEG data URL, the same format the web version sends to the API.
 * Returns null when the user cancels or denies the permission.
 */
export async function pickPhoto(source: "camera" | "gallery", maxWidth = 1000, quality = 0.7): Promise<string | null> {
  if (source === "camera" && !(await ensurePermission("camera"))) return null;

  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 1 };
  const result =
    source === "camera"
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets?.length) return null;

  const asset = result.assets[0];
  const context = ImageManipulator.ImageManipulator.manipulate(asset.uri);
  if (asset.width > maxWidth) context.resize({ width: maxWidth });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ compress: quality, format: ImageManipulator.SaveFormat.JPEG, base64: true });
  return saved.base64 ? `data:image/jpeg;base64,${saved.base64}` : null;
}

/** Native-only chooser: "Câmera" or "Galeria". Resolves with the photo data URL. */
export function choosePhoto(title = "Adicionar foto", maxWidth?: number, quality?: number): Promise<string | null> {
  return new Promise((resolve) => {
    const pick = (source: "camera" | "gallery") => () =>
      pickPhoto(source, maxWidth, quality)
        .then(resolve)
        .catch((err) => {
          Alert.alert("Erro", err?.message || "Não foi possível obter a foto.");
          resolve(null);
        });
    Alert.alert(
      title,
      undefined,
      [
        { text: "Câmera", onPress: pick("camera") },
        { text: "Galeria", onPress: pick("gallery") },
        { text: "Cancelar", style: "cancel", onPress: () => resolve(null) },
      ],
      { cancelable: true, onDismiss: () => resolve(null) },
    );
  });
}

const UF_BY_STATE: Record<string, string> = {
  acre: "AC", alagoas: "AL", amapa: "AP", amazonas: "AM", bahia: "BA", ceara: "CE",
  "distrito federal": "DF", "espirito santo": "ES", goias: "GO", maranhao: "MA",
  "mato grosso": "MT", "mato grosso do sul": "MS", "minas gerais": "MG", para: "PA",
  paraiba: "PB", parana: "PR", pernambuco: "PE", piaui: "PI", "rio de janeiro": "RJ",
  "rio grande do norte": "RN", "rio grande do sul": "RS", rondonia: "RO", roraima: "RR",
  "santa catarina": "SC", "sao paulo": "SP", sergipe: "SE", tocantins: "TO",
};

const toUf = (region?: string | null) => {
  if (!region) return "";
  if (/^[A-Za-z]{2}$/.test(region.trim())) return region.trim().toUpperCase();
  const key = region.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/^estado d[eo] /i, "").trim().toLowerCase();
  return UF_BY_STATE[key] ?? "";
};

export type CurrentAddress = {
  cep: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
};

/** Current address of the device (reverse geocoding). Null if denied or unavailable. */
export async function getCurrentAddress(): Promise<CurrentAddress | null> {
  if (!(await ensurePermission("location"))) return null;
  if (!(await Location.hasServicesEnabledAsync())) {
    Alert.alert("Localização desativada", "Ative a localização (GPS) do aparelho e tente novamente.");
    return null;
  }
  const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  const [place] = await Location.reverseGeocodeAsync(position.coords);
  if (!place) return null;
  return {
    cep: (place.postalCode ?? "").replace(/\D/g, "").substring(0, 8),
    street: place.street ?? "",
    number: place.streetNumber ?? "",
    neighborhood: place.district ?? "",
    city: place.city ?? place.subregion ?? "",
    state: toUf(place.region),
  };
}
