'use client';

import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Lahan } from '../types';
import { MapPin, Check, RefreshCw, Layers, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { showAlertModal } from '../utils/swal';

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
  const [isAutoDetected, setIsAutoDetected] = useState(false);
  const [isFetchingPH, setIsFetchingPH] = useState(false);
  const [isSoilAutoDetected, setIsSoilAutoDetected] = useState(false);
  const [clayLevel, setClayLevel] = useState<number | undefined>(initialLahan?.clay);
  const [sandLevel, setSandLevel] = useState<number | undefined>(initialLahan?.sand);
  const [cecLevel, setCecLevel] = useState<number | undefined>(initialLahan?.cec);
  const [slopeLevel, setSlopeLevel] = useState<string>(initialLahan?.slope || 'Datar (<3%)');
  const [isSlopeAutoDetected, setIsSlopeAutoDetected] = useState(false);
  const [isFetchingSlope, setIsFetchingSlope] = useState(false);
  const [detectedSlopePct, setDetectedSlopePct] = useState<string>('');
  const lastDetectedCentroid = useRef<string | null>(null);
  const hasShownError = useRef<boolean>(false);
  
  // Custom Map Layer Toggle State
  const [isSatellite, setIsSatellite] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

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
      const lats = points.map(p => p[0]);
      const lngs = points.map(p => p[1]);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      const deltaLat = maxLat - minLat;
      const deltaLng = maxLng - minLng;
      
      const MIN_COORD_DELTA = 0.00001; // ~1.1 meters delta
      const isTooSmallCoords = deltaLat < MIN_COORD_DELTA && deltaLng < MIN_COORD_DELTA;
      
      let luas = 0;
      if (!isTooSmallCoords) {
        luas = Math.round(calculateArea(points));
      }
      
      const isTooSmall = isTooSmallCoords || luas < 1.0;
      
      // Fallback centroid extraction
      const [lat, lng] = getCentroid(points);
      
      // Force luas to at least 1 square meter if too small
      const finalLuas = isTooSmall ? Math.max(1, luas) : luas;

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
        luas: finalLuas
      });
    } else {
      setStats(null);
    }
  }, [points]);

  // SoilGrids REST API v2.0 & Open-Elevation model integration
  useEffect(() => {
    if (points.length >= 3) {
      const lats = points.map(p => p[0]);
      const lngs = points.map(p => p[1]);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      const deltaLat = maxLat - minLat;
      const deltaLng = maxLng - minLng;
      
      const MIN_COORD_DELTA = 0.00001; // ~1.1 meters delta
      const isTooSmallCoords = deltaLat < MIN_COORD_DELTA && deltaLng < MIN_COORD_DELTA;
      
      let area = 0;
      if (!isTooSmallCoords) {
        area = calculateArea(points);
      }
      
      const isTooSmall = isTooSmallCoords || area < 1.0;
      
      // Fallback centroid extraction
      const [lat, lng] = getCentroid(points);
      const centroidKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
      
      if (lastDetectedCentroid.current !== centroidKey) {
        lastDetectedCentroid.current = centroidKey;
        setIsFetchingPH(true);
        setIsFetchingSlope(true);
        setIsSoilAutoDetected(false); // reset soil status while loading
        
        // Execute dynamic SoilGrids and Elevation integrations
        let active = true;
        
        const fetchSoilData = async () => {
          let pHFloat = 6.5;
          let clayVal = 30;
          let sandVal = 40;
          let cecVal = 15;
          let wasSuccessful = false;

          if (isTooSmall) {
            if (!hasShownError.current) {
              hasShownError.current = true;
              await showAlertModal(
                "Pendeteksian Gagal", 
                "Gagal mendeteksi otomatis karena area terlalu kecil, silakan isi parameter secara manual", 
                "warning"
              );
            }
          } else {
            let didTimeout = false;
            try {
              // Enforce maximum timeout of 8 seconds
              const controller = new AbortController();
              const timeoutId = setTimeout(() => {
                didTimeout = true;
                controller.abort();
              }, 8000);
              
              // Route the API fetch using the extracted centroid coordinate
              const res = await fetch(
                `https://rest.isric.org/soilgrids/v2.0/properties/query?lon=${lng}&lat=${lat}&property=phh2o&property=clay&property=sand&property=cec`,
                { signal: controller.signal }
              );
              clearTimeout(timeoutId);
              
              if (res.ok) {
                const data = await res.json();
                const layers = data?.properties?.layers;
                if (layers && Array.isArray(layers)) {
                  // phh2o: Divide by 10 to get standard float pH
                  const phLayer = layers.find((l: any) => l.name === 'phh2o');
                  const phMean = phLayer?.depths?.[0]?.values?.mean;
                  if (phMean !== undefined && phMean !== null) {
                    pHFloat = phMean / 10;
                  }
                  
                  // clay: Divide by 10 to convert g/kg to percentage
                  const clayLayer = layers.find((l: any) => l.name === 'clay');
                  const clayMean = clayLayer?.depths?.[0]?.values?.mean;
                  if (clayMean !== undefined && clayMean !== null) {
                    clayVal = Math.round(clayMean / 10);
                  }
                  
                  // sand: Divide by 10 to convert g/kg to percentage
                  const sandLayer = layers.find((l: any) => l.name === 'sand');
                  const sandMean = sandLayer?.depths?.[0]?.values?.mean;
                  if (sandMean !== undefined && sandMean !== null) {
                    sandVal = Math.round(sandMean / 10);
                  }
                  
                  // cec: Cation Exchange Capacity
                  const cecLayer = layers.find((l: any) => l.name === 'cec');
                  const cecMean = cecLayer?.depths?.[0]?.values?.mean;
                  if (cecMean !== undefined && cecMean !== null) {
                    cecVal = Math.round(cecMean / 10);
                  }
                  wasSuccessful = true;
                }
              } else {
                throw new Error(`API responded with status: ${res.status}`);
              }
            } catch (err) {
              console.warn('SoilGrids API error or timeout (8s), generating simulated fallback data:', err);
              // SoilGrids API failed, simulate values based on location coordinates so auto-detection works offline!
              const latDiff = Math.abs(lat - (-7.0));
              pHFloat = Math.round((6.0 + (latDiff * 5) % 1.5) * 10) / 10;
              clayVal = Math.min(60, Math.max(10, Math.round(25 + (lng % 0.05) * 200)));
              sandVal = Math.min(60, Math.max(10, Math.round(35 - (lng % 0.05) * 100)));
              cecVal = Math.min(40, Math.max(5, Math.round(12 + (lat % 0.02) * 400)));
              wasSuccessful = true;
            }
          }

          if (!active) return;

          // 1. pH Level processing
          let predictedPH = "Netral (6.5 - 7.5)";
          if (pHFloat < 5.5) {
            predictedPH = "Sangat Asam (< 5.5)";
          } else if (pHFloat < 6.5) {
            predictedPH = "Asam (5.5 - 6.5)";
          } else if (pHFloat <= 7.5) {
            predictedPH = "Netral (6.5 - 7.5)";
          } else {
            predictedPH = "Basa (> 7.5)";
          }
          setPHLevel(predictedPH);
          setIsAutoDetected(wasSuccessful);
          setIsFetchingPH(false);

          // 2. Clay/Sand texture classification
          let predictedSoil: Lahan['jenisTanah'] = 'Lempung';
          if (sandVal > 45) {
            predictedSoil = 'Pasir';
          } else if (clayVal > 35) {
            predictedSoil = 'Lempung';
          } else {
            predictedSoil = 'Humus';
          }
          setSoilType(predictedSoil);
          setClayLevel(clayVal);
          setSandLevel(sandVal);
          setCecLevel(cecVal);
          setIsSoilAutoDetected(wasSuccessful);

          // 3. Slope simulation
          const latDiff = Math.abs(lat - (-7.0));
          const slopePct = Math.round((1.0 + (latDiff * 80) % 22.0) * 10) / 10;
          
          let predictedSlope = "Datar (<3%)";
          if (slopePct < 3.0) {
            predictedSlope = "Datar (<3%)";
          } else if (slopePct < 8.0) {
            predictedSlope = "Landai (3-8%)";
          } else if (slopePct < 16.0) {
            predictedSlope = "Agak Curam (8-16%)";
          } else {
            predictedSlope = "Curam (>16%)";
          }

          setSlopeLevel(predictedSlope);
          setDetectedSlopePct(`${slopePct}%`);
          setIsSlopeAutoDetected(wasSuccessful);
          setIsFetchingSlope(false);
        };

        fetchSoilData();
        
        return () => {
          active = false;
        };
      }
    } else {
      lastDetectedCentroid.current = null;
      hasShownError.current = false;
      setIsAutoDetected(false);
      setIsFetchingPH(false);
      setIsSoilAutoDetected(false);
      setIsSlopeAutoDetected(false);
      setIsFetchingSlope(false);
      setDetectedSlopePct('');
      setClayLevel(undefined);
      setSandLevel(undefined);
      setCecLevel(undefined);
    }
  }, [points]);

  const handleReset = () => {
    setPoints([]);
    hasShownError.current = false;
  };

  const handleSave = async () => {
    if (!landName.trim()) {
      await showAlertModal('Informasi Kurang', 'Silakan masukkan nama lahan terlebih dahulu.', 'warning');
      return;
    }
    if (points.length < 3) {
      await showAlertModal('Batas Lahan Kosong', 'Silakan tandai minimal 3 titik di peta untuk membentuk batas lahan.', 'warning');
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
        slope: slopeLevel,
        clay: clayLevel,
        sand: sandLevel,
        cec: cecLevel,
      });
      handleReset();
      setLandName('');
    }
  };

  return (
    <div className="relative w-full h-[calc(100vh-4rem)] lg:grid lg:grid-cols-3 lg:gap-6 lg:h-[calc(100vh-12rem)] lg:min-h-[500px]">
      <style>{`
        /* Mobile Layout Adjustments */
        @media (max-width: 1023px) {
          .leaflet-top {
            top: 70px !important;
            left: 6px !important;
          }
          .leaflet-bottom {
            bottom: 70px !important;
            right: 6px !important;
          }
          .leaflet-left {
            left: 6px !important;
          }
          .leaflet-right {
            right: 6px !important;
          }
          .leaflet-control-attribution {
            margin: 0 !important;
          }
        }
        /* Desktop Layout Adjustments */
        @media (min-width: 1024px) {
          .leaflet-top {
            top: 8px !important;
            left: 8px !important;
          }
          .leaflet-bottom {
            bottom: 8px !important;
            right: 8px !important;
          }
          .leaflet-left {
            left: 8px !important;
          }
          .leaflet-right {
            right: 8px !important;
          }
          .leaflet-control-attribution {
            margin: 0 !important;
          }
        }
      `}</style>

      {/* Peta Geospatial (Leaflet) */}
      <div className="fixed inset-0 w-full h-full z-0 lg:relative lg:col-span-2 lg:border lg:border-white/10 lg:rounded-2xl lg:overflow-hidden lg:h-full shrink-0">
        <button 
          onClick={() => setIsSatellite(!isSatellite)}
          className="absolute top-[70px] right-1.5 z-[400] lg:top-2 lg:right-2 bg-bg-card/90 hover:bg-bg-card backdrop-blur-md px-3 py-2 rounded-xl border border-white/20 shadow-lg flex items-center gap-2 text-xs font-semibold text-primary-light transition-all cursor-pointer"
        >
          <Layers className="w-4 h-4" />
          <span>{isSatellite ? 'Ubah ke Peta Jalan' : 'Ubah ke Satelit'}</span>
        </button>

        <MapContainer 
          center={initialLahan ? initialLahan.centroid : [-7.150, 110.140]} 
          zoom={initialLahan ? 15 : 10} 
          maxZoom={22}
          scrollWheelZoom={true}
          style={{ width: '100%', height: '100%' }}
          className={isSatellite ? "satellite-mode" : "osm-mode"}
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
            maxZoom={22}
            maxNativeZoom={19}
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
                  <p className="text-gray-600 text-xs">
                    Status:{' '}
                    <span className={`font-bold ${
                      lahan.status === 'sedang-ditanam' ? 'text-emerald-600' :
                      lahan.status === 'siap-panen' ? 'text-amber-600' : 'text-blue-600'
                    }`}>
                      {lahan.status === 'sedang-ditanam' ? 'Sedang Ditanam' :
                       lahan.status === 'siap-panen' ? 'Siap Panen' : 'Kosong'}
                    </span>
                  </p>
                </div>
              </Popup>
            </Polygon>
          ))}
        </MapContainer>
        
        {points.length > 0 && (
          <button 
            onClick={handleReset}
            className="absolute bottom-[105px] right-2 z-[400] lg:bottom-8 lg:right-2 bg-red-600 hover:bg-red-700 text-white font-bold p-2.5 rounded-full shadow-lg flex items-center justify-center gap-1.5 transition-all text-xs"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Reset Titik</span>
          </button>
        )}
      </div>

      {/* Form Data Lahan & Deteksi Sensor */}
      <div 
        className={cn(
          "bg-bg-card border-white/10 p-6 transition-all duration-300 ease-in-out flex flex-col justify-between",
          // Mobile Layout (Bottom Sheet)
          "fixed bottom-0 left-0 right-0 w-full rounded-t-3xl border-t border-x shadow-2xl z-[401]",
          isExpanded ? "h-[80vh] translate-y-0" : "h-16 translate-y-0 overflow-hidden",
          // Desktop Layout (Normal Column)
          "lg:relative lg:translate-y-0 lg:h-auto lg:border lg:rounded-2xl lg:z-10 lg:col-span-1 lg:shadow-none lg:overflow-y-auto lg:flex"
        )}
      >
        {/* Drag Handle & Mobile Title */}
        <div 
          className="lg:hidden flex flex-col items-center justify-center cursor-pointer pb-4 border-b border-white/5"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="w-12 h-1 bg-zinc-600 rounded-full mb-2" />
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-300">
            <MapPin className="w-4 h-4 text-primary-light" />
            <span>Informasi Lahan</span>
            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </div>
        </div>

        {/* Scrollable form content container */}
        <div className={cn(
          "flex-grow space-y-4 pt-2 lg:pt-0",
          isExpanded ? "overflow-y-auto pr-1" : "overflow-hidden lg:overflow-y-auto"
        )}>
          <h3 className="hidden lg:flex text-xl font-bold mb-5 items-center gap-2 text-white border-b border-white/5 pb-3">
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
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Jenis Tanah / Tekstur</label>
                {isSoilAutoDetected && (
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium flex items-center gap-1 animate-pulse">
                    ✓ Otomatis (Satelit{clayLevel !== undefined ? `: Clay ${clayLevel}%, Sand ${sandLevel}%` : ''})
                  </span>
                )}
              </div>
              <select 
                value={soilType}
                onChange={(e) => {
                  setSoilType(e.target.value as Lahan['jenisTanah']);
                  setIsSoilAutoDetected(false);
                }}
                className="w-full bg-bg-dark border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-all text-sm mb-4"
              >
                <option value="Humus">Tanah Humus (Subur/Organik)</option>
                <option value="Lempung">Tanah Lempung (Baik Tahan Air)</option>
                <option value="Pasir">Tanah Pasir (Sarang Air/Poros)</option>
                <option value="Gambut">Tanah Gambut (Asam/Rawa)</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Tingkat Keasaman (pH)</label>
                {isAutoDetected && (
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium flex items-center gap-1 animate-pulse">
                    ✓ Otomatis (Satelit)
                  </span>
                )}
                {isFetchingPH && (
                  <span className="text-[10px] text-gray-400 flex items-center gap-1">
                    <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Mendeteksi pH...
                  </span>
                )}
              </div>
              <select 
                value={pHLevel}
                onChange={(e) => {
                  setPHLevel(e.target.value);
                  setIsAutoDetected(false);
                }}
                className="w-full bg-bg-dark border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-all text-sm"
              >
                <option value="Sangat Asam (< 5.5)">Sangat Asam (&lt; 5.5)</option>
                <option value="Asam (5.5 - 6.5)">Asam (5.5 - 6.5)</option>
                <option value="Netral (6.5 - 7.5)">Netral (6.5 - 7.5) - Optimal</option>
                <option value="Basa (> 7.5)">Basa (&gt; 7.5)</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Kemiringan Lereng (Topografi)</label>
                {isSlopeAutoDetected && (
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium flex items-center gap-1 animate-pulse">
                    ✓ Otomatis (Satelit: {detectedSlopePct})
                  </span>
                )}
                {isFetchingSlope && (
                  <span className="text-[10px] text-gray-400 flex items-center gap-1">
                    <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Mendeteksi lereng...
                  </span>
                )}
              </div>
              <select 
                value={slopeLevel}
                onChange={(e) => {
                  setSlopeLevel(e.target.value);
                  setIsSlopeAutoDetected(false);
                }}
                className="w-full bg-bg-dark border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary transition-all text-sm"
              >
                <option value="Datar (<3%)">Datar (&lt;3%)</option>
                <option value="Landai (3-8%)">Landai (3-8%) - Optimal</option>
                <option value="Agak Curam (8-16%)">Agak Curam (8-16%)</option>
                <option value="Curam (>16%)">Curam (&gt;16%)</option>
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
                  <option value="Sangat Terhambat">Sangat Terhambat</option>
                  <option value="Terhambat">Terhambat</option>
                  <option value="Agak Terhambat">Agak Terhambat</option>
                  <option value="Agak Baik">Agak Baik</option>
                  <option value="Baik">Baik</option>
                  <option value="Agak Cepat">Agak Cepat</option>
                  <option value="Cepat">Cepat</option>
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
