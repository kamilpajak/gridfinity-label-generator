export interface DINStandard {
  value: string;
  text: string;
  image: string;
}

export interface HardwareType {
  type: "Screw" | "Nut" | "Washer";
  system: "Metric" | "Imperial";
}

export interface LabelSettings {
  showStandardName: boolean;
  showImage: boolean;
  labelWidth: number;
  showQrCode: boolean;
  qrCodeContent: string;
}
