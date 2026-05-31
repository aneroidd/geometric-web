import { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Memperbaiki icon default Leaflet di React
import iconRetina from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

L.Icon.Default.mergeOptions({
  iconRetinaUrl: iconRetina,
  iconUrl: iconUrl,
  shadowUrl: shadowUrl,
});

// Komponen untuk menangkap klik user di peta
const LocationPicker = ({ onLocationSelect }: { onLocationSelect: (lat: number, lng: number) => void }) => {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

export const MapViewer = () => {
  const [selectedPos, setSelectedPos] = useState<{lat: number, lng: number} | null>(null);

  // Koordinat default (misal: area Jawa Tengah / Boyolali sebagai titik awal)
  const defaultCenter: [number, number] = [-7.5172, 110.5936];

  const handleLocationSelect = (lat: number, lng: number) => {
    setSelectedPos({ lat, lng });
    // Di sinilah nanti kita memanggil API /services/analysis.service.ts
    console.log(`Koordinat dipilih: ${lat}, ${lng}`);
  };

  return (
    <div style={{ height: '100vh', width: '100%' }}>
      <MapContainer center={defaultCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
        {/* Basemap dari OpenStreetMap */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <LocationPicker onLocationSelect={handleLocationSelect} />

        {selectedPos && (
          <Marker position={[selectedPos.lat, selectedPos.lng]}>
            <Popup>
              <strong>Titik Dipilih!</strong> <br />
              Lat: {selectedPos.lat.toFixed(4)} <br />
              Lng: {selectedPos.lng.toFixed(4)} <br />
              <em>Memproses analisis lokasi...</em>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
};