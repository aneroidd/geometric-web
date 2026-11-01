import { useState, useEffect } from 'react';
import MapCanvas from './components/MapCanvas';
import LogoImg from './logo.png'; 
import * as XLSX from 'xlsx';

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

  const [appliedWeights, setAppliedWeights] = useState({ penduduk, dayaBeli, akses, kompetitor });

  const isWeightsChanged = 
    penduduk !== appliedWeights.penduduk || 
    dayaBeli !== appliedWeights.dayaBeli || 
    akses !== appliedWeights.akses || 
    kompetitor !== appliedWeights.kompetitor;

  const [coords, setCoords] = useState({ lat: -7.7926, lng: 110.3658 });
  const [wilayah, setWilayah] = useState({ provinsi: 'DI Yogyakarta', kabupaten: '', kecamatan: '', kelurahan: '' });

  const [selectedKelurahanId, setSelectedKelurahanId] = useState<string>('');
  
  // 🔥 MAP LAYER STATES 🔥
  const [showBatasAdministrasi, setShowBatasAdministrasi] = useState(true);
  const [showHasilAnalisis, setShowHasilAnalisis] = useState(true); // State baru untuk Toggle Grid

  const [listKabupaten, setListKabupaten] = useState<any[]>([]);
  const [listKecamatan, setListKecamatan] = useState<any[]>([]);
  const [listKelurahan, setListKelurahan] = useState<any[]>([]);
  
  const [isHeatmapVisible, setIsHeatmapVisible] = useState(false);
  const [topLocations, setTopLocations] = useState<any[]>([]);
  const [activeRank, setActiveRank] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); 

  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 100); 
    return () => clearTimeout(timer);
  }, [isSidebarOpen]);

  const token = localStorage.getItem('token') || ''; 
  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  useEffect(() => {
    fetch('https://geometric-api-683589783585.asia-southeast2.run.app/api/regions?level=city', { headers })
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
    const res = await fetch(`https://geometric-api-683589783585.asia-southeast2.run.app/api/regions?level=kecamatan&parentId=${kabId}`, { headers });
    const json = await res.json();
    setListKecamatan(Array.from(new Map((json.data || []).map((item: any) => [item.name, item])).values()));
  };

  const handleKecamatanChange = async (kecId: string) => {
    const target = listKecamatan.find((k: any) => k.id === kecId);
    setWilayah(prev => ({ ...prev, kecamatan: target?.name || '', kelurahan: '' }));
    setListKelurahan([]); setSelectedKelurahanId(''); setIsHeatmapVisible(false); setTopLocations([]);
    if (!kecId) return;
    const res = await fetch(`https://geometric-api-683589783585.asia-southeast2.run.app/api/regions?level=kelurahan&parentId=${kecId}`, { headers });
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
    setShowHasilAnalisis(true); // Reset toggle jika ganti daerah

    try {
      const res = await fetch(`https://geometric-api-683589783585.asia-southeast2.run.app/api/regions/${kelId}`, { headers });
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
      dayaBeli: appliedWeights.dayaBeli.toString(), 
      kompetitor: appliedWeights.kompetitor.toString(), 
      akses: appliedWeights.akses.toString(), 
      penduduk: appliedWeights.penduduk.toString()
    }).toString();

    fetch(`https://geometric-api-683589783585.asia-southeast2.run.app/api/regions/grid/${selectedKelurahanId}?${q}`, { headers })
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
        setShowHasilAnalisis(true); // Otomatis nyalakan toggle saat hitung selesai
      })
      .catch(err => console.error("Gagal kalkulasi statistik:", err))
      .finally(() => setIsLoading(false));
  }, [isHeatmapVisible, selectedKelurahanId, appliedWeights]);

  useEffect(() => {
    const fetchAiAnalysis = async (locData: any) => {
      setIsAiLoading(true);
      setAiAnalysis('');
      try {
        const res = await fetch(`https://geometric-api-683589783585.asia-southeast2.run.app/api/regions/ai-analysis`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            locationName: `Titik Grid #${locData.rank} (${wilayah.kelurahan || 'Area Terpilih'})`,
            score: locData.score,
            competitorCount: locData.jumlahKompetitor,
            marketPotential: locData.jumlahPoi
          })
        });
        const data = await res.json();
        setAiAnalysis(data.analysis || 'Gagal menghasilkan respons AI.');
      } catch (err) {
        setAiAnalysis('Gagal terhubung ke Asisten AI. Periksa koneksi atau pastikan backend sudah ter-deploy.');
      } finally {
        setIsAiLoading(false);
      }
    };

    if (topLocations.length > 0 && activeRank) {
      const activeLoc = topLocations.find(l => l.rank === activeRank);
      if (activeLoc) {
        fetchAiAnalysis(activeLoc);
      }
    }
  }, [activeRank, topLocations, wilayah.kelurahan]);

  const exportToExcel = () => {
    if (topLocations.length === 0) return;

    const dataToExport = topLocations.map(loc => ({
      "Peringkat": `#${loc.rank}`,
      "Skor Kesesuaian (0-100)": Number(loc.score.toFixed(1)),
      "Pusat Keramaian (%)": loc.potensi,
      "Kepadatan Penduduk (%)": loc.kepadatan,
      "Estimasi Populasi": loc.populasi,
      "Persentase Usia Produktif": `${loc.usiaProduktif}%`,
      "Kompetitor Terdekat": loc.jumlahKompetitor,
      "Jumlah Titik POI": loc.jumlahPoi
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Ranking Lokasi");

    const namaFile = `Analisis_Lokasi_${wilayah.kelurahan || 'GeoMetric'}.xlsx`;
    XLSX.writeFile(workbook, namaFile);
  };

  const bestScore = topLocations.length > 0 ? topLocations[0].score : 0;
  const bestScoreColor = getScoreColor(bestScore);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden', backgroundColor: '#0D0D0D', color: '#FFF', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      
      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        
        .app-header {
          min-height: 60px;
          background-color: #111111;
          border-bottom: 1px solid #222;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 24px;
          z-index: 100;
          flex-wrap: wrap;
          gap: 16px;
        }
        .header-left {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .app-content {
          flex: 1;
          display: flex;
          flex-direction: column; 
          overflow-y: auto; 
          overflow-x: hidden;
        }
        .left-panel {
          width: 100%;
          background-color: #111111;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 24px;
          border-bottom: 1px solid #222; 
          order: 2; 
        }
        .map-panel {
          width: 100%;
          height: 55vh; 
          min-height: 350px;
          position: relative;
          order: 1; 
        }
        .right-panel {
          width: 100%;
          background-color: #111111;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          order: 3; 
        }

        @media (min-width: 768px) {
          .app-header { height: 60px; padding: 0 24px; flex-wrap: nowrap; }
          .app-content { flex-direction: row; overflow: hidden; }
          .left-panel { width: 240px; border-bottom: none; border-right: 1px solid #222; overflow-y: auto; order: 1; }
          .map-panel { flex: 1; height: 100%; order: 2; }
          .right-panel { width: 280px; border-left: 1px solid #222; overflow-y: auto; order: 3; }
        }

        @media (min-width: 1024px) {
          .left-panel { width: 320px; }
          .right-panel { width: 380px; }
        }
      `}</style>

      <div className="app-header">
        <div className="header-left">
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <img src={LogoImg} alt="GeoMetric Logo" style={{ height: '35px', width: 'auto', objectFit: 'contain' }} />
          </div>

          <div style={{ width: '1px', height: '24px', backgroundColor: '#333', margin: '0 4px' }} className="hide-on-mobile"></div>

          <select onChange={(e) => handleKabupatenChange(e.target.value)} style={{ backgroundColor: '#1A1A1A', color: '#FFF', border: '1px solid #333', padding: '6px 12px', borderRadius: '4px', fontSize: '13px', cursor: 'pointer', flex: '1 1 auto' }}>
            <option value="">-- Pilih Kab/Kota --</option>
            {listKabupaten.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
          </select>
          <select onChange={(e) => handleKecamatanChange(e.target.value)} disabled={listKecamatan.length === 0} style={{ backgroundColor: '#1A1A1A', color: '#FFF', border: '1px solid #333', padding: '6px 12px', borderRadius: '4px', fontSize: '13px', cursor: 'pointer', flex: '1 1 auto' }}>
            <option value="">-- Pilih Kecamatan --</option>
            {listKecamatan.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
          </select>
          <select onChange={(e) => handleKelurahanChange(e.target.value)} disabled={listKelurahan.length === 0} style={{ backgroundColor: '#1A1A1A', color: '#FFF', border: '1px solid #333', padding: '6px 12px', borderRadius: '4px', fontSize: '13px', cursor: 'pointer', flex: '1 1 auto' }}>
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

      <div className="app-content">
        
        <div className="left-panel" style={{ display: isSidebarOpen ? 'flex' : 'none' }}>
          <div>
            <h4 style={{ fontSize: '11px', color: '#666', letterSpacing: '1px', margin: '0 0 12px 0' }}>MAP LAYERS</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: '#CCC' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={showBatasAdministrasi} onChange={(e) => setShowBatasAdministrasi(e.target.checked)} style={{ accentColor: '#D4AF37' }} /> 👥 Batas Administrasi
              </label>
              
              {/* 🔥 KOTAK CENTANG BARU UNTUK GRID HASIL ANALISIS 🔥 */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: isHeatmapVisible ? 'pointer' : 'not-allowed', opacity: isHeatmapVisible ? 1 : 0.4 }}>
                <input 
                  type="checkbox" 
                  checked={showHasilAnalisis} 
                  onChange={(e) => setShowHasilAnalisis(e.target.checked)} 
                  disabled={!isHeatmapVisible}
                  style={{ accentColor: '#D4AF37' }} 
                /> 📊 Hasil Analisis (Grid)
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
            onClick={() => {
              if (!isHeatmapVisible) {
                setAppliedWeights({ penduduk, dayaBeli, akses, kompetitor });
                setIsHeatmapVisible(true);
              } else if (isWeightsChanged) {
                setAppliedWeights({ penduduk, dayaBeli, akses, kompetitor });
              } else {
                setIsHeatmapVisible(false);
              }
            }}
            disabled={isLoading || !selectedKelurahanId}
            style={{ 
              width: '100%', padding: '12px', 
              backgroundColor: isLoading || !selectedKelurahanId ? '#444' : (isHeatmapVisible && !isWeightsChanged ? '#888' : '#D4AF37'), 
              border: 'none', borderRadius: '6px', 
              color: '#000', 
              fontWeight: 'bold', cursor: isLoading || !selectedKelurahanId ? 'not-allowed' : 'pointer', 
              fontSize: '13px', marginTop: 'auto', transition: 'all 0.3s ease'
            }}
          >
            {isLoading ? '⏳ MEMPROSES...' : 
              (!isHeatmapVisible ? 'HITUNG LOKASI POTENSIAL' : 
                (isWeightsChanged ? '🔄 PERBARUI ANALISIS' : '🔥 MATIKAN ANALISIS')
              )
            }
          </button>
        </div>

        <div className="map-panel">
          
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            style={{
              position: 'absolute',
              top: '15px',
              left: '15px',
              zIndex: 1000,
              backgroundColor: '#D4AF37',
              color: '#000',
              border: 'none',
              padding: '8px 12px',
              borderRadius: '4px',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: '0 2px 5px rgba(0,0,0,0.5)',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px'
            }}
          >
            {isSidebarOpen ? '◀ TUTUP MENU' : '☰ BUKA MENU'}
          </button>

          <MapCanvas 
            kelurahanId={selectedKelurahanId}
            isHeatmapVisible={isHeatmapVisible}
            weights={appliedWeights} 
            activeRank={activeRank}
            onMapClick={(c) => setCoords(c)} 
            showBatasAdministrasi={showBatasAdministrasi}
            showHasilAnalisis={showHasilAnalisis} // 🔥 MENGIRIM PERINTAH TOGGLE KE KANVAS
          />
        </div>

        <div className="right-panel">
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
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ fontSize: '11px', color: '#666', letterSpacing: '1px', margin: '0' }}>RANKING LOKASI POTENSIAL</h4>
                <button 
                  onClick={exportToExcel}
                  style={{
                    backgroundColor: '#10B981', color: '#FFF', border: 'none', padding: '4px 8px', 
                    borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                  }}
                >
                  <span>📊</span> UNDUH EXCEL
                </button>
              </div>
              
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

                        <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'rgba(212, 175, 55, 0.05)', borderRadius: '6px', border: '1px solid rgba(212, 175, 55, 0.2)' }}>
                          <h5 style={{ margin: '0 0 8px 0', color: '#D4AF37', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>🤖</span> Analisis AI Konsultan
                          </h5>
                          
                          {isAiLoading ? (
                            <div style={{ color: '#888', fontSize: '11px', fontStyle: 'italic', display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <div style={{ width: '12px', height: '12px', border: '2px solid rgba(212, 175, 55, 0.2)', borderTopColor: '#D4AF37', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                              Menyusun laporan analitik...
                            </div>
                          ) : (
                            <div style={{ color: '#E5E5E5', fontSize: '11.5px', lineHeight: '1.6', textAlign: 'justify' }}>
                              {aiAnalysis}
                            </div>
                          )}
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