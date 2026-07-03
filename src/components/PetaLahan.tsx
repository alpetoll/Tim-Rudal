'use client';

import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Lahan } from '../types';
import { MapPin, Check, RefreshCw, Layers } from 'lucide-react';

// Fix Leaflet marker icon issue in Next.js/Webpack
const getMarkerIcon = () => {
  return new L.Icon({
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
};

// Map Resizer component to fix Leaflet size container glitches
function MapResizer() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 300);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

// Map Click Handler Component
function MapClickHandler({ setPoints }: { setPoints: React.Dispatch<React.SetStateAction<[number, number][]>> }) {
  useMapEvents({
    click(e) {
      const newPoint: [number, number] = [e.latlng.lat, e.latlng.lng];
      setPoints(prev => [...prev, newPoint]);
    }
  });
  return null;
}

interface PetaLahanProps {
  onSaveLahan: (lahanData: Omit<Lahan, 'id' | 'status'>) => void;
  savedLahans: Lahan[];
  onClose: () => void;
  initialLahan?: Lahan; // For Edit Mode
}

export default function PetaLahan({ onSaveLahan, savedLahans, onClose, initialLahan }: PetaLahanProps) {
  const [points, setPoints] = useState<[number, number][]>(initialLahan?.koordinat || []);
  const [landName, setLandName] = useState(initialLahan?.nama || '');
  const [soilType, setSoilType] = useState<Lahan['jenisTanah']>(initialLahan?.jenisTanah || 'Lempung');
  const [drainage, setDrainage] = useState<Lahan['tipeDrainase']>(initialLahan?.tipeDrainase || 'Baik');
  const [pestHistory, setPestHistory] = useState<Lahan['riwayatHama']>(initialLahan?.riwayatHama || 'Tidak');
  const [pHLevel, setPHLevel] = useState<string>(initialLahan?.pH || 'Netral (6.5 - 7.5)');
  
  // Custom Map Layer Toggle State
  const [isSatellite, setIsSatellite] = useState(false);

  // Simulated geospasial stats calculated from drawn points
  const [stats, setStats] = useState<{
    ketinggian: number;
    curahHujan: number;
    suhu: number;
    luas: number;
  } | null>(initialLahan ? {
    ketinggian: initialLahan.ketinggian,
    curahHujan: initialLahan.curahHujan,
    suhu: initialLahan.suhu,
    luas: initialLahan.luas
  } : null);

  // Calculate polygon area (using simplified flat earth math for small agricultural plots)
  const calculateArea = (coords: [number, number][]) => {
    if (coords.length < 3) return 0;
    
    // Shoelace formula in coordinate degrees scaled to approx meters
    let totalArea = 0;
    const factor = 111300; // 1 degree lat ≈ 111.3km
    
    for (let i = 0; i < coords.length; i++) {
      const j = (i + 1) % coords.length;
      const x1 = coords[i][1] * factor * Math.cos(coords[i][0] * Math.PI / 180);
      const y1 = coords[i][0] * factor;
      const x2 = coords[j][1] * factor * Math.cos(coords[j][0] * Math.PI / 180);
      const y2 = coords[j][0] * factor;
      
      totalArea += (x1 * y2) - (x2 * y1);
    }
    
    return Math.abs(totalArea / 2);
  };

  // Get centroid of coords
  const getCentroid = (coords: [number, number][]): [number, number] => {
    if (coords.length === 0) return [-7.15, 110.14]; // Default Central Java
    const lats = coords.map(c => c[0]);
    const lngs = coords.map(c => c[1]);
    const avgLat = lats.reduce((sum, val) => sum + val, 0) / coords.length;
    const avgLng = lngs.reduce((sum, val) => sum + val, 0) / coords.length;
    return [avgLat, avgLng];
  };

  // Simulated geospatial data based on Central Java coordinates
  useEffect(() => {
    if (points.length >= 3) {
      const [lat, lng] = getCentroid(points);
      const luas = Math.round(calculateArea(points));

      // Elevation simulation: more mountainous in southern central Java (e.g. Dieng, Merbabu)
      // Lat -7.2 to -7.4 is generally higher elevation
      const latDiff = Math.abs(lat - (-7.0));
      const elevationBase = Math.sin(latDiff * 10) * 1200 + 150;
      const ketinggian = Math.max(10, Math.round(elevationBase + (lng % 0.1) * 3000));

      // Temperature drops with altitude: lapse rate of 0.65C per 100m
      const baseTemp = 31.2;
      const suhu = Math.round((baseTemp - (ketinggian / 100) * 0.65) * 10) / 10;

      // Rainfall simulation: higher in wet volcanic soils
      const curahHujan = Math.round(140 + (ketinggian / 10) + (Math.sin(lng * 5) * 40));

      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStats({
        ketinggian: Math.min(2200, Math.max(5, ketinggian)),
        curahHujan: Math.min(400, Math.max(40, curahHujan)),
        suhu: Math.min(36, Math.max(12, suhu)),
        luas
      });
    } else {
      setStats(null);
    }
  }, [points]);

  const handleReset = () => {
    setPoints([]);
  };

  const handleSave = () => {
    if (!landName.trim()) {
      alert('Silakan masukkan nama lahan terlebih dahulu.');
      return;
    }
    if (points.length < 3) {
      alert('Silakan tandai minimal 3 titik di peta untuk membentuk batas lahan.');
      return;
    }

    if (stats) {
      onSaveLahan({
        nama: landName,
        luas: stats.luas,
        koordinat: points,
        centroid: getCentroid(points),
        ketinggian: stats.ketinggian,
        curahHujan: stats.curahHujan,
        suhu: stats.suhu,
        tipeDrainase: drainage,
        jenisTanah: soilType,
        riwayatHama: pestHistory,
        pH: pHLevel,
      });
      handleReset();
      setLandName('');
    }
  };

  return (
    <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6 h-auto lg:h-[calc(100vh-12rem)] lg:min-h-[500px]">
      
      {/* Peta Geospatial (Leaflet) */}
      <div className="lg:col-span-2 relative border border-white/10 rounded-2xl overflow-hidden h-[400px] lg:h-full shrink-0">
        <button 
          onClick={() => setIsSatellite(!isSatellite)}
          className="absolute top-3 right-3 z-[400] bg-bg-card/90 hover:bg-bg-card backdrop-blur-md px-3 py-2 rounded-xl border border-white/20 shadow-lg flex items-center gap-2 text-xs font-semibold text-primary-light transition-all cursor-pointer"
        >
          <Layers className="w-4 h-4" />
          <span>{isSatellite ? 'Ubah ke Peta Jalan' : 'Ubah ke Satelit'}</span>
        </button>

        <MapContainer 
          center={initialLahan ? initialLahan.centroid : [-7.150, 110.140]} 
          zoom={initialLahan ? 15 : 10} 
          scrollWheelZoom={true}
          style={{ width: '100%', height: '100%' }}
        >
          <TileLayer
            key={isSatellite ? 'sat' : 'osm'}
            attribution={isSatellite 
              ? 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
              : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }
            url={isSatellite 
              ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
              : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
            }
          />
          <MapResizer />
          <MapClickHandler setPoints={setPoints} />

          {/* Render markers for currently being drawn points */}
          {points.map((pt, idx) => (
            <Marker 
              key={`new-pt-${idx}`} 
              position={pt} 
              icon={getMarkerIcon()}
            >
              <Popup>Titik {idx + 1}</Popup>
            </Marker>
          ))}

          {/* Render polygon line representing current shape */}
          {points.length >= 3 && (
            <Polygon 
              positions={points} 
              pathOptions={{ fillColor: '#00a859', fillOpacity: 0.25, color: '#22c55e', weight: 3 }} 
            />
          )}

          {/* Render previously saved lands */}
          {savedLahans.map((lahan) => (
            <Polygon
              key={lahan.id}
              positions={lahan.koordinat}
              pathOptions={{
                fillColor: lahan.status === 'sedang-ditanam' ? '#22c55e' : lahan.status === 'siap-panen' ? '#f59e0b' : '#3b82f6',
                fillOpacity: 0.15,
                color: lahan.status === 'sedang-ditanam' ? '#10b981' : lahan.status === 'siap-panen' ? '#f59e0b' : '#3b82f6',
                weight: 2,
                dashArray: '4'
              }}
            >
              <Popup>
                <div className="text-sm">
                  <h4 className="font-bold text-gray-900">{lahan.nama}</h4>
                  <p className="text-gray-600 text-xs">Luas: {lahan.luas.toLocaleString('id-ID')} m²</p>
                  <p className="text-gray-600 text-xs">Status: <span className="font-semibold capitalize text-emerald-700">{lahan.status}</span></p>
                </div>
              </Popup>
            </Polygon>
          ))}
        </MapContainer>
        
        {points.length > 0 && (
          <button 
            onClick={handleReset}
            className="absolute bottom-4 right-4 z-[400] bg-red-600 hover:bg-red-700 text-white font-bold p-2.5 rounded-full shadow-lg flex items-center justify-center gap-1.5 transition-all text-xs"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Reset Titik</span>
          </button>
        )}
      </div>

      {/* Form Data Lahan & Deteksi Sensor */}
      <div className="bg-bg-card border border-white/10 rounded-2xl p-6 overflow-y-auto flex flex-col justify-between">
        <div>
          <h3 className="text-xl font-bold mb-5 flex items-center gap-2 text-white border-b border-white/5 pb-3">
            <MapPin className="w-5 h-5 text-primary-light" />
            <span>Informasi Lahan</span>
          </h3>

          {/* Nama Lahan */}
          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Nama Lahan / Sawah</label>
            <input 
              type="text" 
              placeholder="Contoh: Sawah Lor 01" 
              value={landName}
              onChange={(e) => setLandName(e.target.value)}
              className="w-full bg-bg-dark border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-all text-sm"
            />
          </div>

          {/* Peta Instruction/Status */}
          {points.length < 3 ? (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-4 text-xs text-primary-light leading-relaxed">
              <strong>Panduan:</strong> Klik minimal 3 kali pada peta di sebelah kiri untuk menandai sudut-sudut bidang sawah Anda. Peta akan otomatis terhubung membentuk bidang poligon.
            </div>
          ) : (
            <div className="bg-bg-dark border border-white/10 rounded-xl p-4 mb-4 grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-gray-500 block mb-0.5">Luas Lahan</span>
                <strong className="text-white text-sm">{stats ? stats.luas.toLocaleString('id-ID') : 0} m²</strong>
              </div>
              <div>
                <span className="text-gray-500 block mb-0.5">Ketinggian</span>
                <strong className="text-white text-sm">{stats ? stats.ketinggian : 0} mdpl</strong>
              </div>
              <div className="mt-1">
                <span className="text-gray-500 block mb-0.5">Suhu Rata-rata</span>
                <strong className="text-white text-sm">{stats ? stats.suhu : 0} °C</strong>
              </div>
              <div className="mt-1">
                <span className="text-gray-500 block mb-0.5">Curah Hujan</span>
                <strong className="text-white text-sm">{stats ? stats.curahHujan : 0} mm/bln</strong>
              </div>
            </div>
          )}

          {/* Titik Koordinat Terpilih */}
          {points.length > 0 && (
            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Titik Koordinat ({points.length})</label>
              <div className="bg-bg-dark border border-white/10 rounded-xl p-3 max-h-32 overflow-y-auto space-y-2">
                {points.map((pt, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs border-b border-white/5 pb-2 last:border-0 last:pb-0">
                    <span className="text-gray-400">P{idx + 1}</span>
                    <span className="text-white font-mono bg-white/5 px-2 py-1 rounded tracking-tight">
                      {pt[0].toFixed(5)}, {pt[1].toFixed(5)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Detail Karakteristik Tanah (Manual Input) */}
          <div className="space-y-4 border-t border-white/5 pt-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Jenis Tanah</label>
              <select 
                value={soilType}
                onChange={(e) => setSoilType(e.target.value as Lahan['jenisTanah'])}
                className="w-full bg-bg-dark border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-all text-sm mb-4"
              >
                <option value="Humus">Tanah Humus (Subur/Organik)</option>
                <option value="Lempung">Tanah Lempung (Baik Tahan Air)</option>
                <option value="Pasir">Tanah Pasir (Sarang Air/Poros)</option>
                <option value="Gambut">Tanah Gambut (Asam/Rawa)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Tingkat Keasaman (pH)</label>
              <select 
                value={pHLevel}
                onChange={(e) => setPHLevel(e.target.value)}
                className="w-full bg-bg-dark border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-all text-sm"
              >
                <option value="Sangat Asam (< 5.5)">Sangat Asam (&lt; 5.5)</option>
                <option value="Asam (5.5 - 6.5)">Asam (5.5 - 6.5)</option>
                <option value="Netral (6.5 - 7.5)">Netral (6.5 - 7.5) - Optimal</option>
                <option value="Basa (> 7.5)">Basa (&gt; 7.5)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Drainase Air</label>
                <select 
                  value={drainage}
                  onChange={(e) => setDrainage(e.target.value as Lahan['tipeDrainase'])}
                  className="w-full bg-bg-dark border border-white/10 rounded-xl px-3 py-3 text-white focus:outline-none focus:border-primary transition-all text-xs"
                >
                  <option value="Baik">Saluran Baik</option>
                  <option value="Buruk">Saluran Lamban/Menggenang</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Riwayat Hama</label>
                <select 
                  value={pestHistory}
                  onChange={(e) => setPestHistory(e.target.value as Lahan['riwayatHama'])}
                  className="w-full bg-bg-dark border border-white/10 rounded-xl px-3 py-3 text-white focus:outline-none focus:border-primary transition-all text-xs"
                >
                  <option value="Tidak">Bebas Hama</option>
                  <option value="Ada">Sering Terserang Hama</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6 border-t border-white/5 pt-4">
          <button 
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl border border-white/10 hover:bg-white/5 text-gray-300 font-semibold text-sm transition-all text-center"
          >
            Batal
          </button>
          <button 
            onClick={handleSave}
            disabled={points.length < 3}
            className="flex-1 py-3 px-4 rounded-xl bg-primary hover:bg-emerald-600 disabled:bg-emerald-950/40 disabled:text-emerald-700/60 text-white font-bold text-sm transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-primary/20"
          >
            <Check className="w-4 h-4" />
            <span>{initialLahan ? 'Perbarui Lahan' : 'Simpan Lahan'}</span>
          </button>
        </div>
      </div>

    </div>
  );
}
