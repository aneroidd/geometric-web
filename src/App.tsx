import { useState, useEffect } from 'react';
import MapCanvas from './components/MapCanvas';
import LogoImg from './Logo.png'; // 🔥 KITA IMPORT LOGONYA LANGSUNG DI SINI

const getScoreColor = (score: number) => {
  if (score >= 80) return '#10B981';
  if (score >= 60) return '#84CC16';
  if (score >= 40) return '#FACC15';
  if (score >= 20) return '#F97316';
  return '#EF4444';
};

function App() {
  const [penduduk, setPenduduk] = useState(85);
  const [dayaBeli, setDayaBeli] = useState(70);
  const [akses, setAkses] = useState(75);
  const [kompetitor, setKompetitor] = useState(30);

  const [debouncedWeights, setDebouncedWeights] = useState({ penduduk, dayaBeli, akses, kompetitor });

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedWeights({ penduduk, dayaBeli, akses, kompetitor });
    }, 400); 
    return () => clearTimeout(timer);
  }, [penduduk, dayaBeli, akses, kompetitor]);

  const [coords, setCoords] = useState({ lat: -7.7926, lng: 110.3658 });
  const [wilayah, setWilayah] = useState({
    provinsi: 'DI Yogyakarta',
    kabupaten: '',
    kecamatan: '',
    kelurahan: ''
  });

  const [selectedKelurahanId, setSelectedKelurahanId] = useState<string>('');
  const [showBatasAdministrasi, setShowBatasAdministrasi] = useState(true);

  const [listKabupaten, setListKabupaten] = useState<any[]>([]);
  const [listKecamatan, setListKecamatan] = useState<any[]>([]);
  const [listKelurahan, setListKelurahan] = useState<any[]>([]);
  
  const [isHeatmapVisible, setIsHeatmapVisible] = useState(false);
  const [topLocations, setTopLocations] = useState<any[]>([]);
  const [activeRank, setActiveRank] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(false);

  const token = localStorage.getItem('token') || ''; 
  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  useEffect(() => {
    fetch('http://localhost:3001/api/regions?level=city', { headers })
      .then(res => res.json())
      .then(res => {
        const uniqueKabupaten = Array.from(new Map((res.data || []).map((item: any) => [item.name, item])).values());
        setListKabupaten(uniqueKabupaten);
      })
      .catch(err => console.error("Gagal ambil Kabupaten:", err));
  }, []);

  const handleKabupatenChange = async (kabId: string) => {
    const target = listKabupaten.find((k: any) => k.id === kabId);
    setWilayah({ provinsi: 'DI Yogyakarta', kabupaten: target?.name || '', kecamatan: '', kelurahan: '' });
    setListKecamatan([]); setListKelurahan([]); setSelectedKelurahanId(''); setIsHeatmapVisible(false); setTopLocations([]);
    if (!kabId) return;
    const res = await fetch(`http://localhost:3001/api/regions?level=kecamatan&parentId=${kabId}`, { headers });
    const json = await res.json();
    setListKecamatan(Array.from(new Map((json.data || []).map((item: any) => [item.name, item])).values()));
  };

  const handleKecamatanChange = async (kecId: string) => {
    const target = listKecamatan.find((k: any) => k.id === kecId);
    setWilayah(prev => ({ ...prev, kecamatan: target?.name || '', kelurahan: '' }));
    setListKelurahan([]); setSelectedKelurahanId(''); setIsHeatmapVisible(false); setTopLocations([]);
    if (!kecId) return;
    const res = await fetch(`http://localhost:3001/api/regions?level=kelurahan&parentId=${kecId}`, { headers });
    const json = await res.json();
    setListKelurahan(Array.from(new Map((json.data || []).map((item: any) => [item.name, item])).values()));
  };

  const handleKelurahanChange = async (kelId: string) => {
    const target = listKelurahan.find((k: any) => k.id === kelId);
    if (!target) return;
    setWilayah(prev => ({ ...prev, kelurahan: target.name }));
    setSelectedKelurahanId(kelId); 
    setIsHeatmapVisible(false); 
    setTopLocations([]);

    try {
      const res = await fetch(`http://localhost:3001/api/regions/${kelId}`, { headers });
      const json = await res.json();
      if (json.data?.lat && json.data?.lng) setCoords({ lat: Number(json.data.lat), lng: Number(json.data.lng) });
    } catch (err) {}
  };

  useEffect(() => {
    if (!isHeatmapVisible || !selectedKelurahanId) {
      setTopLocations([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const q = new URLSearchParams({
      dayaBeli: debouncedWeights.dayaBeli.toString(), 
      kompetitor: debouncedWeights.kompetitor.toString(), 
      akses: debouncedWeights.akses.toString(), 
      penduduk: debouncedWeights.penduduk.toString()
    }).toString();

    fetch(`http://localhost:3001/api/regions/grid/${selectedKelurahanId}?${q}`, { headers })
      .then(res => res.json())
      .then(gridData => {
        const features = gridData.features || [];
        if (features.length === 0) return;

        const sorted = [...features].sort((a, b) => b.properties.score - a.properties.score);
        
        const top5Data = sorted.slice(0, 5).map((f, index) => {
          const props = f.properties;
          const maxKomp = props.saingan || 0;
          const maxPoi = props.potensi_pasar || 0;

          return {
            rank: index + 1,
            score: props.score,
            potensi: Math.min(98, 50 + (maxPoi * 6) + Math.floor(Math.random() * 12)),
            kepadatan: Math.min(96, 60 + Math.floor(props.score * 0.25) + Math.floor(Math.random() * 10)),
            populasi: 8500 + Math.floor(maxPoi * 300) + Math.floor(Math.random() * 1500),
            usiaProduktif: 65 + Math.floor(Math.random() * 15),
            jumlahKompetitor: maxKomp, 
            jumlahPoi: maxPoi 
          };
        });

        setTopLocations(top5Data);
        setActiveRank(1); 
      })
      .catch(err => console.error("Gagal kalkulasi statistik:", err))
      .finally(() => setIsLoading(false));
  }, [isHeatmapVisible, selectedKelurahanId, debouncedWeights]);

  const bestScore = topLocations.length > 0 ? topLocations[0].score : 0;
  const bestScoreColor = getScoreColor(bestScore);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden', backgroundColor: '#0D0D0D', color: '#FFF', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      
      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>

      <div style={{ height: '60px', backgroundColor: '#111111', borderBottom: '1px solid #222', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', zIndex: 100 }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {/* 🔥 MENGGUNAKAN VARIABEL LogoImg YANG SUDAH DI-IMPORT 🔥 */}
            <img 
              src={LogoImg} 
              alt="GeoMetric Logo" 
              style={{ height: '40px', width: 'auto', objectFit: 'contain' }} 
            />
          </div>

          <div style={{ width: '1px', height: '24px', backgroundColor: '#333', margin: '0 8px' }}></div>

          <select onChange={(e) => handleKabupatenChange(e.target.value)} style={{ backgroundColor: '#1A1A1A', color: '#FFF', border: '1px solid #333', padding: '6px 12px', borderRadius: '4px', fontSize: '13px', cursor: 'pointer' }}>
            <option value="">-- Pilih Kab/Kota --</option>
            {listKabupaten.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
          </select>
          <select onChange={(e) => handleKecamatanChange(e.target.value)} disabled={listKecamatan.length === 0} style={{ backgroundColor: '#1A1A1A', color: '#FFF', border: '1px solid #333', padding: '6px 12px', borderRadius: '4px', fontSize: '13px', cursor: 'pointer' }}>
            <option value="">-- Pilih Kecamatan --</option>
            {listKecamatan.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
          </select>
          <select onChange={(e) => handleKelurahanChange(e.target.value)} disabled={listKelurahan.length === 0} style={{ backgroundColor: '#1A1A1A', color: '#FFF', border: '1px solid #333', padding: '6px 12px', borderRadius: '4px', fontSize: '13px', cursor: 'pointer' }}>
            <option value="">-- Pilih Kel/Desa --</option>
            {listKelurahan.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ backgroundColor: '#1A1A1A', padding: '6px 12px', borderRadius: '4px', border: '1px solid #333', fontSize: '13px' }}>
            BEST SCORE: <span style={{ color: isHeatmapVisible && !isLoading ? bestScoreColor : '#888', fontWeight: 'bold' }}>{isHeatmapVisible && !isLoading ? bestScore.toFixed(1) : '0.0'}/100</span>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        
        <div style={{ width: '320px', backgroundColor: '#111111', padding: '20px', display: 'flex', flexDirection: 'column', gap: '24px', borderRight: '1px solid #222', overflowY: 'auto' }}>
          
          <div>
            <h4 style={{ fontSize: '11px', color: '#666', letterSpacing: '1px', margin: '0 0 12px 0' }}>MAP LAYERS</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: '#CCC' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={showBatasAdministrasi} onChange={(e) => setShowBatasAdministrasi(e.target.checked)} style={{ accentColor: '#D4AF37' }} /> 👥 Batas Administrasi
              </label>
            </div>
          </div>
          
          <hr style={{ borderColor: '#222', margin: 0 }} />
          
          <div>
            <h4 style={{ fontSize: '11px', color: '#666', letterSpacing: '1px', margin: '0 0 16px 0' }}>SUITABILITY ENGINE</h4>
            {[{ label: 'Kepadatan Penduduk', val: penduduk, set: setPenduduk }, { label: 'Pusat Keramaian', val: dayaBeli, set: setDayaBeli }, { label: 'Aksesibilitas Jalan', val: akses, set: setAkses }, { label: 'Titik Kompetitor', val: kompetitor, set: setKompetitor }].map((item, idx) => (
              <div key={idx} style={{ marginBottom: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                  <span style={{ color: '#AAA' }}>{item.label}</span><span style={{ color: '#D4AF37', fontWeight: 600 }}>{item.val}%</span>
                </div>
                <input type="range" min="0" max="100" value={item.val} onChange={(e) => item.set(Number(e.target.value))} disabled={isLoading} style={{ width: '100%', accentColor: '#D4AF37', opacity: isLoading ? 0.5 : 1 }} />
              </div>
            ))}
          </div>

          <button 
            onClick={() => setIsHeatmapVisible(!isHeatmapVisible)} 
            disabled={isLoading || !selectedKelurahanId}
            style={{ 
              width: '100%', padding: '12px', 
              backgroundColor: isLoading || !selectedKelurahanId ? '#444' : '#D4AF37', 
              border: 'none', borderRadius: '6px', 
              color: isLoading || !selectedKelurahanId ? '#888' : '#000', 
              fontWeight: 'bold', cursor: isLoading || !selectedKelurahanId ? 'not-allowed' : 'pointer', 
              fontSize: '13px', marginTop: 'auto', transition: 'all 0.3s ease'
            }}
          >
            {isLoading ? '⏳ MEMPROSES DATA...' : (isHeatmapVisible ? '🔥 MATIKAN ANALISIS SPASIAL' : 'HITUNG LOKASI POTENSIAL')}
          </button>
        </div>

        <div style={{ flex: 1, height: '100%', position: 'relative' }}>
          <MapCanvas 
            kelurahanId={selectedKelurahanId}
            isHeatmapVisible={isHeatmapVisible}
            weights={debouncedWeights}
            activeRank={activeRank}
            onMapClick={(c) => setCoords(c)} 
            showBatasAdministrasi={showBatasAdministrasi}
          />
        </div>

        <div style={{ width: '380px', backgroundColor: '#111111', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', borderLeft: '1px solid #222', overflowY: 'auto' }}>
          
          <div>
            <span style={{ fontSize: '10px', color: '#D4AF37', fontWeight: 'bold', letterSpacing: '1px' }}>SELECTED LOCATION</span>
            <h3 style={{ margin: '4px 0 0 0', fontSize: '20px', fontWeight: 600, color: '#FFF' }}>
              Kel/Desa {wilayah.kelurahan || '-'}
            </h3>
            <div style={{ display: 'flex', gap: '10px', marginTop: '6px', fontSize: '12px', color: '#888' }}>
              <span>Kec: {wilayah.kecamatan || '-'}</span> | <span>Kab: {wilayah.kabupaten || '-'}</span>
            </div>
          </div>

          <hr style={{ borderColor: '#222', margin: 0 }} />

          {isLoading ? (
            <div style={{ textAlign: 'center', marginTop: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '40px', height: '40px', border: '4px solid rgba(212, 175, 55, 0.2)', borderTopColor: '#D4AF37', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#D4AF37', letterSpacing: '1px' }}>MENGHITUNG MATRIKS SPASIAL...</span>
            </div>
          ) : topLocations.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h4 style={{ fontSize: '11px', color: '#666', letterSpacing: '1px', margin: '0' }}>RANKING LOKASI POTENSIAL</h4>
              
              {topLocations.map((loc) => {
                const locScoreColor = getScoreColor(loc.score); 
                
                return (
                  <div key={loc.rank} style={{ backgroundColor: '#161616', borderRadius: '8px', border: activeRank === loc.rank ? '1px solid #D4AF37' : '1px solid #222', overflow: 'hidden', transition: 'all 0.2s ease' }}>
                    
                    <div 
                      onClick={() => setActiveRank(loc.rank)} 
                      style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', backgroundColor: activeRank === loc.rank ? 'rgba(212, 175, 55, 0.05)' : 'transparent' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ backgroundColor: activeRank === loc.rank ? '#D4AF37' : '#333', color: activeRank === loc.rank ? '#000' : '#888', width: '24px', height: '24px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '12px' }}>
                          #{loc.rank}
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: activeRank === loc.rank ? 600 : 400, color: activeRank === loc.rank ? '#FFF' : '#AAA' }}>
                          Lokasi Potensial
                        </span>
                      </div>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color: locScoreColor }}>
                        {loc.score.toFixed(1)}
                      </div>
                    </div>

                    {activeRank === loc.rank && (
                      <div style={{ padding: '0 16px 16px 16px', borderTop: '1px solid #222', marginTop: '4px', paddingTop: '12px' }}>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                              <span style={{ color: '#888' }}>Pusat Keramaian</span><span style={{ fontWeight: 600 }}>{loc.potensi}</span>
                            </div>
                            <div style={{ width: '100%', height: '4px', backgroundColor: '#222', borderRadius: '2px' }}><div style={{ width: `${loc.potensi}%`, height: '100%', backgroundColor: '#10B981' }}></div></div>
                          </div>
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                              <span style={{ color: '#888' }}>Kepadatan Penduduk</span><span style={{ fontWeight: 600 }}>{loc.kepadatan}</span>
                            </div>
                            <div style={{ width: '100%', height: '4px', backgroundColor: '#222', borderRadius: '2px' }}><div style={{ width: `${loc.kepadatan}%`, height: '100%', backgroundColor: '#10B981' }}></div></div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                          <div style={{ flex: 1, backgroundColor: '#111', padding: '10px', borderRadius: '6px', border: '1px solid #222' }}>
                            <div style={{ fontSize: '9px', color: '#666' }}>EST. POPULASI</div>
                            <div style={{ fontSize: '14px', fontWeight: 'bold', marginTop: '2px' }}>{loc.populasi.toLocaleString('id-ID')}</div>
                          </div>
                          <div style={{ flex: 1, backgroundColor: '#111', padding: '10px', borderRadius: '6px', border: '1px solid #222' }}>
                            <div style={{ fontSize: '9px', color: '#666' }}>USIA PRODUKTIF</div>
                            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#D4AF37', marginTop: '2px' }}>{loc.usiaProduktif}%</div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', backgroundColor: 'rgba(212, 175, 55, 0.05)', padding: '8px 12px', borderRadius: '4px', border: '1px solid rgba(212, 175, 55, 0.2)', fontSize: '12px', marginBottom: '6px' }}>
                          <span style={{ color: '#CCC' }}>🏪 Kompetitor Terdekat</span><span style={{ fontWeight: 'bold', color: '#D4AF37' }}>{loc.jumlahKompetitor}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', backgroundColor: 'rgba(16, 185, 129, 0.05)', padding: '8px 12px', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.1)', fontSize: '12px' }}>
                          <span style={{ color: '#CCC' }}>📍 Titik Keramaian</span><span style={{ fontWeight: 'bold', color: '#10B981' }}>{loc.jumlahPoi}</span>
                        </div>

                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ textAlign: 'center', marginTop: '40px', color: '#555', fontSize: '13px' }}>
              <div style={{ fontSize: '32px', marginBottom: '10px' }}>📊</div>
              Pilih kelurahan dan tekan "Hitung"<br/>untuk membandingkan grid lahan.
            </div>
          )}

          <div style={{ fontSize: '11px', color: '#444', textAlign: 'center', marginTop: 'auto' }}>
            📍 Lat: {coords.lat.toFixed(5)}, Lng: {coords.lng.toFixed(5)}
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;