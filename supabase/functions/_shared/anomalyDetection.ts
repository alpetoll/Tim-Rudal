export interface AnomalyResult {
  isAnomaly: boolean;
  type: 'Hujan Ekstrem' | 'Suhu Panas Ekstrem' | 'Angin Kencang' | null;
  value: number;
  message: string;
}

/**
 * Check if current daily weather readings trigger an extreme anomaly threshold.
 * 
 * @param rain Daily precipitation sum in mm
 * @param temp Daily max temperature in °C
 * @param wind Daily max windspeed in km/h
 * @param lahanNama Name of the monitored land plot
 */
export function checkWeatherAnomaly(
  rain: number,
  temp: number,
  wind: number,
  lahanNama: string
): AnomalyResult {
  if (rain > 50) {
    return {
      isAnomaly: true,
      type: 'Hujan Ekstrem',
      value: rain,
      message: `Peringatan Curah Hujan Ekstrem (${rain} mm) terdeteksi pada lahan ${lahanNama}. Risiko banjir/genangan tinggi! Segera siapkan sistem drainase darurat.`
    };
  }
  if (temp > 36) {
    return {
      isAnomaly: true,
      type: 'Suhu Panas Ekstrem',
      value: temp,
      message: `Peringatan Suhu Panas Ekstrem (${temp}°C) terdeteksi pada lahan ${lahanNama}. Risiko kekeringan! Siapkan suplai air tambahan.`
    };
  }
  if (wind > 30) {
    return {
      isAnomaly: true,
      type: 'Angin Kencang',
      value: wind,
      message: `Peringatan Angin Kencang (${wind} km/h) terdeteksi pada lahan ${lahanNama}. Waspada kerusakan tanaman tinggi.`
    };
  }
  return {
    isAnomaly: false,
    type: null,
    value: 0,
    message: ''
  };
}
