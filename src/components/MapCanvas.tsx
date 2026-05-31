import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface MapCanvasProps {
  kelurahanId?: string;
  isHeatmapVisible?: boolean;
  weights?: any;
  activeRank?: number; 
  onMapClick?: (coords: { lat: number; lng: number }) => void; 
  showBatasAdministrasi?: boolean; // 🔥 ERROR TERATASI: Kabel penerima sudah didaftarkan dengan nama yang benar
}

const BASEMAPS = {
  dark: { name: 'Dark Mode', url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' },
  light: { name: 'Light Mode', url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png' },
  satellite: { name: 'Citra Satelit', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' },
  street: { name: 'Peta Jalan', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' }
};

const getScoreColor = (score: number) => {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#84cc16';
  if (score >= 40) return '#facc15';
  if (score >= 20) return '#f97316';
  return '#ef4444';
};

export default function MapCanvas({ kelurahanId, isHeatmapVisible, weights, activeRank, onMapClick, showBatasAdministrasi }: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  
  // Layer penampung
  const layersRef = useRef({ 
    heatmap: L.featureGroup(), 
    markers: L.featureGroup(),
    boundary: L.geoJSON(undefined, { style: { color: '#D4AF37', weight: 1.5, fillOpacity: 0.05, dashArray: '5, 5' }}) 
  });
  
  const [activeBasemap, setActiveBasemap] = useState<keyof typeof BASEMAPS>('dark');
  const [showBasemapMenu, setShowBasemapMenu] = useState(false);
  const [topFeatures, setTopFeatures] = useState<any[]>([]);
  const weightsString = JSON.stringify(weights);

  const onMapClickRef = useRef(onMapClick);
  useEffect(() => { onMapClickRef.current = onMapClick; }, [onMapClick]);

  // 1. Inisialisasi Peta
  useEffect(() => {
    if (!containerRef.current) return;
    const map = L.map(containerRef.current, { center: [-7.7956, 110.3695], zoom: 11, zoomControl: false, attributionControl: false });
    L.tileLayer(BASEMAPS['dark'].url).addTo(map);
    mapRef.current = map;
    
    layersRef.current.heatmap.addTo(map);
    layersRef.current.markers.addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      onMapClickRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng });
    });

    // Ambil data Batas Administrasi
    fetch('http://localhost:3001/api/regions/map')
      .then(res => res.json())
      .then(data => {
        if (!mapRef.current) return;
        layersRef.current.boundary.addData(data);
        if (showBatasAdministrasi) {
          layersRef.current.boundary.addTo(mapRef.current);
        }
      })
      .catch(err => console.error("Gagal menarik data Batas Administrasi:", err));
    
    return () => { map.remove(); mapRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Efek untuk memunculkan/menyembunyikan Batas Administrasi
  useEffect(() => {
    if (!mapRef.current) return;
    if (showBatasAdministrasi) {
      if (!mapRef.current.hasLayer(layersRef.current.boundary)) {
        layersRef.current.boundary.addTo(mapRef.current);
      }
    } else {
      if (mapRef.current.hasLayer(layersRef.current.boundary)) {
        mapRef.current.removeLayer(layersRef.current.boundary);
      }
    }
  }, [showBatasAdministrasi]);

  // 3. Ganti Basemap
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.eachLayer((layer) => { if (layer instanceof L.TileLayer) mapRef.current?.removeLayer(layer); });
    L.tileLayer(BASEMAPS[activeBasemap].url).addTo(mapRef.current);
  }, [activeBasemap]);

  // 4. Heatmap & Popup Interaktif
  useEffect(() => {
    if (!mapRef.current) return;
    layersRef.current.heatmap.clearLayers();
    layersRef.current.markers.clearLayers();
    setTopFeatures([]);

    if (!isHeatmapVisible || !kelurahanId) return;

    const q = new URLSearchParams(weights).toString();
    fetch(`http://localhost:3001/api/regions/grid/${kelurahanId}?${q}`)
      .then(res => res.json())
      .then(data => {
        if (!mapRef.current || !data.features || data.features.length === 0) return;

        L.geoJSON(data, {
          style: (f: any) => ({
            fillColor: getScoreColor(f.properties.score || 0),
            fillOpacity: 0.5, weight: 0.5, color: '#000'
          }),
          onEachFeature: (feature: any, layer: any) => {
            layer.on('click', (e: any) => {
              L.DomEvent.stopPropagation(e.originalEvent); 
              onMapClickRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng });

              const props = feature.properties;
              const score = props.score || 0;
              
              L.popup()
                .setLatLng(e.latlng)
                .setContent(`
                  <div style="color: #000; font-family: sans-serif; font-size: 13px; text-align: center; padding: 8px; min-width: 180px;">
                    <strong style="font-size: 15px; color: ${getScoreColor(score)};">Nilai Overlay: ${Number(score).toFixed(1)}/100</strong>
                    <div style="margin: 8px 0; border-top: 1px solid #EEE;"></div>
                    <div style="text-align: left; line-height: 1.6;">
                      📍 Titik Keramaian: <b>${props.potensi_pasar}</b><br/>
                      🏪 Kompetitor Terdekat: <b>${props.saingan}</b>
                    </div>
                    <div style="margin-top: 8px; font-size: 10px; color: #888;">
                      Lat: ${e.latlng.lat.toFixed(5)} | Lng: ${e.latlng.lng.toFixed(5)}
                    </div>
                  </div>
                `)
                .openOn(mapRef.current!);
            });
          }
        }).addTo(layersRef.current.heatmap);

        const sorted = [...data.features].sort((a, b) => b.properties.score - a.properties.score);
        setTopFeatures(sorted.slice(0, 5));
        
        mapRef.current.fitBounds(layersRef.current.heatmap.getBounds(), { padding: [20, 20] });
      });
  }, [kelurahanId, isHeatmapVisible, weightsString]);

  // 5. Marker Ranking
  useEffect(() => {
    layersRef.current.markers.clearLayers();

    topFeatures.forEach((f, i) => {
      const rank = i + 1;
      const isActive = rank === activeRank; 
      const center = L.geoJSON(f).getBounds().getCenter();

      const bgColor = isActive ? '#D4AF37' : '#111';
      const textColor = isActive ? '#000' : '#10B981';
      const borderColor = isActive ? '#FFF' : '#10B981';
      const scale = isActive ? 'scale(1.2)' : 'scale(1)';
      const zIndex = isActive ? 1000 : 1;

      const html = `
        <div style="
          background: ${bgColor}; 
          color: ${textColor}; 
          border: 2px solid ${borderColor}; 
          padding: 2px 6px; 
          border-radius: 4px; 
          font-weight: bold; 
          font-size: ${isActive ? '13px' : '11px'}; 
          text-align: center; 
          box-shadow: 0 4px 8px rgba(0,0,0,0.6);
          transform: ${scale};
          transition: all 0.3s ease;
        ">#${rank}</div>
      `;

      L.marker(center, {
        icon: L.divIcon({ className: 'custom-rank', html: html, iconSize: [isActive ? 35 : 30, isActive ? 25 : 20], iconAnchor: [isActive ? 17.5 : 15, isActive ? 12.5 : 10] }),
        zIndexOffset: zIndex
      }).addTo(layersRef.current.markers);
    });
  }, [topFeatures, activeRank]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%', backgroundColor: '#000' }} />
      
      <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 1000, display: 'flex', alignItems: 'center', gap: '8px' }}>
        {showBasemapMenu && (
          <div style={{ display: 'flex', gap: '6px', backgroundColor: 'rgba(30, 30, 40, 0.95)', padding: '6px', borderRadius: '8px', border: '1px solid #444', backdropFilter: 'blur(8px)', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}>
            {(Object.keys(BASEMAPS) as Array<keyof typeof BASEMAPS>).map((key) => {
              let thumbUrl = '';
              if (key === 'dark') thumbUrl = 'https://a.basemaps.cartocdn.com/dark_all/4/13/8.png';
              if (key === 'light') thumbUrl = 'https://a.basemaps.cartocdn.com/light_all/4/13/8.png';
              if (key === 'satellite') thumbUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/4/8/13';
              if (key === 'street') thumbUrl = 'https://a.tile.openstreetmap.org/4/13/8.png';
              return (
                <button
                  key={key} onClick={() => setActiveBasemap(key)} title={BASEMAPS[key].name} 
                  style={{ width: '36px', height: '36px', backgroundImage: `url(${thumbUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', border: activeBasemap === key ? '2px solid #F59E0B' : '2px solid transparent', borderRadius: '6px', cursor: 'pointer', padding: 0, overflow: 'hidden', boxShadow: activeBasemap === key ? '0 0 8px rgba(245, 158, 11, 0.6)' : 'none' }}
                />
              )
            })}
          </div>
        )}
        <button onClick={() => setShowBasemapMenu(!showBasemapMenu)} style={{ width: '40px', height: '40px', backgroundColor: '#F29F67', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.3)', color: '#fff' }} title="Ubah Basemap">
          <span style={{ fontSize: '20px', lineHeight: 1 }}>🗺️</span> 
        </button>
      </div>

      <div style={{ position: 'absolute', bottom: '16px', left: '16px', zIndex: 1000, display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(20, 20, 20, 0.85)', border: '1px solid #262626', borderRadius: '4px', padding: '6px 12px' }}>
        <div style={{ width: '100px', height: '8px', background: 'linear-gradient(to right, #ef4444, #f97316, #facc15, #84cc16, #10b981)', borderRadius: '4px' }}></div>
        <span style={{ fontSize: '12px', color: '#888', fontFamily: 'sans-serif' }}>Low - High Suitability</span>
      </div>
    </div>
  );
}